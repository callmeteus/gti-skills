import { isFixtureValue } from "./history/findings.mjs";
import * as P from "./patterns.mjs";

/**
 * Creates a finding. `matches` holds raw matched substrings; callers redact before display or log.
 *
 * @param {string} id Detector id
 * @param {string} severity Severity label
 * @param {string} title Human readable title
 * @param {string[]} matches Raw matches
 * @returns {{ id: string, severity: string, title: string, matches: string[] }} Finding
 */
function finding(id, severity, title, matches) {
    return { id, severity, title, matches: matches.map(String) };
}

function allMatches(items, text) {
    const matches = [];
    for (const item of items) {
        matches.push(...P.collectMatches(item.re, text));
    }
    return matches;
}

function dotenvMatches(text) {
    return P.collectMatches(P.DOTENV, text);
}

function secretPathMatches(text) {
    return allMatches(P.SECRET_PATHS, text);
}

function credentialMatchesNamed(text) {
    const matches = [];
    for (const item of P.CREDENTIALS) {
        for (const value of P.collectMatches(item.re, text)) {
            matches.push({ name: item.name, value });
        }
    }
    return matches;
}

/** Hosts owned by each credential issuer. A suffix also covers its subdomains. */
const ISSUER_HOSTS = {
    github: ["github.com", "githubusercontent.com"],
    openai: ["api.openai.com"],
    anthropic: ["api.anthropic.com"],
    stripe: ["api.stripe.com"],
    aws: ["amazonaws.com"],
    google: ["googleapis.com"],
    slack: ["slack.com"],
    cloudflare: ["cloudflare.com"],
    pluggy: ["pluggy.ai"]
};

function hostMatches(host, entry) {
    const value = entry.toLowerCase();
    return host === value || host.endsWith(`.${value}`);
}

/**
 * True when every destination host of a command belongs to the credential's own issuer or is
 * explicitly allowlisted. With no host present, the credential is treated as suspicious.
 */
function credentialGoesToIssuer(name, hosts, allowHosts) {
    // A URL password at an issuer host is the credential used at its own service. The literal name
    // is generic, so check it against every known issuer instead of one fixed entry.
    const issuer = name === "url-password" ? Object.values(ISSUER_HOSTS).flat() : ISSUER_HOSTS[name];
    if (!issuer || hosts.length === 0) {
        return false;
    }

    return hosts.every((host) =>
        P.isInternalHost(host) ||
        issuer.some((entry) => hostMatches(host, entry)) ||
        allowHosts.some((entry) => hostMatches(host, entry))
    );
}

/**
 * Meaningful tokens of a credential variable name. Generic fragments and tokens shorter than four
 * characters never pair; short aliases expand to their full issuer name.
 *
 * @param {string} name Uppercase variable name
 * @returns {string[]} Lowercase tokens
 */
function nameTokens(name) {
    const value = String(name ?? "").toUpperCase();
    const aliases = [];
    for (const [alias, full] of [["GH", "GITHUB"], ["CF", "CLOUDFLARE"]]) {
        if (value === alias || value.startsWith(alias)) {
            aliases.push(full);
        }
    }
    const GENERIC = new Set([
        "API", "TOKEN", "KEY", "SECRET", "PASSWORD", "PASS", "URL", "HOST", "ADDR",
        "APP", "SERVER", "CLIENT", "ID", "USER", "USERNAME", "AUTH", "ACCESS", "VALUE", "EVIL"
    ]);
    return value.split("_").concat(aliases)
        .map((part) => part.toLowerCase())
        .filter((part) => part.length >= 4 && !GENERIC.has(part.toUpperCase()));
}

/**
 * True when a credential token is the whole second level label of the registrable domain, or when
 * the token names a known issuer. A substring of a hyphenated or compound label never pairs, so
 * PLUGGY does not match pluggy-ai.com and EVIL does not match evil.io.
 *
 * @param {string} name Uppercase variable name
 * @param {string} host Host name
 * @returns {boolean} Whether the name is paired with the host
 */
function nameMatchesHost(name, host) {
    const tokens = nameTokens(name);
    if (tokens.length === 0) {
        return false;
    }
    const domain = P.registrableDomain(host);
    const labels = domain ? domain.split(".") : [];
    if (tokens.some((token) => labels.some((label) => label === token))) {
        return true;
    }
    return tokens.some((token) => {
        const issuer = ISSUER_HOSTS[token];
        return issuer && issuer.some((entry) => hostMatches(host, entry));
    });
}

