import { readFileSync } from "node:fs";

import { configPaths } from "./log.mjs";

const DECISIONS = new Set(["allow", "ask", "deny"]);
const SEVERITIES = new Set(["high", "medium", "low"]);
const MODES = new Set(["enforce", "log-only"]);

/**
 * Factory for the built in policy. A fresh object is returned on every call.
 *
 * @returns {{ mode: string, severity: Record<string, string>, allowHosts: string[], disable: string[], rules: object[] }} Config
 */
export function defaultConfig() {
    return {
        mode: "enforce",
        severity: { high: "deny", medium: "ask", low: "allow" },
        allowHosts: [],
        disable: [],
        rules: []
    };
}

/**
 * Reads one JSON file. Any problem is reported through `warnings` and treated as an absent file.
 *
 * @param {string} path File path
 * @param {{ path: string, message: string }[]} warnings Warning sink
 * @returns {Record<string, unknown>|null} Parsed object or null
 */
function readOne(path, warnings) {
    try {
        const value = JSON.parse(readFileSync(path, "utf8"));
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new Error("expected a JSON object");
        }
        return value;
    } catch (error) {
        // A missing optional config file is normal and must not create log noise.
        if (error.code !== "ENOENT") {
            warnings.push({ path, message: error.message });
        }
        return null;
    }
}

function validExtraRule(rule) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
        return false;
    }
    if (typeof rule.id !== "string" || typeof rule.title !== "string" || typeof rule.pattern !== "string") {
        return false;
    }
    if (!SEVERITIES.has(rule.severity)) {
        return false;
    }
    if (rule.requires !== undefined && typeof rule.requires !== "string") {
        return false;
    }
    try {
        new RegExp(rule.pattern, "i");
        if (rule.requires !== undefined) {
            new RegExp(rule.requires, "i");
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * Applies one config source over a target, validating every key. Invalid values are skipped and
 * reported instead of throwing.
 *
 * @param {Record<string, unknown>|null} source Source object
 * @param {ReturnType<typeof defaultConfig>} target Accumulator
 * @param {{ path: string, message: string }[]} warnings Warning sink
 * @param {string} path Source path for messages
 */
function apply(source, target, warnings, path) {
    if (!source) {
        return;
    }

    if (source.mode !== undefined) {
        if (typeof source.mode === "string" && MODES.has(source.mode)) {
            target.mode = source.mode;
        } else {
            warnings.push({ path, message: `invalid mode: ${String(source.mode)}` });
        }
    }

    if (source.severity && typeof source.severity === "object" && !Array.isArray(source.severity)) {
        for (const [key, value] of Object.entries(source.severity)) {
            if (!SEVERITIES.has(key)) {
                warnings.push({ path, message: `unknown severity key: ${key}` });
            } else if (!DECISIONS.has(value)) {
                warnings.push({ path, message: `invalid decision for ${key}: ${String(value)}` });
            } else {
                target.severity[key] = value;
            }
        }
    }

    for (const key of ["allowHosts", "disable"]) {
        if (Array.isArray(source[key])) {
            target[key] = source[key].filter((entry) => typeof entry === "string");
        }
    }

    if (Array.isArray(source.rules)) {
        const accepted = [];
        for (const rule of source.rules) {
            if (validExtraRule(rule)) {
                accepted.push(rule);
            } else {
                warnings.push({ path, message: `invalid extra rule: ${typeof rule === "object" && rule ? String(rule.id) : "unnamed"}` });
            }
        }
        target.rules = accepted;
    }
}

/**
 * Merges config sources in priority order. Arrays are replaced, severity keys are merged.
 *
 * @param {(Record<string, unknown>|null)[]} sources Sources from lowest to highest priority
 * @param {{ path: string, message: string }[]} warnings Warning sink
 * @param {string[]} paths Source paths aligned with `sources`
 * @returns {ReturnType<typeof defaultConfig>} Effective config
 */
export function mergeConfigs(sources, warnings = [], paths = []) {
    const config = defaultConfig();
    sources.forEach((source, index) => apply(source, config, warnings, paths[index] ?? "config"));
    return config;
}

/**
 * Loads user config then project config. Project values replace user values. Malformed files and
 * invalid keys never crash the caller.
 *
 * @param {{ cwd: string, stateDir: string }} ctx Context
 * @returns {{ config: ReturnType<typeof defaultConfig>, warnings: { path: string, message: string }[], paths: { user: string, project: string } }} Result
 */
export function loadConfig(ctx) {
    const paths = configPaths(ctx);
    const warnings = [];
    const user = readOne(paths.user, warnings);
    const project = readOne(paths.project, warnings);
    const config = mergeConfigs([user, project], warnings, [paths.user, paths.project]);

    return { config, warnings, paths };
}
