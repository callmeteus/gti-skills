// One central per ledger folder: the lock file records the running server so `start` can reuse it.

import { readFileSync, writeFileSync, rmSync, mkdirSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawn } from "node:child_process";

/**
 * Path of the lock file for a ledger folder.
 * @param {string} root
 * @returns {string}
 */
export function lockPath(root) {
    return join(root, "_central", "lock.json");
}

/**
 * Reads the lock, or null.
 * @param {string} root
 * @returns {{ pid: number, port: number, token: string, url: string, root: string, startedAt: string } | null}
 */
export function readLock(root) {
    try {
        return JSON.parse(readFileSync(lockPath(root), "utf8"));
    } catch {
        return null;
    }
}

/**
 * Writes the lock atomically.
 * @param {string} root
 * @param {object} lock
 */
export function writeLock(root, lock) {
    const file = lockPath(root);
    mkdirSync(dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(lock, null, 2));
    renameSync(temp, file);
}

/**
 * Removes the lock when it still belongs to this process.
 * @param {string} root
 * @param {number} pid
 */
export function clearLock(root, pid) {
    const lock = readLock(root);
    if (lock && lock.pid === pid) {
        rmSync(lockPath(root), { force: true });
    }
}

/**
 * Whether a process id is alive.
 * @param {number} pid
 * @returns {boolean}
 */
export function alive(pid) {
    if (!pid) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error.code === "EPERM";
    }
}

/**
 * Asks a running central for its health; resolves to true when it answers with the same root.
 * @param {{ url: string, token: string, root: string }} lock
 * @returns {Promise<boolean>}
 */
export async function healthy(lock) {
    try {
        const res = await fetch(`${lock.url}/api/health?token=${lock.token}`, { signal: AbortSignal.timeout(1500) });
        if (!res.ok) {
            return false;
        }
        const body = await res.json();
        return body.ok === true && body.root === lock.root;
    } catch {
        return false;
    }
}

/**
 * Opens a URL in the default browser.
 * @param {string} url
 */
export function openBrowser(url) {
    const [cmd, args] =
        process.platform === "win32"
            ? ["cmd", ["/c", "start", '""', url.replace(/&/g, "^&")]]
            : process.platform === "darwin"
              ? ["open", [url]]
              : ["xdg-open", [url]];
    const child = spawn(cmd, args, { stdio: "ignore", detached: true, windowsHide: true });
    child.on("error", () => {});
    child.unref();
}
