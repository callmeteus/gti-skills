import { DEFAULT_MAX_CELL_CHARS, quoteIdent, streamRows, tableNames } from "../sqlite.mjs";
import { cellText, textEvent } from "./common.mjs";
import { extractAntigravity } from "./antigravity.mjs";
import { extractCline } from "./cline.mjs";
import { extractCursor } from "./cursor.mjs";
import { extractKilo } from "./kilo.mjs";
import { extractOpenCode } from "./opencode.mjs";

/** Specific SQLite extractors keyed by agent id. */
const EXTRACTORS = {
    opencode: extractOpenCode,
    kilo: extractKilo,
    cursor: extractCursor,
    cline: extractCline,
    antigravity: extractAntigravity
};

/**
 * True when the agent has a specific SQLite extractor.
 *
 * @param {string} agent Agent id
 * @returns {boolean} Whether a specific extractor exists
 */
export function hasExtractor(agent) {
    return Object.hasOwn(EXTRACTORS, agent);
}

/**
 * Fallback for a SQLite store in a known agent folder with no specific extractor. Every text cell
 * of every table is scanned for secrets. A generic scan never produces an executed exfiltration.
 *
 * @param {object} db DatabaseSync instance
 * @param {object} stats Mutable statistics
 * @param {(event: object) => void} emit Event sink
 * @param {number} [maxCellChars] Cell cap
 * @returns {void}
 */
export function genericSqlite(db, stats, emit, maxCellChars = DEFAULT_MAX_CELL_CHARS) {
    for (const table of tableNames(db)) {
        streamRows(db, `SELECT * FROM ${quoteIdent(table)}`, stats, (row) => {
            for (const value of Object.values(row)) {
                const text = cellText(value);
                if (text) {
                    emit(textEvent(text));
                }
            }
        }, maxCellChars);
    }
}

/**
 * Runs the specific extractor for an agent, or the generic fallback when none exists.
 *
 * @param {string} agent Agent id
 * @param {object} db DatabaseSync instance
 * @param {object} stats Mutable statistics
 * @param {(event: object) => void} emit Event sink
 * @param {number} [maxCellChars] Cell cap
 * @returns {void}
 */
export function extractSqlite(agent, db, stats, emit, maxCellChars = DEFAULT_MAX_CELL_CHARS) {
    const extractor = EXTRACTORS[agent];
    if (extractor) {
        extractor(db, stats, emit, maxCellChars);
        return;
    }
    genericSqlite(db, stats, emit, maxCellChars);
}
