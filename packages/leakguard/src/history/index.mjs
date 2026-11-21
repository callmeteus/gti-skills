import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { defaultConfig } from "../config.mjs";
import { scanText } from "../engine.mjs";
import { makeContext } from "../log.mjs";
import { extractHosts, isWholeDotenvUploadToLoopback } from "../patterns.mjs";
import { classifyTool } from "../toolkind.mjs";
import { extractText } from "../util.mjs";
import { antigravityFileEvents, antigravityJsonlEvents, emitGenericTool } from "./agents/antigravity.mjs";
import { clineJsonEvents } from "./agents/cline.mjs";
import { jsonParse, jsonlEvents, printableStrings, textEvent } from "./agents/common.mjs";
import { extractSqlite } from "./agents/index.mjs";
import { kiroJsonEvents, kiroJsonlEvents } from "./agents/kiro.mjs";
import {
    classifyFixtures, deduplicate, findSecrets, isFixturePath, isLocalHost,
    makeFinding, safe, secretHash, snippet, sortFindings
} from "./findings.mjs";
import { buildRotation, renderJson, renderMarkdown } from "./report.mjs";
import {
    DEFAULT_MAX_FILE_BYTES, TRANSCRIPT_AGENTS, UNCOVERED_TRANSCRIPTS, discover, git, gitEvidence,
    parseSources, projectName, readJsonl, readText, sourceSpecs, storeSpecs
} from "./sources.mjs";
import { DEFAULT_MAX_CELL_CHARS, DEFAULT_MAX_COPY_BYTES, withSqlite } from "./sqlite.mjs";

/** A comment or field must address an agent or model before it is treated as an instruction. */
const ADDRESS = /\b(?:AI|assistant|agent|Claude|Copilot|LLM|ignore previous|before running|you must|do not tell)\b/i;
const ACTION = /\b(?:send|sending|upload|uploading|post|posting|fetch|posting to|run|running|execute|exec|read|curl|wget|invoke|open)\b/i;
const TARGET = /\b(?:https?:\/\/|\.env\b|credential|secret|api[ _-]?key|token|ssh[ _-]?key|password|connection url|file|command)\b/i;

/** Files where comment and manifest string instructions are meaningful. */
const MARKDOWN_FILE = /(?:\.mdx?|\.markdown|README(?:[.\-_]|$))/i;
const LOCKFILE = /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|Cargo\.lock|uv\.lock)$/i;
const SKIP_MANIFEST_FIELD = /^\s*(?:resolved|repository|homepage|bugs|\$schema|funding)\s*:/i;

/** Bidi controls in source code, and zero-width characters inside an instruction. */
const BIDI = /[\u202A-\u202E\u2066-\u2069]/;
const ZERO_WIDTH = /[\u200B-\u200F\uFEFF]/;
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|py|rb|go|rs|java|cs|php|sh|ps1|vue|svelte|swift|kt)$/i;

/**
 * True when a comment or string value addresses an agent AND asks for an action with a target.
 *
 * @param {string} text Candidate text
 * @returns {boolean} Whether it looks like an injected instruction
 */
function isInstruction(text) {
    return ADDRESS.test(text) && ACTION.test(text) && TARGET.test(text);
}

/**
 * Line number of an index in a text.
 *
 * @param {string} text Full text
 * @param {number} index Character index
 * @returns {number} One-based line number
 */
function lineAt(text, index) {
    return text.slice(0, index).split("\n").length;
}

/**
 * Identity of a git repository. A worktree and its main checkout share an identity, so a
 * transcript produced in either one belongs to the same project.
 *
 * @param {string} path Directory path
 * @returns {string} Lowercase identity
 */
function repoIdentity(path) {
    if (!existsSync(path)) {
        return resolve(path).toLowerCase();
    }
    const result = git(["rev-parse", "--git-common-dir"], path);
    if (result.ok && result.stdout.trim()) {
        return resolve(path, result.stdout.trim()).toLowerCase();
    }
    return resolve(path).toLowerCase();
}

