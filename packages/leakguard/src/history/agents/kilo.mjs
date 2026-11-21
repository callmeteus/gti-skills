import { DEFAULT_MAX_CELL_CHARS, hasTable, quoteIdent, streamRows } from "../sqlite.mjs";
import { cellText, firstValue, isoTime, jsonParse, ranStatus, textEvent, toolEvent } from "./common.mjs";

/**
 * Extracts Kilo chats from its SQLite store. Kilo stores message metadata in `message` and the
 * actual text and tool parts in `part.data` as JSON.
 *
 * @param {object} db DatabaseSync instance
 * @param {object} stats Mutable statistics
 * @param {(event: object) => void} emit Event sink
 * @param {number} [maxCellChars] Cell cap
 * @returns {void}
 */
export function extractKilo(db, stats, emit, maxCellChars = DEFAULT_MAX_CELL_CHARS) {
    if (hasTable(db, "message")) {
        streamRows(db, "SELECT time_created, data FROM message WHERE data IS NOT NULL", stats, (row) => {
            const data = jsonParse(cellText(row.data));
            if (!data) {
                return;
            }
            const time = isoTime(data.time?.created) ?? isoTime(row.time_created);
            if (typeof data.text === "string" && data.text) {
                emit(textEvent(data.text, time));
            }
            if (typeof data.summary?.text === "string" && data.summary.text) {
                emit(textEvent(data.summary.text, time));
            }
        }, maxCellChars);
    }

    if (hasTable(db, "part")) {
        streamRows(db, "SELECT time_created, data FROM part WHERE data IS NOT NULL", stats, (row) => {
            const data = jsonParse(cellText(row.data));
            if (!data) {
                return;
            }
            const time = isoTime(data.time?.start ?? data.time?.created) ?? isoTime(row.time_created);
            if (typeof data.text === "string" && data.text) {
                emit(textEvent(data.text, time));
                return;
            }
            const type = String(data.type ?? "");
            const name = firstValue(data, ["tool", "toolName", "name"]);
            if (!/tool|call|invocation/i.test(type) && !name) {
                return;
            }
            const state = data.state && typeof data.state === "object" ? data.state : {};
            const input = firstValue(data, ["args", "input", "parameters", "params"]) ?? firstValue(state, ["input", "args"]) ?? {};
            const executed = data.executed === true || ranStatus(state.status) ||
                /^(?:tool-result|tool_result)$/i.test(type);
            emit(toolEvent(name ?? type, input, time, executed));
            const result = firstValue(data, ["result", "output", "content"]);
            if (typeof result === "string" && result) {
                emit(textEvent(result, time));
            }
        }, maxCellChars);
    }

    if (hasTable(db, "kilo_board_message")) {
        streamRows(db, "SELECT time_created, body FROM kilo_board_message WHERE body IS NOT NULL", stats, (row) => {
            const text = cellText(row.body);
            if (text) {
                emit(textEvent(text, isoTime(row.time_created)));
            }
        }, maxCellChars);
    }

    if (hasTable(db, "event")) {
        streamRows(db, "SELECT data FROM event WHERE data IS NOT NULL", stats, (row) => {
            const text = cellText(row.data);
            if (text && text[0] === "{") {
                const data = jsonParse(text);
                if (typeof data?.text === "string" && data.text) {
                    emit(textEvent(data.text));
                }
            }
        }, maxCellChars);
    }
}
