import { DEFAULT_MAX_CELL_CHARS, hasTable, quoteIdent, streamRows } from "../sqlite.mjs";
import { cellText, firstValue, isoTime, jsonParse, ranStatus, textEvent, toolEvent } from "./common.mjs";

/**
 * Maps one Anthropic style content block from a Cline task JSON file into events.
 *
 * @param {object} block Content block
 * @param {(event: object) => void} emit Event sink
 * @returns {void}
 */
function emitBlock(block, emit) {
    if (!block || typeof block !== "object") {
        return;
    }
    if (typeof block.text === "string" && block.text) {
        emit(textEvent(block.text));
        return;
    }
    const name = firstValue(block, ["name", "tool", "toolName"]);
    if (name) {
        const input = firstValue(block, ["input", "args", "parameters", "params"]) ?? {};
        const executed = block.executed === true || ranStatus(block.status);
        emit(toolEvent(name, input, null, executed));
    }
    const result = firstValue(block, ["content", "result", "output"]);
    if (typeof result === "string" && result) {
        emit(textEvent(result));
    }
}

/**
 * Turns a Cline extension conversation JSON file into events. Accepts an array of messages or an
 * object with a `messages`, `conversation`, or `uiMessages` array.
 *
 * @param {unknown} data Parsed JSON
 * @returns {Array} Events
 */
export function clineJsonEvents(data) {
    const events = [];
    const emit = (event) => events.push(event);
    const list = Array.isArray(data)
        ? data
        : data && typeof data === "object"
            ? firstValue(data, ["messages", "conversation", "uiMessages", "history"]) ?? []
            : [];
    for (const message of Array.isArray(list) ? list : []) {
        if (!message || typeof message !== "object") {
            continue;
        }
        const time = isoTime(message.timestamp ?? message.time);
        if (typeof message.text === "string" && message.text) {
            emit(textEvent(message.text, time));
        }
        const content = message.content;
        if (Array.isArray(content)) {
            for (const block of content) {
                emitBlock(block, emit);
            }
        } else if (typeof content === "string" && content) {
            emit(textEvent(content, time));
        }
    }
    return events;
}

/**
 * Extracts Cline chats from session, search, and task SQLite stores.
 *
 * @param {object} db DatabaseSync instance
 * @param {object} stats Mutable statistics
 * @param {(event: object) => void} emit Event sink
 * @param {number} [maxCellChars] Cell cap
 * @returns {void}
 */
export function extractCline(db, stats, emit, maxCellChars = DEFAULT_MAX_CELL_CHARS) {
    if (hasTable(db, "session_search")) {
        streamRows(db, "SELECT role, content FROM session_search WHERE content IS NOT NULL", stats, (row) => {
            const text = cellText(row.content);
            if (text) {
                emit(textEvent(text));
            }
        }, maxCellChars);
    }

    if (hasTable(db, "sessions")) {
        streamRows(db, "SELECT prompt, metadata_json, messages_path FROM sessions", stats, (row) => {
            if (typeof row.prompt === "string" && row.prompt) {
                emit(textEvent(row.prompt));
            }
            const metadata = jsonParse(cellText(row.metadata_json));
            if (metadata) {
                for (const field of ["text", "summary", "description"]) {
                    if (typeof metadata[field] === "string" && metadata[field]) {
                        emit(textEvent(metadata[field]));
                    }
                }
            }
        }, maxCellChars);
    }

    if (hasTable(db, "agenda_tasks")) {
        for (const column of ["title", "description", "instructions", "system_prompt"]) {
            streamRows(db, `SELECT ${quoteIdent(column)} AS value FROM agenda_tasks WHERE ${quoteIdent(column)} IS NOT NULL`, stats, (row) => {
                if (typeof row.value === "string" && row.value) {
                    emit(textEvent(row.value));
                }
            }, maxCellChars);
        }
    }
}