/**
 * Runs the package detectors over a piece of text without logging or changing state. A finding at
 * the default deny severity means the guard would have denied the tool call or shell line.
 *
 * @param {string} text Text to inspect
 * @param {object} ctx History context
 * @param {object} [meta] Source metadata with the originating tool and agent
 * @returns {{ denied: boolean, detectorIds: string[], evidence: string, remote: boolean, severity?: string, note?: string }} Summary
 */
function analyze(text, ctx, meta = {}) {
    const detections = scanText(text, {
        config: defaultConfig(),
        ctx,
        tool: meta.tool ?? "",
        agent: meta.agent ?? ""
    });
    const denied = detections.some((finding) => finding.severity === "high");
    const hosts = extractHosts(text);
    const remote = hosts.some((host) => !isLocalHost(host));
    // A whole dotenv upload to loopback is the guard's own proof run. The live guard still denies
    // it, but history reports it as low with a note instead of a critical remote exfiltration.
    const loopbackUpload = isWholeDotenvUploadToLoopback(text);

    return {
        denied,
        detectorIds: [...new Set(detections.map((finding) => finding.id))],
        evidence: snippet(text, 400),
        remote,
        severity: loopbackUpload ? "low" : undefined,
        note: loopbackUpload ? "loopback destination" : undefined
    };
}

/**
 * Creates one `secret_exposed` finding for each distinct credential in a text.
 *
 * @param {string} text Text to inspect
 * @param {object} meta Source metadata
 * @param {object[]} sink Finding sink
 */
function collectSecrets(text, meta, sink) {
    for (const secret of findSecrets(text, meta.location)) {
        sink.push(makeFinding({
            kind: "secret_exposed",
            severity: secret.severity,
            title: secret.local
                ? `${secret.name} credential with a local or placeholder destination`
                : `${secret.name} credential exposed`,
            source: meta.source,
            location: meta.location,
            line: meta.line ?? null,
            time: meta.time ?? null,
            sameRepo: meta.sameRepo === true,
            evidence: secret.name === "url-password"
                ? `URL password for host ${secret.host ?? "unknown"}${secret.local ? " (local or placeholder)" : ""}`
                : snippet(text, 200),
            secretType: secret.name,
            secretHash: secret.hash,
            secretRedacted: secret.redacted,
            host: secret.host,
            local: secret.local,
            note: secret.note,
            fixtureValue: secret.fixtureValue,
            fixturePath: secret.fixturePath,
            detectorIds: ["credential-literal"]
        }));
    }
}

/**
 * Creates an exfiltration finding when the detectors would deny a tool call or shell line.
 *
 * @param {string} text Text to inspect
 * @param {object} meta Source metadata
 * @param {object[]} sink Finding sink
 * @returns {object|null} Created finding
 */
function collectExfil(text, meta, sink) {
    const result = analyze(text, meta.ctx, meta);
    if (!result.denied) {
        return null;
    }

    const finding = makeFinding({
        kind: "exfil_executed",
        severity: result.severity ?? (meta.executed ? "critical" : "high"),
        title: result.remote
            ? "Tool call or shell line exfiltrates to a remote host"
            : "Tool call or shell line matches a secret exfiltration detector",
        source: meta.source,
        location: meta.location,
        line: meta.line ?? null,
        time: meta.time ?? null,
        evidence: result.evidence,
        remote: result.remote,
        note: result.note ?? null,
        executed: meta.executed === true,
        detectorIds: result.detectorIds
    });
    sink.push(finding);
    return finding;
}

/**
 * Returns the coverage record for an agent, creating it on first use.
 *
 * @param {object} tracker Report tracker
 * @param {string} agent Agent id
 * @returns {object} Coverage record
 */
