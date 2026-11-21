import { isAbsolute, relative, resolve, sep } from "node:path";

import { VideoErrors } from "./Errors";

/**
 * Filesystem helpers that keep generated files inside a project root.
 */
export const Paths = {
    /** Resolves a path relative to a base directory. */
    resolve(base: string, value: string): string {
        return isAbsolute(value) ? resolve(value) : resolve(base, value);
    },

    /** Converts a path to forward slashes for JSON and specs. */
    posix(value: string): string {
        return value.split(sep).join("/");
    },

    /** Ensures a path stays inside root, so a spec cannot read outside the project. */
    confine(root: string, candidate: string): string {
        const resolved = resolve(candidate);
        const rel = relative(resolve(root), resolved);

        if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
            throw VideoErrors.path(`Path is outside the project: ${candidate}`);
        }

        return resolved;
    }
};
