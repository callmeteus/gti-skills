import { cellText, firstValue, isoTime, jsonParse, printableStrings, ranStatus, textEvent, toolEvent } from "./common.mjs";

/**
 * Maps one Kiro CLI JSONL record into events. The CLI store is not present on the machine where
 * this was written, so the reader accepts the common shapes and is marked unverified in the report.
 *
 * @param {object} record Parsed line
 * @returns {Array} Events
 */
export function kiroJsonlEvents(record) {
    const events = [];
    const emit = (event) => events.push(event);
    const time = isoTime(record.timestamp ?? record.time ?? record.createdAt);
    if (typeof record.content === "string" && record.content) {
        emit(textEvent(record.content, time));
    }
    if (typeof record.message === "string" && record.message) {
        emit(textEvent(record.message, time));
    }
    if (typeof record.text === "string" && record.text) {
        emit(textEvent(record.text, time));
    }
    for (const call of Array.isArray(record.toolUses) ? record.toolUses
        : Array.isArray(record.toolCalls) ? record.toolCalls
            : Array.isArray(record.tool_calls) ? record.tool_calls : []) {
        const name = firstValue(call, ["name", "tool", "toolName"]);
        if (!name) {
            continue;
        }
        const input = firstValue(call, ["input", "args", "arguments", "parameters", "params"]) ?? {};
        emit(toolEvent(name, input, time, ranStatus(call.status) || call.executed === true));
    }
    return events;
}

/**
 * Maps a Kiro IDE or CLI JSON file into events.
 *
 * @param {string} text File contents
 * @returns {Array} Events
 */
export function kiroJsonEvents(text) {
    const data = jsonParse(text);
    if (!data) {
        return [];
    }
    if (Array.isArray(data)) {
        return data.flatMap((item) => kiroJsonlEvents(item ?? {}));
    }
    const messages = firstValue(data, ["messages", "conversation", "history", "events"]);
    if (Array.isArray(messages)) {
        return messages.flatMap((item) => kiroJsonlEvents(item ?? {}));
    }
    return kiroJsonlEvents(data);
}

/**
 * Maps a Kiro SQLite row that holds JSON into events. Used by the generic SQLite fallback for a
 * Kiro store when no more specific shape is recognised.
 *
 * @param {unknown} value Cell value
 * @returns {Array} Events
 */
export function kiroCellEvents(value) {
    const text = cellText(value);
    if (!text) {
        return [];
    }
    if (text[0] === "{" || text[0] === "[") {
        const events = kiroJsonEvents(text);
        if (events.length > 0) {
            return events;
        }
    }
    const strings = printableStrings(text);
    return strings ? [textEvent(strings)] : [];
}
