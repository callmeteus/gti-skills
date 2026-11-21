import { CREDENTIALS, collectMatches } from "../patterns.mjs";
import { redact, sha8 } from "../util.mjs";

/** Severity order used when two occurrences of one finding are merged. */
export const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, info: 1, low: 1 };

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
 * Finds credential literals in a piece of text. Each result carries only a hash and a redacted
 * form, plus the detector name that matched it.
 *
 * @param {string} text Text to inspect
 * @returns {{ name: string, hash: string, redacted: string }[]} Secret references
 */
export function findSecrets(text) {
    const found = [];
    const seen = new Set();

    for (const credential of CREDENTIALS) {
        for (const value of collectMatches(credential.re, text)) {
            const hash = secretHash(value);
            if (seen.has(hash)) {
                continue;
            }
            seen.add(hash);
            found.push({ name: credential.name, hash, redacted: safe(value) });
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
        executed: finding.executed
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
 * Sorts findings by severity, then by source and location, so the report is stable.
 *
 * @param {object[]} findings Findings
 * @returns {object[]} Sorted findings
 */
export function sortFindings(findings) {
    return [...findings].sort((left, right) => {
        const delta = (SEVERITY_RANK[right.severity] ?? 0) - (SEVERITY_RANK[left.severity] ?? 0);
        if (delta !== 0) {
            return delta;
        }
        return `${left.source}:${left.location}`.localeCompare(`${right.source}:${right.location}`);
    });
}
