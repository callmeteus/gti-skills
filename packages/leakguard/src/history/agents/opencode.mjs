import { DEFAULT_MAX_CELL_CHARS, hasTable, quoteIdent, streamRows } from "../sqlite.mjs";
import { cellText, firstValue, isoTime, jsonParse, ranStatus, textEvent, toolEvent } from "./common.mjs";

/**
 * Extracts OpenCode chats from its SQLite store. Text lives in `session_message.data`; assistant
 * tool calls are content parts with `name`, `state.input` and `executed`.
 *
 * @param {object} db DatabaseSync instance
 * @param {object} stats Mutable statistics
 * @param {(event: object) => void} emit Event sink
 * @param {number} [maxCellChars] Cell cap
 * @returns {void}
 */
export function extractOpenCode(db, stats, emit, maxCellChars = DEFAULT_MAX_CELL_CHARS) {
    if (hasTable(db, "session_message")) {
        streamRows(db, "SELECT type, time_created, data FROM session_message WHERE data IS NOT NULL", stats, (row) => {
            const data = jsonParse(cellText(row.data));
            if (!data) {
                return;
            }
            const time = isoTime(data.time?.created) ?? isoTime(row.time_created);
            if (typeof data.text === "string" && data.text) {
                emit(textEvent(data.text, time));
            }
            if (Array.isArray(data.content)) {
                for (const part of data.content) {
                    if (!part || typeof part !== "object") {
                        continue;
                    }
                    if ((part.type === "text" || part.type === "reasoning") && typeof part.text === "string" && part.text) {
                        emit(textEvent(part.text, time));
                        continue;
                    }
                    const name = firstValue(part, ["name", "tool", "toolName"]);
                    if (!name || part.type !== "tool") {
                        continue;
                    }
                    const state = part.state && typeof part.state === "object" ? part.state : {};
                    const input = firstValue(state, ["input", "args", "parameters"]) ?? firstValue(part, ["input", "args", "parameters"]) ?? {};
                    const executed = part.executed === true || ranStatus(state.status);
                    emit(toolEvent(name, input, time, executed));
                    const content = state.content;
                    if (typeof content === "string" && content) {
                        emit(textEvent(content, time));
                    }
                }
            }
        }, maxCellChars);
    }

    for (const table of ["instruction_entry", "kv"]) {
        if (!hasTable(db, table)) {
            continue;
        }
        streamRows(db, `SELECT key, value FROM ${quoteIdent(table)} WHERE value IS NOT NULL`, stats, (row) => {
            if (typeof row.key === "string" && row.key) {
                emit(textEvent(row.key));
            }
            const text = cellText(row.value);
            if (text) {
                emit(textEvent(text));
            }
        }, maxCellChars);
    }
}