function coverageFor(tracker, agent) {
    if (!tracker.coverage[agent]) {
        tracker.coverage[agent] = {
            agent,
            storesFound: [],
            rowsRead: 0,
            sessions: 0,
            skipped: [],
            note: ""
        };
    }
    return tracker.coverage[agent];
}

/**
 * Scans normalized events produced by SQLite and flat file extractors. Text events can only yield
 * secrets. Tool events can yield an exfiltration only when the tool is a shell tool, and that
 * exfiltration is critical only when the store itself showed the tool ran.
 *
 * @param {object[]} events Normalized events
 * @param {object} meta Base source metadata
 * @param {object} tracker Report tracker
 * @returns {void}
 */
function consumeEvent(event, meta, tracker) {
    if (!event || typeof event !== "object") {
        return;
    }
    if (event.kind === "text") {
        if (typeof event.text === "string" && event.text) {
            collectSecrets(event.text, { ...meta, time: event.time ?? meta.time, line: null }, tracker.findings);
        }
        return;
    }
    if (event.kind !== "tool") {
        return;
    }
    const input = event.input ?? {};
    collectSecrets(extractText(input), { ...meta, time: event.time ?? meta.time, line: null }, tracker.findings);
    if (classifyTool(event.name, input).kind !== "shell") {
        return;
    }
    const text = `${event.name}\n${extractText(input)}`;
    collectExfil(text, {
        ...meta,
        time: event.time ?? meta.time,
        tool: event.name,
        executed: event.executed === true
    }, tracker.findings);
}

/**
 * Scans a list of normalized events.
 *
 * @param {object[]} events Normalized events
 * @param {object} meta Base source metadata
 * @param {object} tracker Report tracker
 * @returns {void}
 */
function consumeEvents(events, meta, tracker) {
    for (const event of events) {
        consumeEvent(event, meta, tracker);
    }
}

/**
 * Looks for hidden instructions in Markdown comments, manifest string values and invisible
 * characters.
 *
 * @param {string} text File content
 * @param {object} meta Source metadata
 * @param {object[]} sink Finding sink
 */
function collectInjection(text, meta, sink) {
    const name = meta.location.split("/").pop() ?? "";

    if (MARKDOWN_FILE.test(name)) {
        for (const match of text.matchAll(/<!--([\s\S]{0,4000}?)-->/g)) {
            if (!isInstruction(match[1])) {
                continue;
            }
            sink.push(makeFinding({
                kind: "injection_found",
                severity: "medium",
                title: "Hidden instruction in a Markdown comment",
                source: meta.source,
                location: meta.location,
                line: lineAt(text, match.index ?? 0),
                evidence: snippet(match[1], 200),
                detectorIds: ["html-comment"]
            }));
        }
    }

    if (!LOCKFILE.test(name) && /\.(?:json|ya?ml|toml)$/i.test(name)) {
        const lines = text.split("\n");
        lines.forEach((line, index) => {
            const match = line.match(/^\s*([\w$.-]+)\s*:\s*["']([^"']{12,})["']/);
            if (!match || SKIP_MANIFEST_FIELD.test(match[1]) || !isInstruction(match[2])) {
                return;
            }
            sink.push(makeFinding({
                kind: "injection_found",
                severity: "medium",
                title: "Hidden instruction in a manifest string field",
                source: meta.source,
                location: meta.location,
                line: index + 1,
                evidence: snippet(match[2], 200),
                detectorIds: ["manifest-string"]
            }));
        });
    }

    if (isFixturePath(meta.location)) {
        return;
    }

    if (BIDI.test(text) && SOURCE_FILE.test(name)) {
        const index = text.search(BIDI);
        sink.push(makeFinding({
            kind: "injection_found",
            severity: "medium",
            title: "Bidi control character in a source file",
            source: meta.source,
            location: meta.location,
            line: lineAt(text, index),
            evidence: `bidi character ${JSON.stringify(text[index])} in ${snippet(text.slice(Math.max(0, index - 40), index + 40), 120)}`,
            detectorIds: ["bidi-control"]
        }));
        return;
    }

    if (ZERO_WIDTH.test(text)) {
        const index = text.search(ZERO_WIDTH);
        const around = text.slice(Math.max(0, index - 240), index + 240);
        if (isInstruction(around)) {
            sink.push(makeFinding({
                kind: "injection_found",
                severity: "medium",
                title: "Zero-width character inside an agent instruction",
                source: meta.source,
                location: meta.location,
                line: lineAt(text, index),
                evidence: `zero-width character ${JSON.stringify(text[index])} in ${snippet(around, 160)}`,
                detectorIds: ["zero-width-in-instruction"]
            }));
        }
    }
}

