import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { ArtErrors } from "./Errors";

const PackageMarker = "package.json";
const ProjectDir = ".artdirector";

/**
 * Resolves package, project, and confined artwork paths.
 */
export namespace Paths {
    /**
     * Walks up from this module to the ArtDirector package root.
     *
     * @returns Absolute package root
     */
    export function packageRoot(): string {
        let current = dirname(fileURLToPath(import.meta.url));

        for (let i = 0; i < 8; i += 1) {
            const candidate = join(current, PackageMarker);

            if (existsSync(candidate)) {
                return current;
            }

            current = dirname(current);
        }

        throw ArtErrors.path("Could not locate the ArtDirector package root.");
    }

    /**
     * Studio static files shipped with the package.
     *
     * @returns Absolute studio directory
     */
    export function studioDir(): string {
        return join(packageRoot(), "studio");
    }

    /**
     * HTML template and direction library.
     *
     * @returns Absolute library directory
     */
    export function libraryDir(): string {
        return join(packageRoot(), "library");
    }

    /**
     * Canonical skill files.
     *
     * @returns Absolute skill directory
     */
    export function skillDir(): string {
        return join(packageRoot(), "skill", "artdirector");
    }

    /**
     * Finds an ArtDirector project by walking up from `start`.
     *
     * @param start Directory to start from
     * @returns Project root or null
     */
    export function findProjectRoot(start = process.cwd()): string | null {
        let current = resolve(start);

        for (let i = 0; i < 12; i += 1) {
            if (existsSync(join(current, ProjectDir, "project.json"))) {
                return current;
            }

            const parent = dirname(current);

            if (parent === current) {
                break;
            }

            current = parent;
        }

        return null;
    }

    /**
     * True when a directory already holds an ArtDirector project.
     *
     * @param projectRoot Candidate project root
     * @returns Whether `project.json` exists
     */
    export function hasProject(projectRoot: string): boolean {
        return existsSync(join(projectRoot, ProjectDir, "project.json"));
    }

    /**
     * Returns `.artdirector` under a project root, creating it when needed.
     *
     * @param projectRoot Project root
     * @returns Absolute state directory
     */
    export function stateDir(projectRoot: string): string {
        const dir = join(projectRoot, ProjectDir);
        mkdirSync(dir, { recursive: true });
        return dir;
    }

    /**
     * Variant source directory.
     *
     * @param projectRoot Project root
     * @returns Absolute variants directory
     */
    export function variantsDir(projectRoot: string): string {
        const dir = join(stateDir(projectRoot), "variants");
        mkdirSync(dir, { recursive: true });
        return dir;
    }

    /**
     * Export output directory.
     *
     * @param projectRoot Project root
     * @returns Absolute exports directory
     */
    export function exportsDir(projectRoot: string): string {
        const dir = join(stateDir(projectRoot), "exports");
        mkdirSync(dir, { recursive: true });
        return dir;
    }

    /**
     * Resolves a path inside the project and rejects escapes.
     *
     * @param projectRoot Project root
     * @param target Absolute or project-relative path
     * @returns Confined absolute path
     */
    export function confine(projectRoot: string, target: string): string {
        const root = resolve(projectRoot);
        const absolute = resolve(isAbsolute(target) ? target : join(root, target));
        const rel = relative(root, absolute);

        if (rel.startsWith("..") || isAbsolute(rel)) {
            throw ArtErrors.path(`Path is outside the project root: ${target}`);
        }

        return normalize(absolute);
    }

    /**
     * True when a path exists and is a directory.
     *
     * @param path Candidate path
     * @returns Whether the path is a directory
     */
    export function isDir(path: string): boolean {
        try {
            return statSync(path).isDirectory();
        } catch {
            return false;
        }
    }

    /**
     * Joins segments with the platform separator after confinement.
     *
     * @param projectRoot Project root
     * @param segments Path segments under the root
     * @returns Confined absolute path
     */
    export function under(projectRoot: string, ...segments: string[]): string {
        return confine(projectRoot, join(projectRoot, ...segments));
    }

    /**
     * File URL path separator helper for Windows.
     *
     * @param path Absolute path
     * @returns POSIX-looking path for logs
     */
    export function posix(path: string): string {
        return path.split(sep).join("/");
    }
}
