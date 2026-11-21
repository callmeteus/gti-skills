import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

import { VideoErrors } from "./Errors";

/** JSON file helpers with UTF-8 and no BOM. */
export const Json = {
    read<T>(path: string): T {
        if (!existsSync(path)) {
            throw VideoErrors.project(`Missing JSON file: ${path}`);
        }

        try {
            return JSON.parse(readFileSync(path, "utf8")) as T;
        } catch (error) {
            throw VideoErrors.project(`Invalid JSON in ${path}: ${error instanceof Error ? error.message : String(error)}`);
        }
    },

    maybe<T>(path: string): T | null {
        return existsSync(path) ? Json.read<T>(path) : null;
    },

    write(path: string, value: unknown): void {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    }
};
