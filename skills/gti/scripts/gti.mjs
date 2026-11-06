#!/usr/bin/env node
/**
 * gti: keeps gti-skills skills and MCP servers up to date on this machine.
 *
 * Commands:
 *   status                              What is installed and what is out of date
 *   update [--dry-run]                  skills update, then mcps update
 *   skills update [--check] [...flags]  Runs the gti-skills CLI `update` from the latest commit
 *   mcps list                           MCP servers in gti-skills and where each is registered
 *   mcps update [--only a,b] [--dry-run] [--skip-deps]
 *                                       Refreshes managed installs and repoints existing registrations
 *   mcps install <names|all> [--agents ids|all] [--dry-run] [--skip-deps]
 *                                       Installs and registers MCP servers in agents
 *
 * Common flags: --source DIR (use a local gti-skills checkout instead of the latest commit),
 * --home DIR (default ~/.gti-skills or GTI_SKILLS_HOME), --user-home DIR (where agent configs live).
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AGENTS, MANUAL_AGENTS, entryScript, existingAgents, matchEntries, readConfig, setEntry, writeConfig } from "./core/agents.mjs";
import { carryState, discoverMcps, installDeps, installDir, markDepsInstalled, syncFiles, venvPython } from "./core/mcps.mjs";
import { cachedSource, ensureLatestSource, gtiHome, stampedCommit } from "./core/source.mjs";

function parseArgs(argv) {
    const flags = { positional: [], passthrough: [] };
    for (let index = 0; index < argv.length; index++) {
        const value = argv[index];
        const take = () => {
            if (index + 1 >= argv.length) throw new Error(`${value} needs a value`);
            return argv[++index];
        };
        if (value === "--dry-run") flags.dryRun = true;
        else if (value === "--skip-deps") flags.skipDeps = true;
        else if (value === "--check") flags.check = true;
        else if (value === "--source") flags.source = take();
        else if (value === "--home") flags.home = take();
        else if (value === "--user-home") flags.userHome = take();
        else if (value === "--only") flags.only = take().split(",").map((s) => s.trim()).filter(Boolean);
        else if (value === "--agents") flags.agents = take();
        else if (value.startsWith("--")) {
            flags.passthrough.push(value);
            if (argv[index + 1] && !argv[index + 1].startsWith("--")) flags.passthrough.push(argv[++index]);
        } else flags.positional.push(value);
    }
    return flags;
}

async function resolveSource(flags, io) {
    if (flags.source) {
        const root = resolve(flags.source);
        if (!existsSync(join(root, "packages", "cli", "index.mjs"))) throw new Error(`${root} is not a gti-skills checkout`);
        return { root, commit: stampedCommit(root) ?? "local checkout" };
    }
    try {
        const source = await ensureLatestSource({ home: flags.home ?? gtiHome() });
        io.out(source.downloaded ? `source   downloaded ${source.commit.slice(0, 7)}` : `source   latest is ${source.commit.slice(0, 7)} (already downloaded)`);
        return source;
    } catch (error) {
        const cached = cachedSource(flags.home ?? gtiHome());
        if (!cached) throw error;
        io.err(`warning  could not reach GitHub (${error.message}); using the downloaded ${cached.commit.slice(0, 7)}`);
        return cached;
    }
}

function skillsUpdate(source, flags, io, run = spawnSync) {
    const args = [join(source.root, "packages", "cli"), "update"];
    if (flags.check || flags.dryRun) args.push(flags.check ? "--check" : "--dry-run");
    args.push(...flags.passthrough);
    const env = { ...process.env, GTI_SKILLS_NO_UPDATE_CHECK: "1" };
    if (flags.home) env.GTI_SKILLS_HOME = flags.home;
    io.out(`skills   node packages/cli ${args.slice(1).join(" ")}`);
    const result = run(process.execPath, args, { stdio: "inherit", env });
    return result.status ?? 1;
}

function configsFor(userHome) {
    const configs = {};
    for (const agent of Object.keys(AGENTS)) {
        const config = readConfig(agent, userHome);
        if (config) configs[agent] = config;
    }
    return configs;
}

/** Plans and applies MCP work. Exported for tests. */
export function runMcps({ mode, names, agents, source, home, userHome, dryRun, skipDeps, deps = installDeps, io }) {
    const all = discoverMcps(source.root);
    const configs = configsFor(userHome);
    const touched = new Set();
    const report = [];

    let selected = all;
    if (names && !(names.length === 1 && names[0] === "all")) {
        const unknown = names.filter((n) => !all.some((m) => m.aliases.includes(n)));
        if (unknown.length) throw new Error(`Unknown MCP: ${unknown.join(", ")}. Known: ${all.map((m) => m.name).join(", ")}`);
        selected = all.filter((m) => m.aliases.some((a) => names.includes(a)));
    }

    let installAgents = [];
    if (mode === "install") {
        installAgents = !agents || agents === "existing" ? existingAgents(userHome) : agents === "all" ? Object.keys(AGENTS) : agents.split(",");
        const bad = installAgents.filter((a) => !AGENTS[a]);
        if (bad.length) throw new Error(`Cannot register in ${bad.join(", ")} automatically. Supported: ${Object.keys(AGENTS).join(", ")}`);
    }

    for (const mcp of selected) {
        const dir = installDir(home, mcp);
        const managed = existsSync(join(dir, ".gti-mcp.json"));
        const matches = Object.values(configs).flatMap((config) => matchEntries(config, mcp).map((entry) => ({ config, entry })));
        if (mode === "update" && !managed && matches.length === 0) {
            report.push({ name: mcp.name, status: "not installed" });
            continue;
        }
        const python = venvPython(dir);
        const script = join(dir, mcp.entry);
        const line = { name: mcp.name, dir, registrations: [], carried: [] };

        if (!dryRun) {
            const sync = syncFiles(mcp, dir, source.commit);
            line.files = sync.fresh ? "installed" : `${sync.changed} changed, ${sync.removed.length} removed`;
            for (const { entry } of matches) {
                const old = entryScript(entry);
                if (old) line.carried.push(...carryState(dirname(old), dir, mcp));
            }
            if (skipDeps) line.deps = "skipped";
            else if (sync.depsCurrent) line.deps = "current";
            else {
                deps(mcp, dir, { stdio: "inherit" });
                markDepsInstalled(dir);
                line.deps = "installed";
            }
        } else {
            line.files = managed ? "would sync" : "would install";
        }

        const targets = matches.map(({ config, entry }) => ({ config, key: entry.key, from: entryScript(entry) }));
        for (const agent of installAgents) {
            const config = configs[agent] ?? (configs[agent] = { agent, file: AGENTS[agent].path(userHome), kind: AGENTS[agent].kind, data: {}, text: "" });
            if (config.error) continue;
            if (!targets.some((t) => t.config === config)) targets.push({ config, key: mcp.name, from: null });
        }
        for (const target of targets) {
            if (target.config.error) {
                line.registrations.push(`${target.config.agent}: ${target.config.error}`);
                continue;
            }
            const changed = setEntry(target.config, target.key, python, script);
            if (changed) touched.add(target.config);
            const action = changed ? (target.from ? "repointed" : "added") : "current";
            line.registrations.push(`${target.config.agent}:${target.key} ${dryRun && changed ? `would be ${action}` : action}`);
        }
        if (mcp.login) line.login = `${python} ${join(dir, "login.py")}`;
        report.push(line);
    }

    const backups = [];
    if (!dryRun) for (const config of touched) backups.push(writeConfig(config));

    for (const line of report) {
        if (line.status) {
            io.out(`mcp      ${line.name}: ${line.status}`);
            continue;
        }
        io.out(`mcp      ${line.name}: files ${line.files}${line.deps ? `, deps ${line.deps}` : ""}`);
        for (const reg of line.registrations) io.out(`           ${reg}`);
        if (line.carried.length) io.out(`           kept login state: ${[...new Set(line.carried)].join(", ")}`);
        if (line.login) io.out(`           one-time login if needed: ${line.login}`);
    }
    for (const backup of backups.filter(Boolean)) io.out(`backup   ${backup}`);
    if (mode === "install") io.out(`note     register by hand in ${MANUAL_AGENTS.join(", ")}: command <venv python>, argument <server script>, as shown above`);
    return { report, backups: backups.filter(Boolean) };
}

