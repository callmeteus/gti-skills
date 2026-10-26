import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Synchronous JSON file helpers used by project state.
 */
export namespace JsonFile {
    /**
     * Reads a JSON file.
     *
     * @param path File path
     * @returns Parsed value
     */
    export function read<T>(path: string): T {
        return JSON.parse(readFileSync(path, "utf8")) as T;
    }

    /**
     * Writes a JSON file, creating parent directories.
     *
     * @param path File path
     * @param value Serializable value
     */
    export function write(path: string, value: unknown): void {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`, "utf8");
    }

    /**
     * Reads a JSON file or returns a fallback.
     *
     * @param path File path
     * @param fallback Value when the file is missing
     * @returns Parsed value or fallback
     */
    export function readOr<T>(path: string, fallback: T): T {
        try {
            return read(path);
        } catch {
            return fallback;
        }
    }
}
