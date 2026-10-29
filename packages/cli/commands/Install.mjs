import { chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { recordInstalls, stateFolder } from "../core/Installs.mjs";
import { loadPacks, selectSkills } from "../core/Packs.mjs";
import { loadHarnesses, selectHarnesses, skillsFolder } from "../core/Registry.mjs";
import { discoverSkills, loadProjectFiles, loadSkillFiles } from "../core/Skills.mjs";
import { sourceCommit } from "../core/Source.mjs";
import { removeDirectory, writeTree } from "../core/Tree.mjs";

/**
 * Marks shell wrappers and scripts with a shebang as executable.
 *
 * @param {Map<string, Buffer>} files Skill files by relative path
 * @param {string} destination Installed skill folder
 */
function markExecutables(files, destination) {
    for (const [path, content] of files) {
        const name = path.split("/").pop();
        const isScript = path.startsWith("scripts/") && (!name.includes(".") || content.subarray(0, 2).toString() === "#!");

        if (isScript) {
            try {
                chmodSync(join(destination, ...path.split("/")), 0o755);
            } catch {
                // Windows file systems have no executable bit.
            }
        }
    }
}

/**
 * Installs skills into the skill folders of one or more coding agents.
 *
 * Flags: --harness <ids|all> (required), --skill <ids|all>, --pack <ids|all>, --scope project|user,
 * --dest <project root, default current directory>, --dry-run.
 * Each installed folder is recorded with its source commit so `update` can refresh it later.
 *
 * @param {Record<string, string | boolean>} flags Command flags
 * @param {{ out: (line: string) => void, err: (line: string) => void }} io Output channels
 * @param {{ cwd?: string, home?: string, stateDir?: string }} [environment] Overrides used by tests
 * @returns {number} Exit code
 */
export function runInstall(flags, io, environment = {}) {
    const cwd = environment.cwd ?? process.cwd();
    const home = environment.home ?? homedir();
    const scope = typeof flags.scope === "string" ? flags.scope : "project";
    const dryRun = flags["dry-run"] === true;

    if (typeof flags.harness !== "string") {
        io.err("Missing --harness. Use a comma separated list of agent ids, or all. Run `node packages/cli list` to see them.");

        return 1;
    }

    if (scope !== "project" && scope !== "user") {
        io.err(`Unknown --scope "${scope}". Use project or user.`);

        return 1;
    }

    const harnesses = loadHarnesses();
    const skills = discoverSkills();
    let selectedSkills;

    try {
        selectedSkills = selectSkills(skills, loadPacks(), flags);
    } catch (error) {
        io.err(error.message);

        return 1;
    }

    if (selectedSkills.length === 0) {
        io.out(`Nothing to install: pack ${flags.pack} has no skills yet.`);

        return 0;
    }

    let selectedHarnesses;

    try {
        selectedHarnesses = selectHarnesses(harnesses, flags.harness);
    } catch (error) {
        io.err(error.message);

        return 1;
    }

    const projectRoot = resolve(cwd, typeof flags.dest === "string" ? flags.dest : ".");
    const written = new Map();
    const records = new Map();
    const commit = dryRun ? null : sourceCommit();
    const installedAt = new Date().toISOString();

    for (const harness of selectedHarnesses) {
        const folder = skillsFolder(harness, scope, projectRoot, home);

        for (const skill of selectedSkills) {
            const destination = join(folder, skill.id);
            const record = records.get(destination) ?? { destination, skill: skill.id, harnesses: [], scope, projectRoot, commit, installedAt };
            record.harnesses.push(harness.id);
            records.set(destination, record);

            if (written.has(destination)) {
                io.out(`skip     ${skill.id} for ${harness.id}: same folder as ${written.get(destination)}`);
                continue;
            }

            written.set(destination, harness.id);
            const { files } = loadSkillFiles(skill, harnesses);

            if (skill.rootPointer && skill.packageDir) {
                files.set(skill.rootPointer, Buffer.from(skill.packageDir, "utf8"));
            }

            io.out(`${dryRun ? "would    " : "install  "}${skill.id} -> ${destination}`);

            if (!dryRun) {
                removeDirectory(destination);
                writeTree(files, destination);
                markExecutables(files, destination);
            }

            const projectFiles = loadProjectFiles(skill, harness.id);

            if (projectFiles.size > 0 && scope === "project") {
                io.out(`${dryRun ? "would    " : "project  "}${[...projectFiles.keys()].join(", ")} -> ${projectRoot}`);

                if (!dryRun) {
                    writeTree(projectFiles, projectRoot);
                }
            } else
            if (projectFiles.size > 0) {
                io.out(`note     ${skill.id} has project files for ${harness.id} that only install at project scope`);
            }
        }
    }

    if (!dryRun) {
        recordInstalls(stateFolder({ home, stateDir: environment.stateDir }), [...records.values()]);
    }

    return 0;
}
