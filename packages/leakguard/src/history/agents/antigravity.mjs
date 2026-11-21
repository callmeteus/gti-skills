import { DEFAULT_MAX_CELL_CHARS, hasTable, quoteIdent, streamRows, tableColumns } from "../sqlite.mjs";
import { cellText, firstValue, isoTime, jsonParse, printableStrings, ranStatus, textEvent, toolEvent } from "./common.mjs";

/**
 * Extracts human readable fragments from an Antigravity conversation SQLite store. The step and
 * metadata columns are protobuf blobs, so only printable strings are scanned.
 *
 * @param {object} db DatabaseSync instance
 * @param {object} stats Mutable statistics
 * @param {(event: object) => void} emit Event sink
 * @param {number} [maxCellChars] Cell cap
 * @returns {void}
 */
export function extractAntigravity(db, stats, emit, maxCellChars = DEFAULT_MAX_CELL_CHARS) {
    const targets = [
        ["steps", ["step_payload", "metadata", "error_details", "task_details", "render_info"]],
        ["gen_metadata", ["data"]],
        ["trajectory_metadata_blob", ["data"]],
        ["executor_metadata", ["data"]],
        ["parent_references", ["data"]]
    ];
    for (const [table, columns] of targets) {
        if (!hasTable(db, table)) {
            continue;
        }
        const present = new Set(tableColumns(db, table));
        for (const column of columns) {
            if (!present.has(column)) {
                continue;
            }
            const sql = `SELECT ${quoteIdent(column)} AS value FROM ${quoteIdent(table)} WHERE ${quoteIdent(column)} IS NOT NULL`;
            streamRows(db, sql, stats, (row) => {
                const raw = row.value;
                const text = ArrayBuffer.isView(raw) ? printableStrings(raw) : cellText(raw);
                if (text) {
                    emit(textEvent(text));
                }
            }, maxCellChars);
        }
    }
}

/**
 * Maps one Antigravity brain transcript JSONL record into events. Tool calls appear in the
 * `tool_calls` array with a name and an args or input object.
 *
 * @param {object} record Parsed line
 * @returns {Array} Events
 */
export function antigravityJsonlEvents(record) {
    const events = [];
    const emit = (event) => events.push(event);
    const time = isoTime(record.created_at);
    if (typeof record.content === "string" && record.content) {
        emit(textEvent(record.content, time));
    }
    if (Array.isArray(record.tool_calls)) {
        for (const call of record.tool_calls) {
            if (!call || typeof call !== "object") {
                continue;
            }
            const name = firstValue(call, ["name", "tool", "toolName", "function"]);
            if (!name) {
                continue;
            }
            const input = firstValue(call, ["args", "input", "arguments", "parameters", "params"]) ?? {};
            const executed = call.executed === true || ranStatus(call.status) ||
                ranStatus(record.status) || /^(?:done|completed|success)$/i.test(String(record.status ?? ""));
            emit(toolEvent(name, input, time, executed));
            const output = firstValue(call, ["result", "output", "content"]);
            if (typeof output === "string" && output) {
                emit(textEvent(output, time));
            }
        }
    }
    return events;
}

/**
 * Maps a Markdown, pbtxt, or protobuf file into events. Markdown and pbtxt are text; `.pb` files
 * contribute printable strings only.
 *
 * @param {string} text File contents
 * @param {string} extension Lowercase extension
 * @returns {Array} Events
 */
export function antigravityFileEvents(text, extension) {
    if (extension === ".pb") {
        const strings = printableStrings(text);
        return strings ? [textEvent(strings)] : [];
    }
    return text && text.trim() ? [textEvent(text)] : [];
}

/**
 * Generic tool call mapper reused by the Kiro and fallback JSON readers.
 *
 * @param {object} call Tool call object
 * @param {(event: object) => void} emit Event sink
 * @returns {void}
 */
export function emitGenericTool(call, emit) {
    if (!call || typeof call !== "object") {
        return;
    }
    const name = firstValue(call, ["name", "tool", "toolName", "function"]);
    if (!name) {
        return;
    }
    const input = firstValue(call, ["input", "args", "arguments", "parameters", "params"]) ?? {};
    emit(toolEvent(name, input, isoTime(call.timestamp ?? call.time), ranStatus(call.status) || call.executed === true));
}

/**
 * Parses a JSON object as an Antigravity style record when it has the right shape.
 *
 * @param {unknown} value Parsed JSON
 * @returns {Array} Events
 */
export function antigravityRecordEvents(value) {
    if (!value || typeof value !== "object") {
        return [];
    }
    if (Array.isArray(value.tool_calls) || "step_index" in value) {
        return antigravityJsonlEvents(value);
    }
    if (Array.isArray(value)) {
        return value.flatMap((item) => antigravityRecordEvents(item));
    }
    return [];
}