/**
 * Extracts content blocks from a transcript message.
 *
 * @param {unknown} content Message content
 * @returns {object[]} Content blocks
 */
function blocksOf(content) {
    return Array.isArray(content) ? content.filter((item) => item && typeof item === "object") : [];
}

/**
 * Scans transcript JSONL files. A denied call is critical when a matching tool result shows that
 * the tool actually ran; otherwise it is high, meaning it was only requested.
 *
 * @param {object} ctx History context
 * @param {object[]} specs Transcript source specs
 * @param {number|null} cutoffMs Age cutoff
 * @param {number} maxBytes Per-file cap
 * @param {string} repoId Git identity of the repository being scanned
 * @param {object} tracker Report trackers
 */
async function scanTranscripts(ctx, specs, cutoffMs, maxBytes, repoId, tracker) {
    const toolUses = new Map();
    const results = new Set();
    const identityCache = new Map();
    const identityFor = (cwd) => {
        if (!identityCache.has(cwd)) {
            identityCache.set(cwd, repoIdentity(cwd));
        }
        return identityCache.get(cwd);
    };

    for (const spec of specs) {
        const found = discover(spec, cutoffMs, maxBytes);
        tracker.merge(found, spec.id);
        const cov = coverageFor(tracker, spec.agent ?? spec.id);
        for (const entry of found.skipped) {
            cov.skipped.push({ path: entry.path, reason: entry.reason });
        }

        for (const file of found.files) {
            tracker.countFile("transcripts");
            cov.storesFound.push(file);
            await readJsonl(file, (record, line, raw) => {
                cov.rowsRead += 1;
                const recordCwd = typeof record.cwd === "string" ? record.cwd : "";
                const sameRepo = recordCwd !== "" && identityFor(recordCwd) === repoId;
                const meta = {
                    ctx,
                    source: "transcripts",
                    location: file,
                    line,
                    time: typeof record.timestamp === "string" ? record.timestamp : null,
                    sameRepo
                };
                collectSecrets(raw, meta, tracker.findings);

                const content = record.message && typeof record.message === "object"
                    ? record.message.content
                    : null;

                for (const block of blocksOf(content)) {
                    if (block.type === "tool_use" && typeof block.id === "string") {
                        const name = typeof block.name === "string" ? block.name : "";
                        const input = block.input ?? {};
                        // Only shell tool calls can execute an exfiltration command. A write that
                        // documents a command, or a read or fetch tool, is not an executed exfil.
                        if (classifyTool(name, input).kind === "shell") {
                            const text = `${name}\n${extractText(input)}`;
                            const callMeta = { ...meta, tool: name };
                            const finding = collectExfil(text, callMeta, tracker.findings);
                            if (finding) {
                                toolUses.set(`${file}:${block.id}`, finding);
                            }
                        }
                    } else if (block.type === "tool_result" && typeof block.tool_use_id === "string") {
                        results.add(`${file}:${block.tool_use_id}`);
                    }
                }
            });
        }
    }

    for (const [key, finding] of toolUses) {
        if (results.has(key)) {
            finding.executed = true;
            // A downgraded loopback proof run stays low even when the transcript shows it ran.
            if (finding.severity !== "low") {
                finding.severity = "critical";
            }
            for (const occurrence of finding.occurrences) {
                occurrence.executed = true;
            }
        }
    }
}

