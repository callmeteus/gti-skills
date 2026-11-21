import { DEFAULT_MAX_CELL_CHARS, hasTable, quoteIdent, streamRows } from "../sqlite.mjs";
import { cellText, firstValue, jsonParse, ranStatus, textEvent, toolEvent } from "./common.mjs";

/**
 * Adds the text and tool call carried by one Cursor bubble. Tool calls live in `toolFormerData`
 * with the name in `name` or `tool` and the arguments in `params` or `rawArgs`.
 *
 * @param {object} data Parsed bubble value
 * @param {(event: object) => void} emit Event sink
 * @returns {void}
 */
function emitBubble(data, emit) {
    for (const field of ["text", "richText"]) {
        if (typeof data[field] === "string" && data[field]) {
            emit(textEvent(data[field]));
        }
    }
    if (typeof data.thinking?.text === "string" && data.thinking.text) {
        emit(textEvent(data.thinking.text));
    }

    const former = data.toolFormerData;
    if (former && typeof former === "object") {
        const name = firstValue(former, ["name", "tool"]) ?? "";
        let input = firstValue(former, ["params", "input", "args"]);
        if (input === undefined && typeof former.rawArgs === "string") {
            input = jsonParse(former.rawArgs) ?? former.rawArgs;
        }
        const executed = former.executed === true || ranStatus(former.status) || Boolean(former.result);
        emit(toolEvent(name, input ?? {}, null, executed));
        if (typeof former.result === "string" && former.result) {
            emit(textEvent(former.result));
        }
    }

    if (Array.isArray(data.toolResults)) {
        for (const result of data.toolResults) {
            if (!result || typeof result !== "object") {
                continue;
            }
            const text = firstValue(result, ["text", "content", "result", "output"]);
            if (typeof text === "string" && text) {
                emit(textEvent(text));
            }
        }
    }
}

/**
 * Extracts Cursor chats from the VS Code style SQLite stores. `cursorDiskKV` holds composer and
 * bubble JSON under key prefixes; `conversation-search.db` holds indexed conversation text.
 *
 * @param {object} db DatabaseSync instance
 * @param {object} stats Mutable statistics
 * @param {(event: object) => void} emit Event sink
 * @param {number} [maxCellChars] Cell cap
 * @returns {void}
 */
export function extractCursor(db, stats, emit, maxCellChars = DEFAULT_MAX_CELL_CHARS) {
    if (hasTable(db, "cursorDiskKV")) {
        // Range predicates keep the 2M row KeyValue table on its index.
        for (const prefix of ["bubbleId:", "composerData:"]) {
            // The upper bound is the prefix plus the highest BMP character, so every key that
            // starts with the prefix is included regardless of what follows it.
            const sql = `SELECT key, value FROM cursorDiskKV WHERE key >= '${prefix}' AND key < '${prefix}\uffff'`;
            streamRows(db, sql, stats, (row) => {
                const data = jsonParse(cellText(row.value));
                if (!data) {
                    return;
                }
                if (prefix === "bubbleId:") {
                    emitBubble(data, emit);
                    return;
                }
                for (const field of ["text", "richText"]) {
                    if (typeof data[field] === "string" && data[field]) {
                        emit(textEvent(data[field]));
                    }
                }
                if (data.conversationMap && typeof data.conversationMap === "object") {
                    for (const entry of Object.values(data.conversationMap)) {
                        if (typeof entry?.text === "string" && entry.text) {
                            emit(textEvent(entry.text));
                        }
                    }
                }
            }, maxCellChars);
        }
    }

    if (hasTable(db, "conversation_fts")) {
        streamRows(db, "SELECT title, body FROM conversation_fts", stats, (row) => {
            if (typeof row.title === "string" && row.title) {
                emit(textEvent(row.title));
            }
            const text = cellText(row.body);
            if (text) {
                emit(textEvent(text));
            }
        }, maxCellChars);
    }

    if (hasTable(db, "composerHeaders")) {
        streamRows(db, "SELECT value FROM composerHeaders WHERE value IS NOT NULL", stats, (row) => {
            const text = cellText(row.value);
            if (text && text[0] === "{") {
                const data = jsonParse(text);
                if (typeof data?.text === "string" && data.text) {
                    emit(textEvent(data.text));
                }
            }
        }, maxCellChars);
    }

    if (hasTable(db, "conversations")) {
        streamRows(db, "SELECT title FROM conversations WHERE title IS NOT NULL", stats, (row) => {
            if (typeof row.title === "string" && row.title) {
                emit(textEvent(row.title));
            }
        }, maxCellChars);
    }
}
