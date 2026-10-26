import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const TextExtensions = new Set([".md", ".py", ".mjs", ".js", ".json", ".txt", ".yml", ".yaml", ".html", ".css", ".ts"]);

/**
 * Normalizes a text file to LF line endings so output is identical on every OS.
 *
 * @param {string} path Relative path, used for the extension
 * @param {Buffer} content File content
 * @returns {Buffer} Normalized content
 */
export function normalizeContent(path, content) {
    const dot = path.lastIndexOf(".");

    if (dot === -1 || !TextExtensions.has(path.slice(dot))) {
        return content;
    }

    return Buffer.from(content.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
}

/**
 * Reads every file under a directory into a map keyed by POSIX relative path.
 *
 * @param {string} root Directory to read
 * @param {(relativePath: string, isDirectory: boolean) => boolean} [skip] Return true to skip an entry
 * @returns {Map<string, Buffer>} Relative path to normalized content, sorted by path
 */
export function readTree(root, skip = () => false) {
    const files = new Map();

    if (!existsSync(root)) {
        return files;
    }

    const walk = (relative) => {
        const absolute = relative ? join(root, ...relative.split("/")) : root;

        for (const entry of readdirSync(absolute, { withFileTypes: true })) {
            const path = relative ? `${relative}/${entry.name}` : entry.name;

            if (skip(path, entry.isDirectory())) {
                continue;
            }

            if (entry.isDirectory()) {
                walk(path);
            } else {
                files.set(path, normalizeContent(path, readFileSync(join(root, ...path.split("/")))));
            }
        }
    };

    walk("");

    return new Map([...files.entries()].sort(([left], [right]) => left < right ? -1 : 1));
}

/**
 * Writes a file map under a directory, creating folders as needed.
 *
 * @param {Map<string, Buffer>} files Relative path to content
 * @param {string} root Destination directory
 */
export function writeTree(files, root) {
    for (const [path, content] of files) {
        const target = join(root, ...path.split("/"));
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
    }
}

/**
 * Removes a directory recursively when it exists.
 *
 * @param {string} directory Directory to remove
 */
export function removeDirectory(directory) {
    rmSync(directory, { recursive: true, force: true });
}

/**
 * Compares an expected file map with the files on disk under a directory.
 *
 * @param {Map<string, Buffer>} expected Expected files
 * @param {string} root Directory on disk
 * @param {(relativePath: string, isDirectory: boolean) => boolean} [skip] Entries to ignore on disk
 * @returns {{ path: string, problem: "missing" | "changed" | "stale" }[]} Differences
 */
export function diffTree(expected, root, skip = () => false) {
    const actual = readTree(root, skip);
    const differences = [];

    for (const [path, content] of expected) {
        if (!actual.has(path)) {
            differences.push({ path, problem: "missing" });
        } else
        if (!actual.get(path).equals(content)) {
            differences.push({ path, problem: "changed" });
        }
    }

    for (const path of actual.keys()) {
        if (!expected.has(path)) {
            differences.push({ path, problem: "stale" });
        }
    }

    return differences;
}
