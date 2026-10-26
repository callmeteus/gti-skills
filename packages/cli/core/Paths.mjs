import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Absolute path of the repository root (packages/cli/core is three levels below it).
 */
export const RepoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * Well-known repository folders.
 */
export const RepoPaths = {
    skills: join(RepoRoot, "skills"),
    harnesses: join(RepoRoot, "harnesses"),
    registry: join(RepoRoot, "packages", "cli", "registry", "harnesses.json")
};
