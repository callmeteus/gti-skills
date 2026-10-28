import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { readInstalls, readJson, recordInstalls, stateFolder, writeInstalls, writeJson } from "../core/Installs.mjs";
import { loadHarnesses, selectHarnesses, skillsFolder } from "../core/Registry.mjs";
import { discoverSkills } from "../core/Skills.mjs";
import { downloadTarball, extractTarball, fetchLatestCommit, SourceStamp, updateSource } from "../core/Source.mjs";
import { removeDirectory, writeTree } from "../core/Tree.mjs";

const CheckIntervalMs = 24 * 60 * 60 * 1000;

/**
 * Folder name of a downloaded commit. Twelve characters keep node_modules paths under the Windows path limit.
 *
 * @param {string} commit Commit hash
 * @returns {string} Folder name
 */
function sourceName(commit) {
    return commit.slice(0, 12);
}

/**
 * Shortens a commit hash for output.
 *
 * @param {string | null} commit Commit hash
 * @returns {string} Seven characters, or "unknown"
 */
function short(commit) {
    return commit ? commit.slice(0, 7) : "unknown";
}

/**
 * Finds skill folders installed before installs were recorded, in the user folders and the project folders under `cwd`.
 *
 * @param {import("../core/Installs.mjs").InstallRecord[]} known Recorded installs
 * @param {string} cwd Project root to scan
 * @param {string} home Home directory
 * @returns {import("../core/Installs.mjs").InstallRecord[]} Records with an unknown commit
 */
function findUntracked(known, cwd, home) {
    const ids = new Set(discoverSkills().map((skill) => skill.id));
    const recorded = new Set(known.map((record) => record.destination));
    const found = new Map();

    for (const harness of loadHarnesses()) {
        for (const scope of ["project", "user"]) {
            const folder = skillsFolder(harness, scope, cwd, home);

            if (!existsSync(folder)) {
                continue;
            }

            for (const entry of readdirSync(folder, { withFileTypes: true })) {
                const destination = join(folder, entry.name);

                if (!entry.isDirectory() || !ids.has(entry.name) || recorded.has(destination) || !existsSync(join(destination, "SKILL.md"))) {
                    continue;
                }

                const record = found.get(destination) ?? { destination, skill: entry.name, harnesses: [], scope, projectRoot: cwd, commit: null, installedAt: "" };
                record.harnesses.push(harness.id);
                found.set(destination, record);
            }
        }
    }

    return [...found.values()];
}

/**
 * Builds the install records an explicit `--harness` request targets, as `install` would write them.
 *
 * @param {Record<string, string | boolean>} flags Command flags
 * @param {string} cwd Current directory
 * @param {string} home Home directory
 * @param {import("../core/Installs.mjs").InstallRecord[]} known Recorded installs, used for their commits
 * @returns {import("../core/Installs.mjs").InstallRecord[]} Requested records
 */
function requestedTargets(flags, cwd, home, known) {
    const scope = typeof flags.scope === "string" ? flags.scope : "project";

    if (scope !== "project" && scope !== "user") {
        throw new Error(`Unknown --scope "${scope}". Use project or user.`);
    }

    const projectRoot = resolve(cwd, typeof flags.dest === "string" ? flags.dest : ".");
    const ids = typeof flags.skill === "string" && flags.skill !== "all" ? flags.skill.split(",").map((id) => id.trim()) : discoverSkills().map((skill) => skill.id);
    const targets = new Map();

    for (const harness of selectHarnesses(loadHarnesses(), flags.harness)) {
        for (const id of ids) {
            const destination = join(skillsFolder(harness, scope, projectRoot, home), id);
            const previous = known.find((record) => record.destination === destination);
            const record = targets.get(destination) ?? { destination, skill: id, harnesses: [], scope, projectRoot, commit: previous?.commit ?? null, installedAt: "" };
            record.harnesses.push(harness.id);
            targets.set(destination, record);
        }
    }

    return [...targets.values()];
}

/**
 * Downloads one commit into the source cache unless it is already there.
 *
 * @param {string} folder State folder
 * @param {{ repo: string, branch: string }} source Repository and branch
 * @param {string} commit Commit hash
 * @param {{ out: (line: string) => void }} io Output channels
 * @param {{ fetch?: typeof fetch }} options Fetch override
 * @returns {Promise<string>} Source tree root
 */
