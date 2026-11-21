/**
 * Shared helpers for per-agent history extractors. Every extractor turns rows and files into the
 * same two normalized events: a text message to scan for secrets, and a tool call to classify with
 * `toolkind.mjs`. This module never scores text; it only shapes it.
 */

/** Minimum length of a printable run pulled out of a binary cell. */
const MIN_PRINTABLE = 6;

/**
 * @typedef {{ kind: "text", text: string, time?: string|null }} TextEvent
 * @typedef {{ kind: "tool", name: string, input: unknown, time?: string|null, executed: boolean }} ToolEvent
 */

/**
 * Creates a text event.
 *
 * @param {string} text Message text
 * @param {string|null|undefined} time Timestamp
 * @returns {TextEvent} Event
 */
export function textEvent(text, time = null) {
    return { kind: "text", text: String(text ?? ""), time: time ?? null };
}

/**
 * Creates a tool event. `executed` is true only when the store itself shows the tool ran.
 *
 * @param {string} name Tool name
 * @param {unknown} input Tool input
 * @param {string|null|undefined} time Timestamp
 * @param {boolean} executed Whether the store shows the tool ran
 * @returns {ToolEvent} Event
 */
export function toolEvent(name, input, time = null, executed = false) {
    return { kind: "tool", name: String(name ?? ""), input: input ?? {}, time: time ?? null, executed: executed === true };
}

/**
 * Turns a SQLite cell into text. Buffers are decoded as UTF-8; other values are ignored.
 *
 * @param {unknown} value Cell value
 * @returns {string} Text
 */
export function cellText(value) {
    if (typeof value === "string") {
        return value;
    }
    // node:sqlite returns BLOB columns as Uint8Array, not Buffer.
    if (ArrayBuffer.isView(value)) {
        return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("utf8");
    }
    return "";
}

/**
 * Extracts printable runs from a binary cell. Used for protobuf and protobuf text stores where a
 * full decode is not available; only human readable fragments can be scanned for leaks.
 *
 * @param {unknown} value Cell or file contents
 * @param {number} [min] Minimum run length
 * @returns {string} Newline joined printable runs
 */
export function printableStrings(value, min = MIN_PRINTABLE) {
    const text = cellText(value) || String(value ?? "");
    const runs = text.match(/[\x20-\x7E\u00A0-\uFFFF]{6,}/g) ?? [];
    return runs.filter((run) => run.trim().length >= min).join("\n");
}

/**
 * Parses a JSON string cell or object. Returns null for malformed or non-object values.
 *
 * @param {unknown} raw Value to parse
 * @returns {object|null} Parsed object
 */
export function jsonParse(raw) {
    if (raw === null || raw === undefined) {
        return null;
    }
    if (typeof raw === "object") {
        return Array.isArray(raw) ? null : raw;
    }
    if (typeof raw !== "string" || raw[0] !== "{" && raw[0] !== "[") {
        return null;
    }
    try {
        const value = JSON.parse(raw);
        return value && typeof value === "object" ? value : null;
    } catch {
        return null;
    }
}

/**
 * Converts a millisecond epoch, second epoch, or ISO string into an ISO timestamp when possible.
 *
 * @param {unknown} value Raw time
 * @returns {string|null} ISO timestamp
 */
export function isoTime(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        const ms = value < 1e12 ? value * 1000 : value;
        try {
            return new Date(ms).toISOString();
        } catch {
            return null;
        }
    }
    if (typeof value === "string" && value) {
        return value;
    }
    return null;
}

/**
 * True when a status string indicates the tool actually ran.
 *
 * @param {unknown} status Status value
 * @returns {boolean} Whether the tool ran
 */
export function ranStatus(status) {
    return /^(?:completed|complete|done|success|succeeded|finished|ok)$/i.test(String(status ?? "").trim());
}

/**
 * Picks the first string from an object using a list of candidate field names.
 *
 * @param {object} value Object
 * @param {string[]} fields Candidate names
 * @returns {string} Value or empty string
 */
export function firstString(value, fields) {
    if (!value || typeof value !== "object") {
        return "";
    }
    for (const field of fields) {
        if (typeof value[field] === "string" && value[field]) {
            return value[field];
        }
    }
    return "";
}

/**
 * Picks the first present value from an object using a list of candidate field names.
 *
 * @param {object} value Object
 * @param {string[]} fields Candidate names
 * @returns {unknown} Value or undefined
 */
export function firstValue(value, fields) {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    for (const field of fields) {
        if (value[field] !== undefined && value[field] !== null) {
            return value[field];
        }
    }
    return undefined;
}

/**
 * Turns JSONL text into events using a mapper. Each line is parsed; malformed lines are ignored.
 *
 * @param {string} text File contents
 * @param {(record: object) => Array} mapper Record to events
 * @returns {Array} Events
 */
export function jsonlEvents(text, mapper) {
    const events = [];
    for (const line of String(text ?? "").split("\n")) {
        if (!line.trim() || line.length > 2 * 1024 * 1024) {
            continue;
        }
        const record = jsonParse(line);
        if (record) {
            events.push(...mapper(record));
        }
    }
    return events;
}
