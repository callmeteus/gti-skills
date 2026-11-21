import { createHash } from "node:crypto";

import { CREDENTIALS, collectMatches } from "./patterns.mjs";

/** Severity order used to pick the winning policy decision. */
export const SEVERITY_RANK = { high: 3, medium: 2, low: 1 };

/**
 * Returns the numeric rank of a severity, or zero for an unknown value.
 *
 * @param {string} severity Severity label
 * @returns {number} Rank
 */
export function rank(severity) {
    return SEVERITY_RANK[severity] ?? 0;
}

/**
 * Short integrity prefix for a secret value. It lets an operator correlate a log line with a
 * rotated credential without storing the credential.
 *
 * @param {string} value Raw secret
 * @returns {string} First 8 hex characters of its SHA-256 digest
 */
export function sha8(value) {
    return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

/** Generic assignments such as MY_TOKEN=... or "password": "..." . */
const GENERIC_SECRET = /\b([A-Za-z_][A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|API_KEY|ACCESS_KEY|PRIVATE_KEY))\b\s*[=:]\s*["']?([^\s"',;}]{8,})/gi;
const URL_PASSWORD = /\b([a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)([^\s@/]+)(@)/gi;

/**
 * Replaces every secret-like value with its first four characters, three asterisks and a short
 * SHA-256 prefix. The original value never appears in the result.
 *
 * @param {string} text Text that may contain secrets
 * @returns {string} Redacted text
 */
export function redact(text) {
    if (typeof text !== "string") {
        return "";
    }

    let output = text.replace(URL_PASSWORD, (whole, head, secret, tail) => `${head}***[${sha8(secret)}]${tail}`);

    const secrets = new Set();

    for (const { re } of CREDENTIALS) {
        for (const value of collectMatches(re, output)) {
            secrets.add(value);
        }
    }

    for (const match of output.matchAll(GENERIC_SECRET)) {
        const value = match[2];
        if (value && !value.includes("***") && !value.startsWith("[")) {
            secrets.add(value);
        }
    }

    const ordered = [...secrets].sort((left, right) => right.length - left.length);

    for (const value of ordered) {
        const safe = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const replacement = `${value.slice(0, 4)}***[${sha8(value)}]`;
        output = output.replace(new RegExp(safe, "g"), replacement);
    }

    return output;
}

/**
 * Flattens a tool input into the text a detector should inspect. Strings are used verbatim;
 * objects contribute every string value so shell commands, file paths and MCP arguments are all
 * covered regardless of the field name an agent uses.
 *
 * @param {unknown} value Tool input
 * @param {number} depth Recursion depth, capped to avoid cycles and runaway payloads
 * @returns {string} Flattened text
 */
export function extractText(value, depth = 0) {
    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    if (value === null || value === undefined || depth > 6) {
        return "";
    }

    if (Array.isArray(value)) {
        return value.map((item) => extractText(item, depth + 1)).filter(Boolean).join(" ");
    }

    if (typeof value === "object") {
        const parts = [];

        for (const [key, item] of Object.entries(value)) {
            if (key.startsWith("_")) {
                continue;
            }
            const text = extractText(item, depth + 1);
            if (text) {
                parts.push(text);
            }
        }

        return parts.join("\n");
    }

    return "";
}

/**
 * One-based line number of the first occurrence of a snippet.
 *
 * @param {string} text Full text
 * @param {string} snippet Snippet to locate
 * @returns {number|null} Line number or null when not found
 */
export function lineOf(text, snippet) {
    const index = text.indexOf(snippet);
    if (index < 0) {
        return null;
    }
    return text.slice(0, index).split("\n").length;
}