function mcpsList(source, home, userHome, io) {
    const configs = configsFor(userHome);
    for (const mcp of discoverMcps(source.root)) {
        const dir = installDir(home, mcp);
        const managed = existsSync(join(dir, ".gti-mcp.json"));
        const regs = Object.values(configs).flatMap((config) => matchEntries(config, mcp).map((entry) => {
            const script = entryScript(entry) ?? "";
            const where = script && resolve(script).startsWith(resolve(dir)) ? "managed" : script || entry.command.join(" ");
            return `${config.agent}:${entry.key} -> ${where}`;
        }));
        io.out(`mcp      ${mcp.name} (${mcp.folder}): ${managed ? `managed at ${dir}` : "not managed"}`);
        for (const reg of regs) io.out(`           ${reg}`);
        if (regs.length === 0) io.out("           not registered in any supported agent");
    }
}

export async function main(argv, io = { out: (l) => console.log(l), err: (l) => console.error(l) }) {
    try {
        const flags = parseArgs(argv);
        const [first, second] = flags.positional;
        const home = resolve(flags.home ?? gtiHome());
        const userHome = resolve(flags.userHome ?? homedir());
        const names = flags.only ?? flags.positional.slice(2);

        if (first === "skills" && second === "update") return skillsUpdate(await resolveSource(flags, io), flags, io);
        if (first === "mcps" && (second === "list" || second === undefined)) {
            mcpsList(await resolveSource(flags, io), home, userHome, io);
            return 0;
        }
        if (first === "mcps" && second === "update") {
            runMcps({ mode: "update", names: flags.only, source: await resolveSource(flags, io), home, userHome, dryRun: flags.dryRun, skipDeps: flags.skipDeps, io });
            return 0;
        }
        if (first === "mcps" && second === "install") {
            if (names.length === 0) throw new Error("name the MCP servers to install, or all");
            runMcps({ mode: "install", names, agents: flags.agents, source: await resolveSource(flags, io), home, userHome, dryRun: flags.dryRun, skipDeps: flags.skipDeps, io });
            return 0;
        }
        if (first === "update") {
            const source = await resolveSource(flags, io);
            const status = skillsUpdate(source, flags, io);
            runMcps({ mode: "update", names: flags.only, source, home, userHome, dryRun: flags.dryRun, skipDeps: flags.skipDeps, io });
            return status;
        }
        if (first === "status") {
            const source = await resolveSource(flags, io);
            skillsUpdate(source, { ...flags, check: true }, io);
            mcpsList(source, home, userHome, io);
            return 0;
        }
        io.err("Usage: gti.mjs status | update | skills update | mcps list | mcps update | mcps install <names|all>. See the header of this file.");
        return 2;
    } catch (error) {
        io.err(`Error: ${error.message}`);
        return 1;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(await main(process.argv.slice(2)));
}