/**
 * Builds the JSONL mapper for a non-Claude agent store.
 *
 * @param {string} agent Agent id
 * @returns {(record: object) => object[]} Mapper
 */
function jsonlAgentMapper(agent) {
    return (record) => {
        if (agent === "antigravity") {
            return antigravityJsonlEvents(record);
        }
        if (agent === "kiro") {
            return kiroJsonlEvents(record);
        }
        const events = [];
        for (const field of ["content", "message", "text", "prompt"]) {
            const value = record[field];
            if (typeof value === "string" && value) {
                events.push(textEvent(value));
            } else if (value && typeof value === "object") {
                events.push(textEvent(extractText(value)));
            }
        }
        const calls = record.toolUses ?? record.toolCalls ?? record.tool_calls ?? record.tools;
        if (Array.isArray(calls)) {
            for (const call of calls) {
                emitGenericTool(call, (event) => events.push(event));
            }
        }
        return events;
    };
}

/**
 * Turns a flat file in a known agent folder into normalized events.
 *
 * @param {object} spec Store spec
 * @param {string} file File path
 * @param {string} text File contents
 * @returns {object[]} Events
 */
function agentFileEvents(spec, file, text) {
    const lower = file.toLowerCase();
    if (spec.format === "jsonl") {
        return jsonlEvents(text, jsonlAgentMapper(spec.agent));
    }
    if (spec.format === "json") {
        if (spec.agent === "cline" || spec.agent === "kilo") {
            return clineJsonEvents(jsonParse(text));
        }
        if (spec.agent === "kiro") {
            return kiroJsonEvents(text);
        }
        const data = jsonParse(text);
        return data ? [textEvent(JSON.stringify(data))] : [];
    }
    if (lower.endsWith(".jsonl")) {
        return jsonlEvents(text, jsonlAgentMapper(spec.agent));
    }
    if (lower.endsWith(".json")) {
        if (spec.agent === "kiro") {
            return kiroJsonEvents(text);
        }
        const data = jsonParse(text);
        return data ? [textEvent(JSON.stringify(data))] : [];
    }
    if (lower.endsWith(".pb") || lower.endsWith(".pbtxt") || lower.endsWith(".md")) {
        return antigravityFileEvents(text, lower.slice(lower.lastIndexOf(".")));
    }
    return text && text.trim() ? [textEvent(text)] : [];
}

/**
 * Scans SQLite and flat file chat stores for every supported agent. Coverage records what was
 * found, what was read, and what was skipped with a reason.
 *
 * @param {object} ctx History context
 * @param {object[]} specs Store specs
 * @param {number|null} cutoffMs Age cutoff
 * @param {object} tracker Report tracker
 * @param {object} options Scan options
 * @returns {Promise<void>} Completion
 */
