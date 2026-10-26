import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { timingSafeEqual } from "node:crypto";

import { ArtErrors } from "./Errors";
import { Ids } from "./Ids";
import { Paths } from "./Paths";

/**
 * Local-server token stored beside the project, never in git.
 */
export namespace Auth {
    /**
     * Reads or creates the studio bearer token.
     *
     * @param projectRoot Project root
     * @returns Hex token
     */
    export function loadOrCreate(projectRoot: string): string {
        const file = tokenPath(projectRoot);

        if (existsSync(file)) {
            return readFileSync(file, "utf8").trim();
        }

        const token = Ids.token();
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, `${token}\n`, { encoding: "utf8", mode: 0o600 });
        return token;
    }

    /**
     * Token file path.
     *
     * @param projectRoot Project root
     * @returns Absolute path
     */
    export function tokenPath(projectRoot: string): string {
        return join(Paths.stateDir(projectRoot), "token");
    }

    /**
     * Compares a presented token with the stored one.
     *
     * @param projectRoot Project root
     * @param presented Token from header or query
     */
    export function assert(projectRoot: string, presented: string | undefined): void {
        if (!presented) {
            throw ArtErrors.auth("Missing studio token.");
        }

        const expected = loadOrCreate(projectRoot);
        const left = Buffer.from(presented);
        const right = Buffer.from(expected);

        if (left.length !== right.length || !timingSafeEqual(left, right)) {
            throw ArtErrors.auth("Invalid studio token.");
        }
    }
}
