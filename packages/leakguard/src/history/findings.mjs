import { CREDENTIALS, collectMatches } from "../patterns.mjs";
import { redact, sha8 } from "../util.mjs";

/** Severity order used when two occurrences of one finding are merged. */
export const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, info: 1, low: 1 };

/** Markers that identify a credential example rather than a live secret. */
const FIXTURE_MARKERS = /EXAMPLE|DEMO|NOT_REAL|FAKE|DUMMY|TEST|xxxx|0000|1234567890|0123456789|qwerty|abcdefghijklmnopqrstuvwxyz/i;

/** Length of an ascending character run that reads as a placeholder body. */
const ASCENDING_RUN = 8;

/** Path segments and file names used for tests and fixtures. */
const FIXTURE_DIR = /(?:^|\/)(?:tests?|__tests__|fixtures?|testdata)(?:\/|$)/i;
const FIXTURE_FILE = /(?:\.(?:test|spec)\.|[-_]test\.|[-_]spec\.|^test_)/i;

/** Hosts that are local to a machine or a container network. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"]);

/** Common placeholder passwords in connection URLs. */
const PLACEHOLDER_PASSWORDS = new Set(["password", "postgres", "changeme", "secret", "example", "pass", "root"]);

const URL_WITH_PASSWORD = /^([a-z][a-z0-9+.-]*):\/\/([^:\s/@]+):([^\s@/]+)@([^\s/?#]+)/i;

/**
 * Short, stable identifier for a secret. It is the same digest the package redaction uses.
 *
 * @param {string} value Raw secret
 * @returns {string} First eight hex characters of its SHA-256 digest
 */
export function secretHash(value) {
    return sha8(String(value));
}

/**
 * Redacts a string that may contain a credential. The raw value never leaves this module through
 * a finding.
 *
 * @param {unknown} value Text to redact
 * @returns {string} Redacted text
 */
export function safe(value) {
    return redact(typeof value === "string" ? value : String(value ?? ""));
}

/**
 * Builds a short redacted evidence snippet. Long lines are truncated, never reprinted in full.
 *
 * @param {unknown} value Evidence text
 * @param {number} [max] Maximum length
 * @returns {string} Redacted snippet
 */
export function snippet(value, max = 200) {
    const text = safe(value).replace(/[\r\n\t]+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

/**
 * True when a location is a test or fixture path.
 *
 * @param {string} location File path
 * @returns {boolean} Whether the path holds test data
 */
export function isFixturePath(location) {
    const path = String(location ?? "").replace(/\\/g, "/");
    const name = path.split("/").pop() ?? "";
    return FIXTURE_DIR.test(path) || FIXTURE_FILE.test(name);
}

/**
 * True when a body contains a run of consecutive ascending characters.
 *
 * @param {string} text Credential literal
 * @param {number} length Required run length
 * @returns {boolean} Whether an ascending run is present
 */
function hasAscendingRun(text, length) {
    let run = 1;
    for (let index = 1; index < text.length; index += 1) {
        const step = text.charCodeAt(index) - text.charCodeAt(index - 1);
        run = step === 1 ? run + 1 : 1;
        if (run >= length) {
            return true;
        }
    }
    return false;
}

/**
 * True when more than half of the body is the same short repeating pattern.
 *
 * @param {string} text Credential literal
 * @returns {boolean} Whether a repeating pattern dominates
 */
function isMostlyRepeated(text) {
    for (let size = 1; size <= 4; size += 1) {
        if (text.length < size * 3) {
            continue;
        }
        const pattern = text.slice(0, size);
        let covered = 0;
        for (let index = 0; index + size <= text.length; index += size) {
            if (text.slice(index, index + size) === pattern) {
                covered += size;
            }
        }
        if (covered / text.length > 0.5) {
            return true;
        }
    }
    return false;
}

/**
 * True when a credential value is a demo marker, a sequential or keyboard-run body, or has
 * obvious low entropy.
 *
 * @param {string} value Credential literal
 * @returns {boolean} Whether it reads as a fixture value
 */
export function isFixtureValue(value) {
    const text = String(value ?? "");
    if (FIXTURE_MARKERS.test(text) || /(.)\1{5,}/.test(text)) {
        return true;
    }
    if (hasAscendingRun(text, ASCENDING_RUN) || isMostlyRepeated(text)) {
        return true;
    }
    return text.length >= 8 && new Set(text).size <= 4;
}

/**
 * True for local machine, container and single-label service hosts.
 *
 * @param {string} host Host name with the port removed
 * @returns {boolean} Whether the destination is local
 */
export function isLocalHost(host) {
    const value = String(host ?? "").toLowerCase();
    if (LOCAL_HOSTS.has(value) || /^127\./.test(value)) {
        return true;
    }
    return /^[a-z0-9-]+$/.test(value) && !value.includes(".");
}

/**
 * Strips the port and brackets from the host part of a connection URL.
 *
 * @param {string} hostport Host with optional port
 * @returns {string} Host name
 */
function hostWithoutPort(hostport) {
    const value = String(hostport ?? "");
    if (value.startsWith("[")) {
        const end = value.indexOf("]");
        return end >= 0 ? value.slice(1, end).toLowerCase() : value.toLowerCase();
    }
    return value.replace(/:\d+$/, "").toLowerCase();
}

/**
 * Finds credential literals in a piece of text. Fixture hints are recorded, not applied here:
 * a value that also appears outside a test path keeps its normal severity after deduplication.
 *
 * @param {string} text Text to inspect
 * @param {string} [location] Source path, used for the fixture path hint
 * @returns {object[]} Secret references with classification metadata
 */
export function findSecrets(text, location = "") {
    const found = [];
    const seen = new Set();
    const fixturePath = isFixturePath(location);

    for (const credential of CREDENTIALS) {
        for (const value of collectMatches(credential.re, text)) {
            const hash = secretHash(value);
            if (seen.has(hash)) {
                continue;
            }
            seen.add(hash);

            let fixtureValue = isFixtureValue(value);
            let severity = "high";
            let local = false;
            let host = null;
            let note = null;

            if (credential.name === "url-password") {
                const parsed = value.match(URL_WITH_PASSWORD);
                if (parsed) {
                    host = hostWithoutPort(parsed[4]);
                    const password = parsed[3].toLowerCase();
                    // Classify the password, not the whole URL: a host named example.com must not
                    // turn a real password into a placeholder.
                    fixtureValue = isFixtureValue(parsed[3]);
                    if (isLocalHost(host) || PLACEHOLDER_PASSWORDS.has(password)) {
                        severity = "low";
                        local = true;
                        note = "local or placeholder credential";
                    }
                }
            }

            found.push({
                name: credential.name,
                hash,
                redacted: safe(value),
                severity,
                fixtureValue,
                fixturePath,
                local,
                host,
                note
            });
        }
    }

    return found;
}

/**
 * Creates one finding. Every field is safe to print: `evidence` is already redacted by the caller
 * or through `snippet`, and `secretRedacted` never holds a raw credential.
 *
 * @param {object} fields Finding fields
 * @returns {object} Finding
 */
export function makeFinding(fields = {}) {
    return {
        kind: fields.kind ?? "injection_found",
        severity: fields.severity ?? "info",
        title: fields.title ?? "Finding",
        source: fields.source ?? "unknown",
        location: String(fields.location ?? "").replace(/\\/g, "/"),
        line: fields.line ?? null,
        time: fields.time ?? null,
        evidence: fields.evidence ?? "",
        secretType: fields.secretType ?? null,
        secretHash: fields.secretHash ?? null,
        secretRedacted: fields.secretRedacted ?? null,
        host: fields.host ?? null,
        local: fields.local === true,
        note: fields.note ?? null,
        remote: fields.remote === true,
        fixture: fields.fixture === true,
        fixtureValue: fields.fixtureValue === true,
        fixturePath: fields.fixturePath === true,
        sameRepo: fields.sameRepo === true,
        executed: fields.executed === true,
        detectorIds: fields.detectorIds ?? [],
        occurrences: fields.occurrences ?? []
    };
}

function occurrenceOf(finding) {
    return {
        source: finding.source,
        location: finding.location,
        line: finding.line,
        time: finding.time,
        evidence: finding.evidence,
        executed: finding.executed,
        fixturePath: finding.fixturePath === true,
        sameRepo: finding.sameRepo === true
    };
}

/**
 * Groups findings so one secret produces one finding with every place it appeared. Findings
 * without a secret are grouped by their source, kind, location and detector ids.
 *
 * @param {object[]} findings Raw findings
 * @returns {object[]} Deduplicated findings
 */
export function deduplicate(findings) {
    const order = [];
    const grouped = new Map();

    for (const finding of findings) {
        const key = finding.secretHash
            ? `${finding.kind}:${finding.secretHash}`
            : `${finding.kind}:${finding.source}:${finding.location}:${finding.line ?? ""}:${finding.title}:${finding.detectorIds.join(",")}`;

        if (!grouped.has(key)) {
            grouped.set(key, { ...finding, occurrences: [occurrenceOf(finding)] });
            order.push(key);
            continue;
        }

        const existing = grouped.get(key);
        existing.occurrences.push(occurrenceOf(finding));
        existing.executed = existing.executed || finding.executed;
        existing.remote = existing.remote || finding.remote;
        existing.host = existing.host ?? finding.host;
        if ((SEVERITY_RANK[finding.severity] ?? 0) > (SEVERITY_RANK[existing.severity] ?? 0)) {
            existing.severity = finding.severity;
        }
        if (finding.time && (!existing.time || finding.time > existing.time)) {
            existing.time = finding.time;
        }
    }

    return order.map((key) => grouped.get(key));
}

/**
 * Downgrades a credential to an informational finding when its value is a placeholder, or when
 * every git occurrence is under a test or fixture path and every transcript occurrence belongs to
 * that same repository. Placeholder classification uses the value alone, so it applies to every
 * source, including a value seen only in agent transcripts. A live-looking value seen outside
 * those paths, or in another repository's transcript, keeps its normal severity.
 *
 * @param {object[]} findings Deduplicated findings
 * @returns {object[]} Same findings with fixture classification applied
 */
export function classifyFixtures(findings) {
    for (const finding of findings) {
        if (!finding.secretHash) {
            continue;
        }

        const placeholder = finding.fixtureValue === true;
        const git = finding.occurrences.filter((occurrence) => occurrence.source === "git");
        const transcripts = finding.occurrences.filter((occurrence) => occurrence.source === "transcripts");
        const onlyGitAndTranscripts = finding.occurrences.every(
            (occurrence) => occurrence.source === "git" || occurrence.source === "transcripts"
        );
        const gitAllFixtures = git.length > 0 && git.every((occurrence) => occurrence.fixturePath);
        const transcriptsSameRepo = transcripts.every((occurrence) => occurrence.sameRepo);
        const isFixture = placeholder || (onlyGitAndTranscripts && gitAllFixtures && transcriptsSameRepo);

        finding.fixture = isFixture;
        if (isFixture) {
            finding.severity = "info";
            finding.note = placeholder ? "placeholder credential" : "test fixture credential";
        }
    }
    return findings;
}

/**
 * Risk tier used by the report: remote executed exfiltration, exposed live credentials,
 * requested-only or local exfiltration, then low and informational findings.
 *
 * @param {object} finding Finding
 * @returns {number} Tier from 0 to 3
 */
export function riskTier(finding) {
    if (finding.kind === "exfil_executed" && finding.executed && finding.remote) {
        return 0;
    }
    if (finding.kind === "secret_exposed" && finding.severity === "high" && !finding.fixture) {
        return 1;
    }
    if (finding.kind === "exfil_executed") {
        return 2;
    }
    return 3;
}

/**
 * Sorts findings by severity, then by source and location, so the report is stable.
 *
 * @param {object[]} findings Findings
 * @returns {object[]} Sorted findings
 */
export function sortFindings(findings) {
    return [...findings].sort((left, right) => {
        const tier = riskTier(left) - riskTier(right);
        if (tier !== 0) {
            return tier;
        }
        const delta = (SEVERITY_RANK[right.severity] ?? 0) - (SEVERITY_RANK[left.severity] ?? 0);
        if (delta !== 0) {
            return delta;
        }
        return `${left.source}:${left.location}`.localeCompare(`${right.source}:${right.location}`);
    });
}