async function ensureSource(folder, source, commit, io, options) {
    const root = join(folder, "sources", sourceName(commit));

    if (readJson(join(root, SourceStamp), null)?.commit === commit) {
        io.out(`source   ${short(commit)} already downloaded`);

        return root;
    }

    const partial = `${root}.partial`;
    removeDirectory(partial);
    removeDirectory(root);
    io.out(`download ${source.repo}@${short(commit)}`);
    const count = extractTarball(await downloadTarball(source.repo, commit, options), partial);
    writeTree(new Map([[SourceStamp, Buffer.from(`${JSON.stringify({ repo: source.repo, branch: source.branch, commit }, null, 4)}\n`)]]), partial);
    renameSync(partial, root);
    io.out(`source   ${count} files in ${root}`);

    return root;
}

/**
 * Installs dependencies and builds the code packages that the updated skills drive.
 *
 * @param {string} root Source tree root
 * @param {Set<string>} skillIds Skills being updated
 * @param {{ out: (line: string) => void }} io Output channels
 * @returns {string | null} Error message, or null on success
 */
function buildPackages(root, skillIds, io) {
    const packages = new Set();

    for (const id of skillIds) {
        const manifest = readJson(join(root, "skills", id, "skill.json"), {});

        if (manifest.package) {
            packages.add(manifest.package);
        }
    }

    for (const relative of packages) {
        const cwd = join(root, ...relative.split("/"));
        const steps = [[existsSync(join(cwd, "package-lock.json")) ? "ci" : "install"], ["run", "build"]];

        for (const args of steps) {
            io.out(`build    npm ${args.join(" ")} in ${relative}`);
            // npm is a .cmd file on Windows, which only runs through a shell; the arguments are fixed strings.
            const result = spawnSync(`npm ${args.join(" ")}`, { cwd, shell: true, stdio: "ignore" });

            if (result.status !== 0) {
                return `npm ${args.join(" ")} failed in ${cwd}. Run it by hand, then rerun update, or pass --skip-build.`;
            }
        }
    }

    return null;
}

/**
 * Runs the install command of the downloaded source, so the newest installer writes the files.
 *
 * @param {string} root Source tree root
 * @param {import("../core/Installs.mjs").InstallRecord[]} targets Installs to refresh
 * @param {string} folder State folder, passed on so the new installer records into it
 * @param {{ out: (line: string) => void, err: (line: string) => void }} io Output channels
 * @returns {boolean} Whether every install succeeded
 */
function reinstall(root, targets, folder, io) {
    const groups = new Map();

    for (const target of targets) {
        const key = [target.scope, target.scope === "project" ? target.projectRoot : "", target.harnesses.join(",")].join("|");
        const group = groups.get(key) ?? { ...target, skills: [] };
        group.skills.push(target.skill);
        groups.set(key, group);
    }

    let ok = true;

    for (const group of groups.values()) {
        const args = [join(root, "packages", "cli"), "install", "--harness", group.harnesses.join(","), "--skill", group.skills.join(","), "--scope", group.scope, "--dest", group.projectRoot];
        const result = spawnSync(process.execPath, args, { encoding: "utf8", env: { ...process.env, GTI_SKILLS_HOME: folder } });

        for (const line of (result.stdout ?? "").split(/\r?\n/).filter(Boolean)) {
            io.out(line);
        }

        if (result.status !== 0) {
            ok = false;
            io.err(`Install failed for ${group.skills.join(", ")} (${group.harnesses.join(", ")}): ${(result.stderr ?? "").trim() || `exit ${result.status}`}`);
        }
    }

    return ok;
}

/**
 * Updates installed skills to the latest commit on the GitHub branch (master by default).
 * There are no releases: the commit hash is the version.
 *
 * Without --harness, refreshes every recorded install and any untracked install found in the user
 * folders or under the current directory. With --harness, --skill, --scope, and --dest, installs
 * exactly that selection from the latest commit. Flags: --check, --dry-run, --force, --skip-build.
 *
 * @param {Record<string, string | boolean>} flags Command flags
 * @param {{ out: (line: string) => void, err: (line: string) => void }} io Output channels
 * @param {{ cwd?: string, home?: string, stateDir?: string, fetch?: typeof fetch }} [environment] Overrides used by tests
 * @returns {Promise<number>} Exit code
 */
