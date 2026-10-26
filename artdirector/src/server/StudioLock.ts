import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ProjectContext } from "../session";

/**
 * Running studio record used to reuse one server per request.
 */
export interface StudioLockInfo {
    port: number;
    url: string;
    pid: number;
    startedAt: string;
}

const LockFile = "studio.json";

/**
 * Reads and writes the per-request studio lock.
 */
export namespace StudioLock {
    /**
     * Absolute lock path.
     *
     * @param ctx Project context
     * @returns Lock file path
     */
    export function file(ctx: ProjectContext): string {
        return join(ctx.stateDir(), LockFile);
    }

    /**
     * Reads a previous studio record.
     *
     * @param ctx Project context
     * @returns Lock info or null
     */
    export function read(ctx: ProjectContext): StudioLockInfo | null {
        const path = file(ctx);

        if (!existsSync(path)) {
            return null;
        }

        try {
            return JSON.parse(readFileSync(path, "utf8")) as StudioLockInfo;
        } catch {
            return null;
        }
    }

    /**
     * Records the running studio.
     *
     * @param ctx Project context
     * @param info Lock info
     */
    export function write(ctx: ProjectContext, info: StudioLockInfo): void {
        writeFileSync(file(ctx), JSON.stringify(info, null, 4), "utf8");
    }

    /**
     * Removes a stale lock.
     *
     * @param ctx Project context
     */
    export function clear(ctx: ProjectContext): void {
        rmSync(file(ctx), { force: true });
    }

    /**
     * Probes the recorded server with its own token.
     *
     * @param info Lock info
     * @param token Studio token
     * @returns Whether the server answers
     */
    export async function alive(info: StudioLockInfo, token: string): Promise<boolean> {
        try {
            const res = await fetch(`http://127.0.0.1:${info.port}/v1/session`, {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                signal: AbortSignal.timeout(900)
            });

            return res.ok;
        } catch {
            return false;
        }
    }
}