/**
 * True when the first label of a host is exactly a credential token and the remaining suffix is
 * internal or itself paired by another token. An attacker controlled public suffix never pairs.
 *
 * @param {string} host Host name
 * @param {string[]} names Credential variable names in the command
 * @returns {boolean} Whether the first label pairs with the command
 */
function firstLabelPairs(host, names) {
    const parts = String(host ?? "").toLowerCase().split(".");
    if (parts.length < 3 || !names.some((name) => nameTokens(name).includes(parts[0]))) {
        return false;
    }
    const suffix = parts.slice(1).join(".");
    if (P.isInternalHost(suffix)) {
        return true;
    }
    const suffixDomain = P.registrableDomain(suffix);
    const secondLevel = suffixDomain ? suffixDomain.split(".")[0] : "";
    return secondLevel.length > 0 && names.some((name) => nameTokens(name).includes(secondLevel));
}

/**
 * Reason when a secret is only used at its own service: a paired destination, an internal host, or
 * an issuer. Null when the destination is unrelated. The reason also names allowed findings so a
 * credential use is never reported as a file upload or encoded exfiltration.
 *
 * @param {string} text Command text
 * @param {object} state Detector state
 * @returns {"paired"|"internal"|"issuer"|null} Own service reason
 */
function ownServiceContext(text, state) {
    if (P.isPairedDestination(text)) {
        return "paired";
    }
    const hosts = state.hosts ?? [];
    if (hosts.length > 0 && hosts.every(P.isInternalHost)) {
        return "internal";
    }
    if (hosts.length === 0 && P.hasInternalDestination(text)) {
        return "internal";
    }
    // Interpreter code that reads a dotenv file and calls a URL key from the same file uses a
    // destination paired with the credential store.
    if (P.isCodePairedDestination(text)) {
        return "paired";
    }

    // Paired by name: only the whole second level label or a known issuer matches. A value fetched
    // from an internal service and then used at its issuer is the same shape.
    const names = P.credentialVariableNames(text);
    if (hosts.length > 0 && names.length > 0 && hosts.every((host) =>
        P.isInternalHost(host) ||
        names.some((name) => nameMatchesHost(name, host)) ||
        firstLabelPairs(host, names))) {
        return "paired";
    }

    const allowHosts = state.config?.allowHosts ?? [];
    const credentials = credentialMatchesNamed(text);
    if (hosts.length > 0 && credentials.length > 0 && hosts.every((host) =>
        credentials.some((entry) => credentialGoesToIssuer(entry.name, [host], allowHosts)))) {
        return "issuer";
    }

    // A mixed command can contain an independent public fetch and a separate credential use at an
    // internal or paired host. Judge each quote aware segment by the hosts in that segment only.
    const segments = P.splitCommandSegments(text);
    if (segments.length > 1) {
        const sourcedNames = P.dotenvSourcedVariableNames(text);
        const routed = segments.filter((segment) => segmentHasSecret(segment, state, sourcedNames))
            .map((segment) => ({ segment, hosts: P.extractHosts(segment) }))
            .filter((entry) => entry.hosts.length > 0);
        if (routed.length > 0 && routed.every(({ segment, hosts }) => {
            const literals = credentialMatchesNamed(segment);
            return hosts.every((host) => P.isInternalHost(host) ||
                names.some((name) => nameMatchesHost(name, host)) ||
                firstLabelPairs(host, names) ||
                literals.some((entry) => credentialGoesToIssuer(entry.name, [host], allowHosts)));
        })) {
            return routed.every(({ hosts }) => hosts.every(P.isInternalHost)) ? "internal" : "paired";
        }
    }
    return null;
}

/**
 * True when one quote aware segment of a command reads or holds a secret. Used to associate a
 * secret with the destination in its own segment instead of every host named in the whole command.
 *
 * @param {string} segment Command segment
 * @param {object} state Detector state
 * @param {string[]} sourcedNames Variables assigned from a dotenv lookup in the whole command
 * @returns {boolean} Whether the segment contains a secret source
 */