async function scanAgentStores(ctx, specs, cutoffMs, tracker, options) {
    for (const spec of specs) {
        const found = discover(spec, cutoffMs, options.maxFileBytes);
        tracker.merge(found, spec.id);
        const cov = coverageFor(tracker, spec.agent);
        for (const entry of found.skipped) {
            cov.skipped.push({ path: entry.path, reason: entry.reason });
        }

        for (const file of found.files) {
            tracker.countFile("transcripts");
            cov.storesFound.push(file);
            const meta = {
                ctx,
                source: "transcripts",
                location: file,
                line: null,
                time: null,
                sameRepo: false
            };

            if (spec.format === "sqlite") {
                const result = await withSqlite(file, (db, stats) => {
                    extractSqlite(spec.agent, db, stats, (event) => consumeEvent(event, meta, tracker), options.maxCellChars);
                }, {
                    maxCellChars: options.maxCellChars,
                    maxCopyBytes: options.maxCopyBytes,
                    forceUnavailable: options.sqliteUnavailable === true
                });

                if (!result.ok) {
                    const reason = result.reason === "node:sqlite unavailable"
                        ? "node:sqlite unavailable"
                        : `sqlite read failed: ${result.reason}`;
                    tracker.skipped.push({ source: "transcripts", path: file, reason });
                    cov.skipped.push({ path: file, reason });
                    if (!cov.note) {
                        cov.note = reason;
                    }
                    continue;
                }

                cov.rowsRead += result.stats.rows;
                cov.sessions += result.stats.sessionIds.size;
                if (result.stats.skippedCells > 0) {
                    const reason = "cell exceeds size cap";
                    tracker.skipped.push({ source: "transcripts", path: file, reason, count: result.stats.skippedCells });
                    cov.skipped.push({ path: file, reason, count: result.stats.skippedCells });
                }
                if (result.stats.note && !cov.note) {
                    cov.note = result.stats.note;
                }
                continue;
            }

            let text = readText(file);
            if (text === null && /\.pb$/i.test(file)) {
                try {
                    text = printableStrings(readFileSync(file));
                } catch {
                    text = null;
                }
            }
            if (text === null) {
                const reason = "binary or unreadable";
                tracker.skipped.push({ source: "transcripts", path: file, reason });
                cov.skipped.push({ path: file, reason });
                continue;
            }
            if (spec.format === "jsonl") {
                cov.rowsRead += text.split("\n").filter(Boolean).length;
            } else {
                cov.rowsRead += 1;
            }
            consumeEvents(agentFileEvents(spec, file, text), meta, tracker);
        }
    }
}

/**
 * Scans shell history files. Every line in a history file is treated as executed.
 *
 * @param {object} ctx History context
 * @param {object[]} specs Shell source specs
 * @param {number|null} cutoffMs Age cutoff
 * @param {number} maxBytes Per-file cap
 * @param {object} tracker Report trackers
 */
function scanShell(ctx, specs, cutoffMs, maxBytes, tracker) {
    for (const spec of specs) {
        const found = discover(spec, cutoffMs, maxBytes);
        tracker.merge(found, spec.id);

        for (const file of found.files) {
            tracker.countFile("shell");
            const text = readText(file);
            if (text === null) {
                tracker.skipped.push({ source: "shell", path: file, reason: "binary or unreadable" });
                continue;
            }
            const lines = text.split("\n");
            lines.forEach((line, index) => {
                if (!line.trim()) {
                    return;
                }
                const meta = {
                    ctx,
                    source: "shell",
                    location: file,
                    line: index + 1,
                    executed: true,
                    tool: "shell"
                };
                collectExfil(line, meta, tracker.findings);
                collectSecrets(line, meta, tracker.findings);
            });
        }
    }
}

/**
 * Scans earlier guard decisions. Event text is already redacted when the guard writes it.
 *
 * @param {object} ctx History context
 * @param {object[]} specs Guard source specs
 * @param {number|null} cutoffMs Age cutoff
 * @param {number} maxBytes Per-file cap
 * @param {object} tracker Report trackers
 */
async function scanGuard(ctx, specs, cutoffMs, maxBytes, tracker) {
    for (const spec of specs) {
        const found = discover(spec, cutoffMs, maxBytes);
        tracker.merge(found, spec.id);

        for (const file of found.files) {
            tracker.countFile("guard");
            await readJsonl(file, (event, line) => {
                if (!event.decision || event.decision === "allow") {
                    return;
                }
                tracker.findings.push(makeFinding({
                    kind: "guard_event",
                    severity: "info",
                    title: `Earlier guard decision: ${event.decision}`,
                    source: "guard",
                    location: file,
                    line,
                    time: typeof event.time === "string" ? event.time : null,
                    evidence: snippet(safe(event.text ?? ""), 200),
                    detectorIds: Array.isArray(event.detectors) ? event.detectors : []
                }));
            });
        }
    }
}

