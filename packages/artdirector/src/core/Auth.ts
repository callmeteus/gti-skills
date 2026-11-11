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
        return loadOrCreateFile(tokenPath(projectRoot));
    }

    /**
     * Reads or creates a bearer token at an explicit path.
     *
     * @param file Token file
     * @returns Hex token
     */
    export function loadOrCreateFile(file: string): string {
        if (existsSync(file)) {
            return readFileSync(file, "utf8").trim();
        }

        const token = Ids.token();
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, `${token}
`, { encoding: "utf8", mode: 0o600 });
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

        matches(loadOrCreate(projectRoot), presented);
    }

    /**
     * Compares a presented token with an expected one in constant time.
     *
     * @param expected Stored token
     * @param presented Token from header, cookie, or query
     */
    export function matches(expected: string, presented: string | undefined): void {
        if (!presented) {
            throw ArtErrors.auth("Missing studio token.");
        }

        const left = Buffer.from(presented);
        const right = Buffer.from(expected);

        if (left.length !== right.length || !timingSafeEqual(left, right)) {
            throw ArtErrors.auth("Invalid studio token.");
        }
    }
}
