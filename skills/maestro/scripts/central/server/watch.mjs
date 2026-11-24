// Watches the Maestro ledger and calls back when any ledger file changes.
// fs.watch gives the instant signal; a light poll catches what fs.watch misses on some file systems.

import { watch, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const LEDGER_FILES = new Set([
    "run.json",
    "workers.jsonl",
    "audit.jsonl",
    "decisions.jsonl",
    "orchestrators.json",
    "preferences.json",
    "providers.json",
    "history.jsonl",
    "hosts.json",
]);

/**
 * A cheap signature of every ledger file under root (two levels deep): name, size, and mtime.
 * @param {string} root
 * @returns {string}
 */
export function ledgerSignature(root) {
    const parts = [];
    const visit = (dir, depth) => {
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (depth < 1 && !entry.name.startsWith("_") && entry.name !== "tools") {
                    visit(path, depth + 1);
                }
            } else if (LEDGER_FILES.has(entry.name)) {
                try {
                    const stats = statSync(path);
                    parts.push(`${path}:${stats.size}:${stats.mtimeMs}`);
                } catch {
                    // Removed between readdir and stat.
                }
            }
        }
    };
    visit(root, 0);
    return parts.sort().join("|");
}

/**
 * Starts watching. Returns a function that stops it.
 * @param {string} root
 * @param {() => void} onChange
 * @param {{ pollMs?: number, debounceMs?: number }} [options]
 * @returns {() => void}
 */
export function watchLedger(root, onChange, options = {}) {
    const pollMs = options.pollMs ?? 1000;
    const debounceMs = options.debounceMs ?? 80;
    let signature = ledgerSignature(root);
    let timer = null;
    let watcher = null;

    const check = () => {
        const next = ledgerSignature(root);
        if (next !== signature) {
            signature = next;
            onChange();
        }
    };
    const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(check, debounceMs);
    };

    try {
        watcher = watch(root, { recursive: true }, schedule);
        watcher.on("error", () => {
            watcher?.close();
            watcher = null;
        });
    } catch {
        watcher = null;
    }
    const poll = setInterval(check, pollMs);
    poll.unref?.();

    return () => {
        clearInterval(poll);
        clearTimeout(timer);
        watcher?.close();
    };
}
