import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { renderGenerated, renderGuide } from "./Generated.mjs";
import { RepoPaths, RepoRoot } from "./Paths.mjs";
import { readTree, writeTree } from "./Tree.mjs";

const IgnoredNames = new Set(["__pycache__", "node_modules", ".DS_Store", ".gitkeep"]);
const RootOnlyNames = new Set(["README.md", "skill.json", "tests"]);

/**
 * @typedef {object} Skill
 * @property {string} id Skill id: folder name, frontmatter name, and install folder
 * @property {string} displayName Name shown in documentation
 * @property {string} dir Absolute folder that holds skill.json and SKILL.md
 * @property {Record<string, string>} harnessNotes Extra sentence per agent id, added to that agent's guide
 * @property {string | null} packageDir Absolute package the skill drives, or null
 * @property {string | null} rootPointer File (relative to the installed skill) that receives the package path
 * @property {{ from: string, to: string }[]} shared Folders copied from shared packages
 * @property {{ to: string, template: string }[]} generated Documents generated from the registry
 */

/**
 * Finds every skill that has a skill.json.
 *
 * @param {string} [skillsDir] Skills folder, defaults to the repository skills folder
 * @returns {Skill[]} Skills sorted by id
 */
export function discoverSkills(skillsDir = RepoPaths.skills) {
    const skills = [];

    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
        const manifest = join(skillsDir, entry.name, "skill.json");

        if (!entry.isDirectory() || !existsSync(manifest)) {
            continue;
        }

        const config = JSON.parse(readFileSync(manifest, "utf8"));

        if (config.id !== entry.name) {
            throw new Error(`skill.json id "${config.id}" must equal the folder name "${entry.name}"`);
        }

        skills.push({
            id: config.id,
            displayName: config.displayName ?? config.id,
            dir: join(skillsDir, entry.name),
            harnessNotes: config.harnessNotes ?? {},
            packageDir: config.package ? join(RepoRoot, ...config.package.split("/")) : null,
            rootPointer: config.rootPointer ?? null,
            shared: config.shared ?? [],
            generated: config.generated ?? []
        });
    }

    return skills.sort((left, right) => left.id < right.id ? -1 : 1);
}

/**
 * Builds the skip rule for files that never belong in an installed skill.
 *
 * @param {Skill} skill Skill being read
 * @returns {(relativePath: string, isDirectory: boolean) => boolean} Skip predicate
 */
export function skillSkip(skill) {
    return (path) => {
        const parts = path.split("/");
        const name = parts[parts.length - 1];

        if (parts.length === 1 && RootOnlyNames.has(name)) {
            return true;
        }

        if (parts[0] === "harnesses" && parts[2] === "project-files") {
            return true;
        }

        return IgnoredNames.has(name) || name.endsWith(".pyc") || name.endsWith(".root");
    };
}

/**
 * True for the generated per-agent guides, so guides of removed agents count as stale.
 *
 * @param {string} path Path relative to the skill folder
 * @returns {boolean} Whether the path is `harnesses/<id>/GUIDE.md`
 */
export function isGuide(path) {
    return /^harnesses\/[^/]+\/GUIDE\.md$/.test(path);
}

/**
 * Skip rule for shared source folders.
 *
 * @returns {(relativePath: string) => boolean} Skip predicate
 */
function sharedSkip() {
    return (path) => {
        const name = path.split("/").pop();

        return IgnoredNames.has(name) || name.endsWith(".pyc");
    };
}

/**
 * Computes the files an installed skill contains, with shared and generated files applied.
 *
 * @param {Skill} skill Skill to load
 * @param {import("./Registry.mjs").Harness[]} harnesses Harness registry, used by generated documents
 * @returns {{ files: Map<string, Buffer>, regions: string[] }} Files and the paths that are synced from elsewhere
 */
export function loadSkillFiles(skill, harnesses) {
    const files = readTree(skill.dir, skillSkip(skill));
    const regions = [];

    for (const mapping of skill.shared) {
        const source = readTree(join(RepoRoot, ...mapping.from.split("/")), sharedSkip());
        const tops = new Set([...source.keys()].map((path) => path.split("/")[0]));

        for (const top of tops) {
            const region = `${mapping.to}/${top}`;
            regions.push(region);

            for (const path of [...files.keys()]) {
                if (path === region || path.startsWith(`${region}/`)) {
                    files.delete(path);
                }
            }
        }

        for (const [path, content] of source) {
            files.set(`${mapping.to}/${path}`, content);
        }
    }

    for (const item of skill.generated) {
        regions.push(item.to);
        files.set(item.to, Buffer.from(renderGenerated(item.template, harnesses), "utf8"));
    }

    for (const harness of harnesses) {
        const guide = `harnesses/${harness.id}/GUIDE.md`;
        regions.push(guide);
        files.set(guide, Buffer.from(renderGuide(skill, harness), "utf8"));
    }

    return {
        files: new Map([...files.entries()].sort(([left], [right]) => left < right ? -1 : 1)),
        regions
    };
}

/**
 * Reads the files a skill adds to the project root for one agent, such as a slash command file.
 * They live in `harnesses/<agent id>/project-files/` and are not part of the installed skill.
 *
 * @param {Skill} skill Skill to read
 * @param {string} harnessId Harness id
 * @returns {Map<string, Buffer>} Path relative to the project root to content
 */
export function loadProjectFiles(skill, harnessId) {
    return readTree(join(skill.dir, "harnesses", harnessId, "project-files"));
}

/**
 * Writes the synced regions of a skill into its source folder so they are committed.
 *
 * @param {Skill} skill Skill to sync
 * @param {Map<string, Buffer>} files Files from loadSkillFiles
 * @param {string[]} regions Regions from loadSkillFiles
 */
export function writeSyncedRegions(skill, files, regions) {
    for (const region of regions) {
        rmSync(join(skill.dir, ...region.split("/")), { recursive: true, force: true });
    }

    for (const path of readTree(skill.dir, skillSkip(skill)).keys()) {
        if (isGuide(path)) {
            rmSync(join(skill.dir, ...path.split("/")), { force: true });
        }
    }

    const synced = new Map();

    for (const [path, content] of files) {
        if (regions.some((region) => path === region || path.startsWith(`${region}/`))) {
            synced.set(path, content);
        }
    }

    writeTree(synced, skill.dir);
}