/**
 * Scans committed and tracked content in a repository, including dotenv files that were once
 * committed but are no longer tracked.
 *
 * @param {object} ctx History context
 * @param {string} repo Repository path
 * @param {number|null} sinceDays Age window
 * @param {number} maxBytes Per-file cap
 * @param {boolean} injection Whether injection scanning was requested
 * @param {object} tracker Report trackers
 */
function scanGit(ctx, repo, sinceDays, maxBytes, injection, tracker) {
    const evidence = gitEvidence(repo, sinceDays, maxBytes);
    tracker.skipped.push(...evidence.skipped);
    tracker.errors.push(...evidence.errors);

    if (evidence.addedLines.length > 0 || evidence.tracked.length > 0 || evidence.envBlobs.length > 0) {
        tracker.countFile("git");
    }

    for (const added of evidence.addedLines) {
        // Committed source lines are not shell tool calls or shell history lines, so they cannot
        // produce an exfil_executed finding. Credentials in them are still reported.
        const meta = { ctx, source: "git", location: added.file, line: null, executed: false, tool: "" };
        collectSecrets(added.text, meta, tracker.findings);
        if (injection) {
            collectInjection(added.text, meta, tracker.findings);
        }
    }

    const seen = new Set();

    for (const path of evidence.tracked) {
        seen.add(path);
        const absolute = resolve(repo, path);
        const text = readText(absolute);
        if (text === null) {
            continue;
        }
        const meta = { ctx, source: "git", location: path, line: null, executed: false, tool: "shell" };
        collectSecrets(text, meta, tracker.findings);
        if (injection) {
            collectInjection(text, meta, tracker.findings);
        }
    }

    for (const blob of evidence.envBlobs) {
        if (seen.has(blob.path)) {
            continue;
        }
        const meta = { ctx, source: "git", location: blob.path, line: null, executed: false, tool: "shell" };
        collectSecrets(blob.text, meta, tracker.findings);
        if (injection) {
            collectInjection(blob.text, meta, tracker.findings);
        }
    }
}

/**
 * Runs a read only leak scan over local history sources and writes `history.json` and `history.md`
 * into the output folder. No network is used, no credential is printed in full, and no repository
 * or agent config is modified.
 *
 * @param {object} [options] Options
 * @param {object} [options.ctx] Context from `makeContext`; defaults to the process environment
 * @param {string} [options.sources] Comma separated source ids
 * @param {number|string} [options.since] Age window in days
 * @param {string} [options.repo] Repository path, defaults to the context cwd
 * @param {string} [options.out] Output folder
 * @param {number} [options.maxFileBytes] Per-file size cap for non-transcript files, mainly for tests
 * @param {number} [options.maxCellChars] Per-cell cap for SQLite stores
 * @param {number} [options.maxCopyBytes] Larger SQLite stores are opened read only in place
 * @param {boolean} [options.sqliteUnavailable] Simulate a Node without node:sqlite, for tests
 * @returns {Promise<{ report: object, out: string, findings: object[] }>} Scan result
 */