function segmentHasSecret(segment, state, sourcedNames) {
    const variableUse = sourcedNames.some((name) =>
        new RegExp(`\\$(?:\\{)?${name}(?:\\})?\\b`).test(segment));
    return variableUse ||
        P.collectMatches(P.DOTENV, segment).length > 0 ||
        credentialMatchesNamed(segment).length > 0 ||
        secretPathMatches(segment).length > 0 ||
        envDumpMatches(segment).length > 0 ||
        substitutionSources(segment, state).length > 0;
}

/**
 * Creates a network finding. A secret used with its own service is informational; a secret sent to
 * an unrelated public destination keeps the detector's normal severity.
 *
 * @param {object} detector Detector definition
 * @param {string} text Command text
 * @param {object} state Detector state
 * @param {string[]} matches Raw matches
 * @param {boolean} [requireSourced] Whether a dotenv must be sourced rather than uploaded
 * @returns {object} Finding
 */
function networkFinding(detector, text, state, matches, requireSourced = false) {
    const reason = ownServiceContext(text, state);
    const safeContext = reason &&
        (!requireSourced || (P.isSourcedDotenv(text) && !P.isUploadedDotenv(text)));
    if (!safeContext) {
        return finding(detector.id, detector.severity, detector.title, matches);
    }
    const title = `Uses a credential at its own ${reason === "issuer" ? "issuer" : reason === "internal" ? "internal" : "paired"} service`;
    return finding(`credential_use_${reason}`, "low", title, matches);
}

/**
 * True when shell shaped text is only data inside interpreted code. A Python or Node program that
 * reads a secret and sends it with a network API is still checked; a string in the code that merely
 * mentions curl or .env is not a shell command.
 *
 * @param {string} text Command text
 * @returns {boolean} Whether the text is data inside interpreter code
 */
function isCodeData(text) {
    return P.isInterpreterCode(text) && !P.codeReadsAndSends(text);
}

function envDumpMatches(text) {
    return [...P.collectMatches(P.ENV_DUMP, text), ...P.collectMatches(P.ENV_DUMP_SERIALIZE, text)];
}

function encoderMatches(text) {
    return P.collectMatches(P.ENCODER, text);
}

function dnsMatches(text) {
    // A DNS tool named inside a quoted argument, such as a grep pattern ending in |HOST, is data.
    return P.collectMatches(P.DNS_TOOL, P.blankQuoted(text));
}

/**
 * Returns substitution bodies that actually read a secret source. Backticks count only for POSIX
 * shells; in PowerShell they are escape characters.
 *
 * @param {string} text Command text
 * @param {object} state Detector state
 * @returns {string[]} Redacted-by-caller snippets of the substitution bodies
 */
function substitutionSources(text, state) {
    const bodies = [];

    for (const match of text.matchAll(new RegExp(P.SUBSHELL_DOLLAR.source, "gi"))) {
        bodies.push(match[1]);
    }
    if (!P.isPowerShell(text, state)) {
        for (const match of text.matchAll(new RegExp(P.SUBSHELL_BACKTICK.source, "g"))) {
            bodies.push(match[1]);
        }
    }

    const reading = [];
    for (const body of bodies) {
        const fromBody = [
            ...P.collectMatches(P.DOTENV, body),
            ...secretPathMatches(body),
            ...envDumpMatches(body),
            ...credentialMatchesNamed(body).map((entry) => entry.value)
        ];
        reading.push(...fromBody);
    }

    return reading;
}

/**
 * True when interpreter code actually passes a secret to one of its own network calls. A program
 * that reads a dotenv key in one place and uses it with a login tool in another is not sending the
 * dotenv file over the network; rule C judges that use instead.
 *
 * @param {string} text Command text
 * @returns {boolean} Whether a secret reaches a network call in the code
 */