export async function runUpdate(flags, io, environment = {}) {
    const cwd = environment.cwd ?? process.cwd();
    const home = environment.home ?? homedir();
    const folder = stateFolder({ home, stateDir: environment.stateDir });
    const source = updateSource();
    let latest;

    try {
        latest = await fetchLatestCommit(source, environment);
    } catch (error) {
        io.err(`Could not read the latest commit: ${error.message}`);

        return 1;
    }

    writeJson(join(folder, "state.json"), { checkedAt: new Date().toISOString(), latest });
    io.out(`latest   ${source.repo}@${source.branch} is ${short(latest)}`);

    const known = readInstalls(folder).filter((record) => existsSync(record.destination));
    let targets;

    try {
        targets = typeof flags.harness === "string" ? requestedTargets(flags, cwd, home, known) : [...known, ...findUntracked(known, cwd, home)];
    } catch (error) {
        io.err(error.message);

        return 1;
    }

    if (targets.length === 0) {
        io.out("Nothing to update: no installed skills were found. Pass --harness to install from the latest commit.");

        return 0;
    }

    const stale = targets.filter((target) => flags.force === true || target.commit !== latest);

    for (const target of targets) {
        const label = stale.includes(target) ? `${short(target.commit)} -> ${short(latest)}` : "up to date";
        io.out(`${stale.includes(target) ? "outdated" : "current "} ${target.skill} at ${target.destination} (${label})`);
    }

    if (stale.length === 0) {
        io.out(`Everything is at ${short(latest)}.`);

        return 0;
    }

    if (flags.check === true || flags["dry-run"] === true) {
        io.out(`${stale.length} install(s) would be updated. Run \`node packages/cli update\` to apply.`);

        return 0;
    }

    let root;

    try {
        root = await ensureSource(folder, source, latest, io, environment);
    } catch (error) {
        io.err(`Could not download ${short(latest)}: ${error.message}`);

        return 1;
    }

    const available = new Set(readdirSync(join(root, "skills")));
    const removed = stale.filter((target) => !available.has(target.skill));

    for (const target of removed) {
        io.err(`Skill ${target.skill} does not exist on ${source.branch}; left ${target.destination} as it is.`);
    }

    const refresh = stale.filter((target) => available.has(target.skill));

    if (flags["skip-build"] !== true) {
        const failure = buildPackages(root, new Set(refresh.map((target) => target.skill)), io);

        if (failure) {
            io.err(failure);

            return 1;
        }
    }

    const ok = reinstall(root, refresh, folder, io);

    if (ok) {
        // Older installers on master do not record installs, so record the refreshed folders here too.
        const installedAt = new Date().toISOString();
        recordInstalls(folder, refresh.filter((target) => existsSync(target.destination)).map((target) => ({ ...target, commit: latest, installedAt })));
    }

    writeInstalls(folder, readInstalls(folder).filter((record) => existsSync(record.destination)));

    if (ok && removed.length === 0) {
        for (const entry of readdirSync(join(folder, "sources"))) {
            if (entry !== sourceName(latest)) {
                removeDirectory(join(folder, "sources", entry));
            }
        }
    }

    io.out(ok ? `Updated ${refresh.length} install(s) to ${short(latest)}.` : "Some installs failed; see the errors above.");

    return ok ? 0 : 1;
}

/**
 * Prints a notice when recorded installs are older than the latest commit. Checks GitHub at most
 * once a day and never fails the command. Skipped when CI or GTI_SKILLS_NO_UPDATE_CHECK is set.
 *
 * @param {{ err: (line: string) => void }} io Output channels
 * @param {{ home?: string, stateDir?: string, fetch?: typeof fetch, now?: number }} [environment] Overrides used by tests
 * @returns {Promise<void>}
 */
export async function notifyUpdate(io, environment = {}) {
    if (process.env.CI || process.env.GTI_SKILLS_NO_UPDATE_CHECK) {
        return;
    }

    const folder = stateFolder(environment);
    const installs = readInstalls(folder).filter((record) => existsSync(record.destination));

    if (installs.length === 0) {
        return;
    }

    const now = environment.now ?? Date.now();
    const state = readJson(join(folder, "state.json"), {});
    let latest = state.latest;

    if (!latest || !(now - Date.parse(state.checkedAt) < CheckIntervalMs)) {
        try {
            latest = await fetchLatestCommit(updateSource(), { ...environment, timeoutMs: 2000 });
            writeJson(join(folder, "state.json"), { checkedAt: new Date(now).toISOString(), latest });
        } catch {
            return;
        }
    }

    const outdated = installs.filter((record) => record.commit !== latest).length;

    if (outdated > 0) {
        io.err(`notice   ${outdated} installed skill(s) are older than master (${short(latest)}). Run \`node packages/cli update\` to update them.`);
    }
}