export async function scanHistory(options = {}) {
    const ctx = options.ctx ?? makeContext({});
    const parsed = parseSources(options.sources);
    const sinceDays = options.since === undefined || options.since === null || options.since === ""
        ? null
        : Number(options.since);
    if (sinceDays !== null && (!Number.isFinite(sinceDays) || sinceDays < 0)) {
        throw new Error("history: --since must be a non-negative number of days");
    }

    const repo = resolve(options.repo ?? ctx.cwd);
    const out = resolve(options.out ?? join(ctx.stateDir, projectName(repo)));
    const maxBytes = Number.isFinite(options.maxFileBytes) ? options.maxFileBytes : DEFAULT_MAX_FILE_BYTES;
    const cutoffMs = sinceDays === null ? null : Date.now() - sinceDays * 24 * 60 * 60 * 1000;
    const specs = sourceSpecs(ctx);
    const repoId = repoIdentity(repo);

    const fileCounts = Object.fromEntries(parsed.selected.map((id) => [id, 0]));
    const skipCounts = Object.fromEntries(parsed.selected.map((id) => [id, 0]));
    const tracker = {
        findings: [],
        missing: [],
        skipped: [],
        errors: [],
        coverage: {},
        merge(found, source) {
            this.missing.push(...found.missing);
            this.skipped.push(...found.skipped);
            if (found.files.length > 0 && source in fileCounts) {
                fileCounts[source] += found.files.length;
            }
            if (found.skipped.length > 0 && source in skipCounts) {
                skipCounts[source] += found.skipped.length;
            }
        },
        countFile(source) {
            if (source in fileCounts) {
                fileCounts[source] += 1;
            }
        }
    };

    if (parsed.selected.includes("transcripts")) {
        await scanTranscripts(ctx, specs.transcripts, cutoffMs, maxBytes, repoId, tracker);
        await scanAgentStores(ctx, storeSpecs(ctx), cutoffMs, tracker, {
            maxFileBytes: maxBytes,
            maxCellChars: Number.isFinite(options.maxCellChars) ? options.maxCellChars : DEFAULT_MAX_CELL_CHARS,
            maxCopyBytes: Number.isFinite(options.maxCopyBytes) ? options.maxCopyBytes : DEFAULT_MAX_COPY_BYTES,
            sqliteUnavailable: options.sqliteUnavailable === true
        });
    }
    if (parsed.selected.includes("shell")) {
        scanShell(ctx, specs.shell, cutoffMs, maxBytes, tracker);
    }
    if (parsed.selected.includes("guard")) {
        await scanGuard(ctx, specs.guard, cutoffMs, maxBytes, tracker);
    }
    if (parsed.selected.includes("git") || parsed.selected.includes("injection")) {
        scanGit(ctx, repo, sinceDays, maxBytes, parsed.selected.includes("injection"), tracker);
    }

    const findings = sortFindings(classifyFixtures(deduplicate(tracker.findings)));
    const coverage = TRANSCRIPT_AGENTS.map((agent) => {
        const current = tracker.coverage[agent] ?? {
            agent,
            storesFound: [],
            rowsRead: 0,
            sessions: 0,
            skipped: [],
            note: ""
        };
        if (current.storesFound.length === 0 && !current.note) {
            current.note = "no store present on this machine";
        }
        if (agent === "kiro" && current.storesFound.length > 0) {
            current.note = current.note
                ? `${current.note}; kiro store format is unverified`
                : "kiro store format is unverified";
        }
        return current;
    });
    const byKind = {};
    const bySource = {};
    const bySeverity = {};
    for (const finding of findings) {
        byKind[finding.kind] = (byKind[finding.kind] ?? 0) + 1;
        bySource[finding.source] = (bySource[finding.source] ?? 0) + 1;
        bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
    }

    const report = {
        generatedAt: new Date().toISOString(),
        options: { sources: parsed.selected, sinceDays, repo, out },
        sources: {
            requested: parsed.selected,
            unknown: parsed.unknown,
            scanned: parsed.selected.map((id) => ({ source: id, files: fileCounts[id] ?? 0, skipped: skipCounts[id] ?? 0 })),
            missing: tracker.missing,
            uncovered: parsed.selected.includes("transcripts") ? [...UNCOVERED_TRANSCRIPTS] : [],
            coverage: parsed.selected.includes("transcripts") ? coverage : [],
            skipped: tracker.skipped,
            errors: tracker.errors
        },
        counts: {
            findings: findings.length,
            byKind,
            bySource,
            bySeverity,
            skippedFiles: tracker.skipped.length
        },
        findings,
        rotation: buildRotation(findings)
    };

    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "history.json"), renderJson(report), "utf8");
    writeFileSync(join(out, "history.md"), renderMarkdown(report), "utf8");

    return { report, out, findings };
}

export { secretHash, safe };
