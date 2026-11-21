import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Longest text or blob cell accepted from a SQLite store. Larger cells are counted as skipped. */
export const DEFAULT_MAX_CELL_CHARS = 2 * 1024 * 1024;

/**
 * Files at or above this size are opened read only in place instead of being copied to the OS
 * temp folder. A 32 GB chat store cannot be copied for each scan; opening it read only with the
 * SQLite immutable flag takes no lock and does not write to the original file. Records the reason
 * in the coverage note so the tradeoff is visible in the report.
 */
export const DEFAULT_MAX_COPY_BYTES = 2 * 1024 * 1024 * 1024;

let databaseSyncPromise = null;

/**
 * Loads `node:sqlite` lazily. The package supports Node 18, where the module does not exist, so a
 * failure is cached and reported as a skip rather than thrown.
 *
 * @returns {Promise<Function|null>} DatabaseSync constructor or null
 */
export function loadDatabaseSync() {
    if (databaseSyncPromise === null) {
        databaseSyncPromise = import("node:sqlite")
            .then((module) => (typeof module.DatabaseSync === "function" ? module.DatabaseSync : null))
            .catch(() => null);
    }
    return databaseSyncPromise;
}

/**
 * Escapes an identifier for use in a double quoted SQLite identifier.
 *
 * @param {string} name Identifier
 * @returns {string} Quoted identifier
 */
export function quoteIdent(name) {
    return `"${String(name).replace(/"/g, '""')}"`;
}

/**
 * Opens a SQLite store for a read only callback. Small stores, and any store with a write ahead
 * log, are copied together with their `-wal` and `-shm` sidecars into a private temp folder so the
 * original is never opened for writing or locked. Very large stores are opened in place with the
 * immutable flag; those take no lock and never write to the original either. The copy is removed
 * on success and on error.
 *
 * @param {string} file Path to the `.db` or `.vscdb` file
 * @param {(db: object, stats: object, DatabaseSync: Function) => void|Promise<void>} fn Callback
 * @param {{ maxCellChars?: number, maxCopyBytes?: number, forceUnavailable?: boolean }} [options] Options
 * @returns {Promise<{ ok: boolean, reason?: string, stats: object }>} Open result and statistics
 */
export async function withSqlite(file, fn, options = {}) {
    const stats = { rows: 0, skippedCells: 0, sessionIds: new Set(), note: null, copied: false };
    if (options.forceUnavailable === true) {
        return { ok: false, reason: "node:sqlite unavailable", stats };
    }
    const DatabaseSync = await loadDatabaseSync();
    if (DatabaseSync === null) {
        return { ok: false, reason: "node:sqlite unavailable", stats };
    }

    const maxCopyBytes = Number.isFinite(options.maxCopyBytes) ? options.maxCopyBytes : DEFAULT_MAX_COPY_BYTES;
    let size = 0;
    try {
        size = statSync(file).size;
    } catch {
        return { ok: false, reason: "not readable", stats };
    }

    const sidecars = ["-wal", "-shm"].filter((suffix) => existsSync(file + suffix));
    const useCopy = size < maxCopyBytes || sidecars.length > 0;
    let scratch = null;
    let openPath = file;
    let db = null;

    try {
        if (useCopy) {
            scratch = join(tmpdir(), `lg-sqlite-${process.pid}-${Math.random().toString(36).slice(2)}`);
            mkdirSync(scratch, { recursive: true });
            const base = "store.db";
            openPath = join(scratch, base);
            copyFileSync(file, openPath);
            for (const suffix of sidecars) {
                copyFileSync(file + suffix, openPath + suffix);
            }
            stats.copied = true;
            db = new DatabaseSync(openPath, { readOnly: true });
        } else {
            // SQLite immutable mode: no locking, no WAL, no write to the original file. Stores this
            // large on this machine have no WAL sidecar, so no recent rows are lost.
            stats.note = "opened read only in place (immutable) because the store exceeds the copy threshold";
            const uri = `file:${file.replace(/\\/g, "/")}?immutable=1`;
            try {
                db = new DatabaseSync(uri, { readOnly: true });
            } catch {
                db = new DatabaseSync(file, { readOnly: true });
                stats.note = "opened read only in place because the store exceeds the copy threshold";
            }
        }

        await fn(db, stats, DatabaseSync);
        return { ok: true, stats };
    } catch (error) {
        return { ok: false, reason: String(error.message ?? error).slice(0, 200), stats };
    } finally {
        if (db) {
            try {
                db.close();
            } catch {
                // A failed open has nothing to close.
            }
        }
        if (scratch) {
            try {
                rmSync(scratch, { recursive: true, force: true });
            } catch {
                // Best effort cleanup of a temp copy.
            }
        }
    }
}

/**
 * True when a table or view exists in the opened database.
 *
 * @param {object} db DatabaseSync instance
 * @param {string} name Table name
 * @returns {boolean} Whether it exists
 */
export function hasTable(db, name) {
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name = ?").all(name);
    return rows.length > 0;
}

/**
 * Lists every table and view in a database.
 *
 * @param {object} db DatabaseSync instance
 * @returns {string[]} Names
 */
export function tableNames(db) {
    return db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name")
        .all()
        .map((row) => row.name)
        .filter((name) => !name.startsWith("sqlite_"));
}

/**
 * Lists the column names of a table. Used by extractors that must tolerate older store versions.
 *
 * @param {object} db DatabaseSync instance
 * @param {string} name Table name
 * @returns {string[]} Column names
 */
export function tableColumns(db, name) {
    return db.prepare(`PRAGMA table_info(${quoteIdent(name)})`)
        .all()
        .map((row) => row.name);
}

/**
 * Returns true when a cell exceeds the configured cap.
 *
 * @param {unknown} value Cell value
 * @param {number} maxChars Cap
 * @returns {boolean} Whether the cell is oversized
 */
function oversized(value, maxChars) {
    if (typeof value === "string") {
        return value.length > maxChars;
    }
    if (ArrayBuffer.isView(value)) {
        return value.byteLength > maxChars;
    }
    return false;
}

/**
 * Streams the rows of a query one at a time. Rows with an oversized cell are counted as skipped
 * and never handed to the caller. Session identifiers are collected for the coverage table.
 *
 * @param {object} db DatabaseSync instance
 * @param {string} sql SELECT statement
 * @param {object} stats Mutable statistics from `withSqlite`
 * @param {(row: object) => void} onRow Row handler
 * @param {number} [maxChars] Cell cap
 * @returns {void}
 */
export function streamRows(db, sql, stats, onRow, maxChars = DEFAULT_MAX_CELL_CHARS) {
    let statement;
    try {
        statement = db.prepare(sql);
    } catch {
        return;
    }
    try {
        for (const row of statement.iterate()) {
            stats.rows += 1;
            for (const column of ["session_id", "sessionId", "sessionID", "session_id"]) {
                const value = row[column];
                if (typeof value === "string" && value) {
                    stats.sessionIds.add(value);
                    break;
                }
            }
            if (Object.values(row).some((value) => oversized(value, maxChars))) {
                stats.skippedCells += 1;
                continue;
            }
            onRow(row);
        }
    } catch (error) {
        if (!String(error.message ?? error).includes("no such table")) {
            throw error;
        }
    }
}
