import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, renameSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { readInstalls, readJson, recordInstalls, stateFolder, writeInstalls, writeJson } from "../core/Installs.mjs";
import { loadMigrations, pendingMigrations, runMigrations } from "../core/Migrations.mjs";
import { loadPacks, selectSkills } from "../core/Packs.mjs";
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
    const ids = selectSkills(discoverSkills(), loadPacks(), flags).map((skill) => skill.id);
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
 * Builds install records for skills that exist in this CLI's source but are missing from a full
 * install folder. A partial install stays exactly as the user chose it.
 *
 * @param {import("../core/Installs.mjs").InstallRecord[]} known Recorded installs
 * @param {import("../core/Installs.mjs").InstallRecord[]} untracked Install folders found on disk
 * @param {Record<string, string | boolean>} flags Command flags
 * @returns {import("../core/Installs.mjs").InstallRecord[]} Missing install records
 */
function newInstallTargets(known, untracked, flags) {
    if (flags["install-new"] !== true || flags["no-install-new"] === true) {
        return [];
    }

    const skills = discoverSkills();
    const byId = new Map(skills.map((skill) => [skill.id, skill]));
    const packIds = new Set(skills.flatMap((skill) => skill.packs));
    const taken = new Set([...known, ...untracked].map((record) => record.destination));
    const groups = new Map();

    for (const record of known) {
        const folder = dirname(record.destination);
        const key = [record.scope, record.scope === "project" ? record.projectRoot : "", folder].join("|");
        const group = groups.get(key) ?? { scope: record.scope, projectRoot: record.projectRoot, folder, harnesses: record.harnesses, ids: new Set(), full: false };
        group.ids.add(record.skill);
        group.full = group.full || record.full === true;
        groups.set(key, group);
    }

    const targets = [];

    for (const group of groups.values()) {
        const installedPacks = new Set();

        for (const id of group.ids) {
            for (const pack of byId.get(id)?.packs ?? []) {
                installedPacks.add(pack);
            }
        }

        const coversAll = packIds.size > 0 && [...packIds].every((id) => installedPacks.has(id));

        if (!group.full && !coversAll) {
            continue;
        }

        for (const skill of skills) {
            if (group.ids.has(skill.id)) {
                continue;
            }

            const destination = join(group.folder, skill.id);

            if (taken.has(destination) || existsSync(destination)) {
                continue;
            }

            targets.push({ destination, skill: skill.id, harnesses: group.harnesses, scope: group.scope, projectRoot: group.projectRoot, commit: null, installedAt: "" });
        }
    }

    return targets;
}

/**
 * Removes old source downloads, keeping the latest and the one before it. Programs started from
 * the previous source, such as a running Art Director studio, still read files from it.
 *
 * @param {string} folder State folder
 * @param {string} latest Commit that was just installed
 */
function pruneSources(folder, latest) {
    const sources = join(folder, "sources");
    const older = readdirSync(sources)
        .filter((entry) => entry !== sourceName(latest) && !entry.endsWith(".partial"))
        .map((entry) => ({ entry, time: downloadedAt(join(sources, entry)) }))
        .sort((a, b) => b.time - a.time);

    for (const { entry } of older.slice(1)) {
        removeDirectory(join(sources, entry));
    }
}

/**
 * @param {string} root Source tree root
 * @returns {number} When the source was downloaded, or 0 when it has no stamp
 */
function downloadedAt(root) {
    try {
        return statSync(join(root, SourceStamp)).mtimeMs;
    } catch {
        return 0;
    }
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
 * The npm steps that prepare one code package: install its dependencies, then run its build script
 * when it declares one. A package with no build step, such as one that ships plain JavaScript, only installs.
 *
 * @param {string} cwd Package folder
 * @returns {string[][]} npm argument lists, in order
 */
export function buildSteps(cwd) {
    const manifest = readJson(join(cwd, "package.json"), {});
    const steps = [[existsSync(join(cwd, "package-lock.json")) ? "ci" : "install"]];

    if (manifest.scripts?.build) {
        steps.push(["run", "build"]);
    }

    return steps;
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

        for (const args of buildSteps(cwd)) {
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
 * folders or under the current directory. With --install-new, it also installs skills that are
 * missing from an install that uses every pack; a partial install stays as chosen. With --harness,
 * --skill, --pack, --scope, and --dest, installs exactly that selection from the latest commit.
 * Flags: --check, --dry-run, --force, --skip-build, --install-new, --no-install-new.
 *
 * Before anything else it runs the pending migrations from `packages/cli/migrations/`, which move
 * state left by older versions of the CLI. With --check or --dry-run it only lists them.
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
    // As migrations rodam antes de qualquer leitura do estado, pois o estado antigo pode estar em outra pasta
    const context = { folder, home, defaultFolder: folder === join(home, ".gti", "skills"), out: io.out };
    const migrations = await loadMigrations();

    // Em --check e --dry-run nada é alterado: só avisa quais migrations rodariam
    if (flags.check === true || flags["dry-run"] === true) {
        for (const migration of pendingMigrations(context, migrations)) {
            io.out(`migrate  ${migration.id} would run: ${migration.description}`);
        }
    } else {
        try {
            runMigrations(context, migrations);
        } catch (error) {
            io.err(`Migration failed: ${error.message}`);

            return 1;
        }
    }

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
    let fresh = [];

    try {
        if (typeof flags.harness === "string") {
            targets = requestedTargets(flags, cwd, home, known);
        } else {
            const untracked = findUntracked(known, cwd, home);
            fresh = newInstallTargets(known, untracked, flags);
            targets = [...known, ...untracked, ...fresh];
        }
    } catch (error) {
        io.err(error.message);

        return 1;
    }

    if (targets.length === 0) {
        io.out("Nothing to update: no installed skills were found. Pass --harness to install from the latest commit.");

        return 0;
    }

    const freshDestinations = new Set(fresh.map((target) => target.destination));
    const stale = targets.filter((target) => flags.force === true || target.commit !== latest);
    const staleDestinations = new Set(stale.map((target) => target.destination));

    for (const target of targets) {
        const isNew = freshDestinations.has(target.destination);
        const isStale = staleDestinations.has(target.destination);
        const label = isNew ? `new -> ${short(latest)}` : isStale ? `${short(target.commit)} -> ${short(latest)}` : "up to date";
        io.out(`${isNew ? "new     " : isStale ? "outdated" : "current "} ${target.skill} at ${target.destination} (${label})`);
    }

    if (stale.length === 0) {
        io.out(`Everything is at ${short(latest)}.`);

        return 0;
    }

    if (flags.check === true || flags["dry-run"] === true) {
        const added = stale.filter((target) => freshDestinations.has(target.destination)).length;
        const updated = stale.length - added;

        if (updated > 0) {
            io.out(`${updated} install(s) would be updated.`);
        }

        if (added > 0) {
            io.out(`${added} new skill install(s) would be added.`);
        }

        io.out("Run `node packages/cli update` to apply.");

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
    const removed = stale.filter((target) => !freshDestinations.has(target.destination) && !available.has(target.skill));

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
        pruneSources(folder, latest);
    }

    const added = refresh.filter((target) => freshDestinations.has(target.destination)).length;
    const updated = refresh.length - added;
    const summary = [updated > 0 ? `Updated ${updated} install(s)` : null, added > 0 ? `installed ${added} new install(s)` : null].filter(Boolean).join(" and ");

    io.out(ok ? `${summary || "Nothing changed"} at ${short(latest)}.` : "Some installs failed; see the errors above.");

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