function codeSendsSecret(text) {
    if (!P.isInterpreterCode(text)) {
        return true;
    }
    const lines = String(text ?? "").replace(/\\(["'])/g, "$1")
        .split(/\r?\n|;/).map((line) => line.trim()).filter(Boolean);
    const network = /\b(?:urlopen|urllib\.request|requests\.(?:post|put|patch|request)|fetch\s*\(|http\.request|https\.request|axios\.|Invoke-RestMethod|Invoke-WebRequest)\b/i;
    const secret = /\b(?:open\s*\(\s*['"][^'"]*\.env|readFileSync\s*\([^)]*\.env|Get-Content[^\n]*\.env|process\.env\b|os\.environ\b|dict\s*\(\s*os\.environ|json\.dumps\s*\(\s*os\.environ|JSON\.stringify\s*\(\s*process\.env|Object\.entries\s*\(\s*process\.env)\b/i;
    const names = P.dotenvSourcedVariableNames(text);
    return lines.some((line) => network.test(line) && (
        secret.test(line) || names.some((name) => new RegExp(`\\b${name}\\b`, "i").test(line))
    ));
}

/**
 * Destination hosts named in an ssh style invocation, including one built inside interpreter code.
 *
 * @param {string} text Command text
 * @returns {string[]} Lowercase destination hosts
 */
function sshDestinationHosts(text) {
    const hosts = new Set();
    const source = String(text ?? "");
    for (const match of source.matchAll(/(?:^|[^\w.-])(?:ssh|scp|sftp)\b[^\r\n]{0,240}?([A-Za-z0-9_.-]+)@([A-Za-z0-9_.:-]+)/gi)) {
        hosts.add(match[2].replace(/:.*$/, "").toLowerCase().replace(/["'\x60]+$/, ""));
    }
    return [...hosts];
}

/**
 * The built in detectors. Every `test` returns an array of raw matches, empty when it does not fire.
 * Detectors marked `requiresNetwork` are skipped by the engine when allowHosts suppresses network
 * checks for a call.
 */
export const DETECTORS = [
    {
        id: "env_file_to_network",
        severity: "high",
        title: "Sends a dotenv file over the network",
        requiresNetwork: true,
        test(text, state) {
            if (!state.network || isCodeData(text)) {
                return [];
            }
            const uploaded = P.DOTENV_UPLOAD.test(text);
            if (!uploaded && (!P.codeReadsAndSends(text) || !codeSendsSecret(text))) {
                return [];
            }
            // The dotenv file itself is the payload. Reading one key for auth is credential use and
            // belongs to credential_to_network, which applies the destination rules. Code that
            // reads a secret and sends it applies the destination rules too.
            const matches = dotenvMatches(text);
            return matches.length
                ? [uploaded ? finding(this.id, this.severity, this.title, matches) : networkFinding(this, text, state, matches)]
                : [];
        }
    },
    {
        id: "credential_to_network",
        severity: "high",
        title: "Sends a credential literal over the network",
        requiresNetwork: true,
        test(text, state) {
            if (!state.network || isCodeData(text)) {
                return [];
            }
            const allowHosts = state.config?.allowHosts ?? [];
            let matches = credentialMatchesNamed(text)
                .filter((match) => !credentialGoesToIssuer(match.name, state.hosts ?? [], allowHosts))
                .map((match) => match.value);

            if (matches.length === 0 && P.DOTENV_KEY_USE.test(text) && !ownServiceContext(text, state)) {
                const publicHosts = (state.hosts ?? []).filter((host) => !P.isInternalHost(host));
                const issuerHosts = Object.values(ISSUER_HOSTS).flat();
                const allIssuer = publicHosts.length > 0 && publicHosts.every((host) =>
                    issuerHosts.some((entry) => hostMatches(host, entry)));
                if (publicHosts.length > 0 && !allIssuer) {
                    matches = ["dotenv credential used with a public destination"];
                }
            }

            return matches.length ? [networkFinding(this, text, state, matches)] : [];
        }
    },
    {
        id: "secret_file_to_network",
        severity: "high",
        title: "Sends a local secret store over the network",
        requiresNetwork: true,
        test(text, state) {
            if (!state.network || isCodeData(text)) {
                return [];
            }
            const matches = secretPathMatches(text);
            return matches.length ? [networkFinding(this, text, state, matches)] : [];
        }
    },
    {
        id: "env_dump_to_network",
        severity: "high",
        title: "Sends a full environment dump over the network",
        requiresNetwork: true,
        test(text, state) {
            if (!state.network || isCodeData(text)) {
                return [];
            }
            const matches = envDumpMatches(text);
            return matches.length ? [networkFinding(this, text, state, matches)] : [];
        }
    },
    {
        id: "encoded_exfil",
        severity: "high",
        title: "Encodes secrets for exfiltration or uses DNS exfiltration",
        test(text, state) {
            if (isCodeData(text)) {
                return [];
            }
            const encoded = encoderMatches(text);
            const dns = dnsMatches(text);
            const substitution = substitutionSources(text, state);
            const sources = [...dotenvMatches(text), ...secretPathMatches(text), ...envDumpMatches(text)];

            if (dns.length && substitution.length) {
                return [finding(this.id, this.severity, this.title, [...dns, ...substitution.slice(0, 1)])];
            }

            // In interpreter code, encoding a public fetch is data. The encoder input must itself
            // read a secret before this detector reports obfuscation.
            const encoderInput = P.isInterpreterCode(text) ? P.encoderInputHasSecret(text) : true;
            if (state.network && encoded.length && sources.length && encoderInput) {
                return [networkFinding(this, text, state, [...encoded, ...sources])];
            }

            return [];
        }
    },
    {
        id: "remote_script_exec",
        severity: "medium",
        title: "Downloads and executes a remote script",
        test(text) {
            if (P.isDownloadOnly(text)) {
                return [];
            }
            const matches = P.collectMatches(P.REMOTE_SCRIPT, text);
            return matches.length ? [finding(this.id, this.severity, this.title, matches)] : [];
        }
    },
    {
        id: "login_tool_credential_to_public_host",
        severity: "medium",
        title: "Uses a dotenv credential with a login tool on a non internal host",
        test(text, state) {
            const shellLogin = P.isLoginToolCommand(text);
            const interpreterLogin = /\b(?:subprocess\.(?:run|Popen|call)|os\.system)\s*\(/i.test(text) &&
                /\bssh\b/i.test(text) && P.collectMatches(P.DOTENV, text).length > 0;
            if (!shellLogin && !interpreterLogin) {
                return [];
            }
            const sourced = P.DOTENV_KEY_USE.test(text) ||
                substitutionSources(text, state).length > 0 || interpreterLogin;
            if (!sourced) {
                return [];
            }
            const names = P.credentialVariableNames(text);
            const fromSsh = sshDestinationHosts(text);
            const candidates = fromSsh.length > 0 ? fromSsh : (state.hosts ?? []);
            const hosts = candidates.filter((host) => !P.isInternalHost(host));
            if (hosts.length === 0 || hosts.every((host) => names.some((name) => nameMatchesHost(name, host)) ||
                firstLabelPairs(host, names))) {
                return [];
            }
            return [finding(this.id, this.severity, this.title, hosts.slice(0, 1))];
        }
    },
    {
        id: "read_other_process_env",
        severity: "medium",
        title: "Reads another process environment",
        test(text) {
            const matches = [...P.collectMatches(P.PROC_ENV, text), ...P.collectMatches(P.PS_EWW, text)];
            return matches.length ? [finding(this.id, this.severity, this.title, matches)] : [];
        }
    },
    {
        id: "secret_file_read",
        severity: "low",
        title: "Reads a local secret store",
        test(text, state) {
            if (state.rawNetwork) {
                return [];
            }
            const matches = secretPathMatches(text);
            return matches.length ? [finding(this.id, this.severity, this.title, matches)] : [];
        }
    }
];

/**
 * Detector used only for write tools. Writing a real credential into a file is a leak even with no
 * network client in the call. Placeholder values are examples, not secrets, and are ignored.
 */
export const CREDENTIAL_WRITTEN_TO_FILE = {
    id: "credential_written_to_file",
    severity: "high",
    title: "Writes a credential literal into a file",
    test(text) {
        const matches = credentialMatchesNamed(text)
            .filter((match) => !isFixtureValue(match.value))
            .map((match) => match.value);
        return matches.length ? [finding(this.id, this.severity, this.title, matches)] : [];
    }
};

/**
 * Compiles the optional regex rules from config into detector shaped objects.
 *
 * @param {object[]} rules Extra rule definitions
 * @returns {object[]} Detectors
 */
export function buildCustomDetectors(rules = []) {
    return rules.map((rule) => {
        const pattern = new RegExp(rule.pattern, "i");
        const requires = rule.requires === undefined ? null : new RegExp(rule.requires, "i");

        return {
            id: rule.id,
            severity: rule.severity,
            title: rule.title,
            test(text) {
                const matches = P.collectMatches(pattern, text);
                if (!matches.length || (requires && !requires.test(text))) {
                    return [];
                }
                return [finding(this.id, this.severity, this.title, matches)];
            }
        };
    });
}
