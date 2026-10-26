import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Record of the studio that serves a project, stored at `.artdirector/studio.json`.
 */
export interface StudioLockRecord {
    pid: number;
    port: number;
    url: string;
    startedAt: string;
}

/**
 * Reads, writes, and health-checks the per-project studio lock.
 */
export namespace StudioLock {
    /**
     * @param stateDir Project state folder
     * @returns Lock file path
     */
    export function path(stateDir: string): string {
        return join(stateDir, "studio.json");
    }

    /**
     * Reads the lock, ignoring a missing or corrupt file.
     *
     * @param stateDir Project state folder
     * @returns Lock record or null
     */
    export function read(stateDir: string): StudioLockRecord | null {
        const file = path(stateDir);

        if (!existsSync(file)) {
            return null;
        }

        try {
            const record = JSON.parse(readFileSync(file, "utf8")) as StudioLockRecord;
            return typeof record.port === "number" && typeof record.url === "string" ? record : null;
        } catch {
            return null;
        }
    }

    /**
     * Writes the lock for a running studio.
     *
     * @param stateDir Project state folder
     * @param record Lock record
     */
    export function write(stateDir: string, record: StudioLockRecord): void {
        writeFileSync(path(stateDir), JSON.stringify(record, null, 2));
    }

    /**
     * Removes the lock when it still points at the given port.
     *
     * @param stateDir Project state folder
     * @param port Port of the studio that is closing
     */
    export function release(stateDir: string, port: number): void {
        if (read(stateDir)?.port === port) {
            rmSync(path(stateDir), { force: true });
        }
    }

    /**
     * Checks that the locked studio answers with this project's token.
     * Another project's studio on the same port rejects the token, so it counts as unhealthy.
     *
     * @param record Lock record
     * @param token Project token
     * @returns True when the studio is reachable and serves this project
     */
    export async function healthy(record: StudioLockRecord, token: string): Promise<boolean> {
        try {
            const res = await fetch(`http://127.0.0.1:${record.port}/v1/session`, {
                headers: { Authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(1500)
            });
            return res.ok;
        } catch {
            return false;
        }
    }
}
