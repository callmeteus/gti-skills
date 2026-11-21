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

function credentialMatches(text) {
    return allMatches(P.CREDENTIALS, text);
}

function envDumpMatches(text) {
    return P.collectMatches(P.ENV_DUMP, text);
}

function encoderMatches(text) {
    return P.collectMatches(P.ENCODER, text);
}

function dnsMatches(text) {
    return P.collectMatches(P.DNS_TOOL, text);
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
            if (!state.network) {
                return [];
            }
            const matches = dotenvMatches(text);
            return matches.length ? [finding(this.id, this.severity, this.title, matches)] : [];
        }
    },
    {
        id: "credential_to_network",
        severity: "high",
        title: "Sends a credential literal over the network",
        requiresNetwork: true,
        test(text, state) {
            if (!state.network) {
                return [];
            }
            const matches = credentialMatches(text);
            return matches.length ? [finding(this.id, this.severity, this.title, matches)] : [];
        }
    },
    {
        id: "secret_file_to_network",
        severity: "high",
        title: "Sends a local secret store over the network",
        requiresNetwork: true,
        test(text, state) {
            if (!state.network) {
                return [];
            }
            const matches = secretPathMatches(text);
            return matches.length ? [finding(this.id, this.severity, this.title, matches)] : [];
        }
    },
    {
        id: "env_dump_to_network",
        severity: "high",
        title: "Sends a full environment dump over the network",
        requiresNetwork: true,
        test(text, state) {
            if (!state.network) {
                return [];
            }
            const matches = envDumpMatches(text);
            return matches.length ? [finding(this.id, this.severity, this.title, matches)] : [];
        }
    },
    {
        id: "encoded_exfil",
        severity: "high",
        title: "Encodes secrets for exfiltration or uses DNS exfiltration",
        test(text, state) {
            const encoded = encoderMatches(text);
            const dns = dnsMatches(text);
            const substitution = P.collectMatches(P.SUBSHELL, text);
            const sources = [...dotenvMatches(text), ...secretPathMatches(text), ...envDumpMatches(text)];

            if (dns.length && substitution.length) {
                return [finding(this.id, this.severity, this.title, [...dns, ...substitution.slice(0, 1)])];
            }

            if (state.network && encoded.length && sources.length) {
                return [finding(this.id, this.severity, this.title, [...encoded, ...sources])];
            }

            return [];
        }
    },
    {
        id: "remote_script_exec",
        severity: "medium",
        title: "Downloads and executes a remote script",
        test(text) {
            const matches = P.collectMatches(P.REMOTE_SCRIPT, text);
            return matches.length ? [finding(this.id, this.severity, this.title, matches)] : [];
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
