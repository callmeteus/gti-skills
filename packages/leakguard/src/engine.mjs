import { defaultConfig, loadConfig } from "./config.mjs";
import { appendEvent, makeContext } from "./log.mjs";
import { extractHosts, hasNetworkClient } from "./patterns.mjs";
import { DETECTORS, buildCustomDetectors } from "./rules.mjs";
import { extractText, lineOf, rank, redact } from "./util.mjs";

/**
 * Normalizes a tool call from any agent into the shape the engine expects.
 *
 * @param {{ tool?: string, input?: unknown, cwd?: string, agent?: string, ctx?: object }} call Raw call
 * @returns {{ tool: string, input: unknown, text: string, cwd: string, agent: string, ctx: object }} Normalized call
 */
export function normalize(call = {}) {
    const ctx = makeContext(call.ctx ?? {});
    const tool = typeof call.tool === "string" ? call.tool : "";

    return {
        tool,
        input: call.input ?? call,
        text: extractText(call.input ?? call),
        cwd: call.cwd ?? ctx.cwd,
        agent: typeof call.agent === "string" ? call.agent : "unknown",
        ctx
    };
}

/**
 * True when every host present in the text is on the allow list. With no hosts present, the
 * policy does not suppress anything.
 *
 * @param {string} text Inspected text
 * @param {string[]} allowHosts Allowed hosts
 * @returns {boolean} Whether network detectors should be suppressed
 */
export function hostsAllowed(text, allowHosts = []) {
    if (!Array.isArray(allowHosts) || allowHosts.length === 0) {
        return false;
    }

    const hosts = extractHosts(text);
    if (hosts.length === 0) {
        return false;
    }

    return hosts.every((host) => allowHosts.some((allowed) => {
        const entry = allowed.toLowerCase();
        return host === entry || host.endsWith(`.${entry}`);
    }));
}

/**
 * Builds a reason string from finding titles only. No secret value ever enters this string.
 *
 * @param {object[]} findings Findings
 * @param {string} decision Decision
 * @returns {string} Reason
 */
function buildReason(findings, decision) {
    if (findings.length === 0) {
        return "Leakguard allowed this tool call.";
    }

    const titles = findings.map((finding) => finding.title).join("; ");
    const verb = decision === "deny" ? "Blocked" : decision === "ask" ? "Flagged" : "Would block";

    return `Leakguard ${verb.toLowerCase()}: ${titles}.`;
}

/**
 * Evaluates a normalized tool call against config and all detectors, logs when required and
 * returns the decision. Internal failures are not expected here; the hook entry point fail opens.
 *
 * @param {{ tool?: string, input?: unknown, cwd?: string, agent?: string, ctx?: object }} call Tool call
 * @param {{ config?: object, configSource?: { config: object, warnings?: object[] } }} [options] Overrides
 * @returns {{ decision: string, policyDecision: string, severity: string|null, findings: object[], detectorIds: string[], reason: string, agent: string, tool: string, cwd: string }} Result
 */
export function evaluate(call = {}, options = {}) {
    const normalized = normalize(call);
    const { text, ctx } = normalized;
    const loaded = options.configSource ?? loadConfig(ctx);
    const config = options.config ?? loaded.config;

    for (const warning of loaded.warnings ?? []) {
        appendEvent({
            time: new Date().toISOString(),
            type: "config-warning",
            path: warning.path,
            message: warning.message
        }, ctx);
    }

    const suppressNetwork = hostsAllowed(text, config.allowHosts);
    const rawNetwork = hasNetworkClient(text);
    const state = {
        network: rawNetwork && !suppressNetwork,
        rawNetwork,
        suppressNetwork,
        hosts: extractHosts(text),
        cwd: normalized.cwd,
        tool: normalized.tool,
        agent: normalized.agent,
        config
    };

    const disabled = new Set(Array.isArray(config.disable) ? config.disable : []);
    const detectors = [...DETECTORS, ...buildCustomDetectors(config.rules)];
    const findings = [];

    for (const detector of detectors) {
        if (disabled.has(detector.id) || (detector.requiresNetwork && suppressNetwork)) {
            continue;
        }

        const found = detector.test(text, state) ?? [];
        findings.push(...found);
    }

    let top = null;
    for (const finding of findings) {
        if (!top || rank(finding.severity) > rank(top.severity)) {
            top = finding;
        }
    }

    const severity = top ? top.severity : null;
    const policyDecision = severity ? (config.severity[severity] ?? "allow") : "allow";
    const decision = config.mode === "log-only" ? "allow" : policyDecision;
    const detectorIds = findings.map((finding) => finding.id);
    const result = {
        decision,
        policyDecision,
        severity,
        findings: findings.map(({ id, severity: level, title }) => ({ id, severity: level, title })),
        detectorIds,
        reason: buildReason(findings, decision),
        agent: normalized.agent,
        tool: normalized.tool,
        cwd: normalized.cwd
    };

    const logAll = ctx.env.GTI_LEAKGUARD_LOG === "all";
    if (logAll || policyDecision !== "allow") {
        appendEvent({
            time: new Date().toISOString(),
            agent: normalized.agent,
            cwd: normalized.cwd,
            tool: normalized.tool,
            detectors: detectorIds,
            severity,
            decision,
            policyDecision,
            mode: config.mode,
            text: redact(text)
        }, ctx);
    }

    return result;
}

/**
 * Runs every detector over a piece of text for retrospective scanning. Findings carry redacted
 * evidence and a line number, so callers can safely print them.
 *
 * @param {string|unknown} text Text or tool input to scan
 * @param {{ config?: object, ctx?: object, disable?: string[], tool?: string, agent?: string }} [opts] Options
 * @returns {{ id: string, severity: string, title: string, evidence: string[], line: number|null }[]} Findings
 */
export function scanText(text, opts = {}) {
    const source = typeof text === "string" ? text : extractText(text);
    const ctx = makeContext(opts.ctx ?? {});
    const config = opts.config ?? defaultConfig();
    const suppressNetwork = hostsAllowed(source, config.allowHosts);
    const rawNetwork = hasNetworkClient(source);
    const state = {
        network: rawNetwork && !suppressNetwork,
        rawNetwork,
        suppressNetwork,
        hosts: extractHosts(source),
        cwd: ctx.cwd,
        tool: typeof opts.tool === "string" ? opts.tool : "",
        agent: typeof opts.agent === "string" ? opts.agent : "",
        config
    };

    const disabled = new Set(opts.disable ?? config.disable ?? []);
    const detectors = [...DETECTORS, ...buildCustomDetectors(config.rules ?? [])];
    const findings = [];

    for (const detector of detectors) {
        if (disabled.has(detector.id) || (detector.requiresNetwork && suppressNetwork)) {
            continue;
        }

        const found = detector.test(source, state) ?? [];
        for (const finding of found) {
            for (const match of finding.matches) {
                findings.push({
                    id: finding.id,
                    severity: finding.severity,
                    title: finding.title,
                    evidence: [redact(match)],
                    line: lineOf(source, match)
                });
            }
        }
    }

    return findings;
}

export { defaultConfig, loadConfig };
