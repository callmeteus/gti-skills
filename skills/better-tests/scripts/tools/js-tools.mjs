#!/usr/bin/env node
/**
 * Installs and runs Stryker (mutation testing) and fast-check (property-based testing)
 * for JavaScript and TypeScript projects, from a tools folder OUTSIDE the project.
 *
 * Nothing is added to the project: no dependency, no lockfile change, no config file,
 * no report, no temp folder. Stryker runs with the project as its working directory and
 * uses the project's own test runner; its sandbox, config, and reports live in the tools
 * folder. Property files live in the tools folder too, so `fast-check` resolves from there.
 *
 * Commands:
 *   install   [--tools-dir DIR] [--update]
 *   stryker   --project DIR --mutate GLOB [--mutate GLOB ...] [--runner vitest|jest|mocha|command]
 *             [--test-command CMD] [--concurrency N] [--tools-dir DIR]
 *   workdir   --project DIR [--tools-dir DIR]
 *   property  --project DIR FILE [--tools-dir DIR]
 *
 * The tools folder defaults to ~/.gti-skills/tools/node, or GTI_TEST_TOOLS_DIR when set.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGES = {
    "@stryker-mutator/core": "9",
    "@stryker-mutator/vitest-runner": "9",
    "@stryker-mutator/jest-runner": "9",
    "@stryker-mutator/mocha-runner": "9",
    "fast-check": "4",
    tsx: "4",
};

const RUNNERS = ["vitest", "jest", "mocha", "command"];

export function defaultToolsDir(env = process.env) {
    return resolve(env.GTI_TEST_TOOLS_DIR || join(homedir(), ".gti-skills", "tools", "node"));
}

/** True when `child` is `parent` or inside it. */
export function isInside(child, parent) {
    const rel = relative(resolve(parent), resolve(child));
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** Finds the project root: the nearest folder with package.json or .git. Null when there is none. */
export function findProjectRoot(start) {
    let dir = resolve(start);
    while (true) {
        if (existsSync(join(dir, "package.json")) || existsSync(join(dir, ".git"))) return dir;
        const parent = dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

export function projectRoot(start) {
    return findProjectRoot(start) ?? resolve(start);
}

/** Refuses a tools folder that would put files inside the project. */
export function assertOutside(toolsDir, project) {
    if (isInside(toolsDir, project)) {
        throw new Error(`The tools folder ${toolsDir} is inside the project ${project}. Choose a folder outside it with --tools-dir or GTI_TEST_TOOLS_DIR.`);
    }
}

/** Stable work folder for one project inside the tools folder. */
export function workDir(toolsDir, project) {
    const abs = resolve(project);
    const id = `${basename(abs).replace(/[^A-Za-z0-9._-]/g, "_")}-${createHash("sha256").update(abs.toLowerCase()).digest("hex").slice(0, 8)}`;
    return join(toolsDir, "work", id);
}

export function installedVersions(toolsDir) {
    const versions = {};
    for (const name of Object.keys(PACKAGES)) {
        const file = join(toolsDir, "node_modules", ...name.split("/"), "package.json");
        versions[name] = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).version : null;
    }
    return versions;
}

export function missingPackages(toolsDir) {
    const versions = installedVersions(toolsDir);
    return Object.keys(PACKAGES).filter((name) => !versions[name] || versions[name].split(".")[0] !== PACKAGES[name]);
}

/** Detects the project's test runner from package.json and config files. */
export function detectRunner(project) {
    const file = join(project, "package.json");
    const pkg = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const script = String(pkg.scripts?.test ?? "");
    if (deps.vitest || /\bvitest\b/.test(script)) return "vitest";
    if (deps.jest || /\bjest\b/.test(script)) return "jest";
    if (deps.mocha || /\bmocha\b/.test(script)) return "mocha";
    return "command";
}

/** Builds a Stryker config whose every output path is in the work folder. */
export function strykerConfig({ runner, mutate, work, testCommand, concurrency }) {
    const config = {
        testRunner: runner,
        mutate,
        reporters: ["clear-text", "json", "html"],
        htmlReporter: { fileName: join(work, "mutation.html") },
        jsonReporter: { fileName: join(work, "mutation.json") },
        tempDirName: join(work, "stryker-tmp"),
        cleanTempDir: "always",
        incremental: false,
        inPlace: false,
    };
    if (runner === "command") config.commandRunner = { command: testCommand || "npm test" };
    if (concurrency) config.concurrency = concurrency;
    return config;
}

/** Mutation score from a Stryker JSON report, the way Stryker computes it. */
export function mutationScore(report) {
    const counts = {};
    for (const file of Object.values(report.files ?? {})) {
        for (const mutant of file.mutants ?? []) counts[mutant.status] = (counts[mutant.status] ?? 0) + 1;
    }
    const detected = (counts.Killed ?? 0) + (counts.Timeout ?? 0);
    const valid = detected + (counts.Survived ?? 0) + (counts.NoCoverage ?? 0);
    return { counts, score: valid ? Math.round((detected / valid) * 10000) / 100 : null };
}

function gitStatus(project) {
    const result = spawnSync("git", ["-C", project, "status", "--porcelain"], { encoding: "utf8" });
    return result.status === 0 ? result.stdout : null;
}

function parseArgs(argv) {
    const options = { mutate: [], positional: [] };
    for (let index = 0; index < argv.length; index++) {
        const value = argv[index];
        const next = () => {
            if (index + 1 >= argv.length) throw new Error(`${value} needs a value`);
            return argv[++index];
        };
        if (value === "--tools-dir") options.toolsDir = next();
        else if (value === "--project") options.project = next();
        else if (value === "--mutate") options.mutate.push(next());
        else if (value === "--runner") options.runner = next();
        else if (value === "--test-command") options.testCommand = next();
        else if (value === "--concurrency") options.concurrency = Number(next());
        else if (value === "--update") options.update = true;
        else if (value.startsWith("--")) throw new Error(`unknown option ${value}`);
        else options.positional.push(value);
    }
    return options;
}

function install(toolsDir, update) {
    mkdirSync(toolsDir, { recursive: true });
    const manifest = join(toolsDir, "package.json");
    if (!existsSync(manifest)) {
        writeFileSync(manifest, JSON.stringify({ name: "gti-test-tools", private: true, description: "Test tools used by the better-tests skill, kept outside every project." }, null, 2) + "\n");
    }
    const missing = update ? Object.keys(PACKAGES) : missingPackages(toolsDir);
    if (missing.length > 0) {
        const specs = missing.map((name) => `${name}@${PACKAGES[name]}`);
        console.error(`Installing into ${toolsDir}: ${specs.join(" ")}`);
        // npm is a .cmd file on Windows, which needs a shell; every argument here is fixed or quoted.
        const command = `npm install --no-audit --no-fund --loglevel=error --prefix "${toolsDir}" ${specs.join(" ")}`;
        const result = spawnSync(command, { stdio: "inherit", shell: true, cwd: toolsDir });
        if (result.status !== 0) throw new Error("npm install failed; see the output above");
    }
    return installedVersions(toolsDir);
}

function requireInstalled(toolsDir) {
    const missing = missingPackages(toolsDir);
    if (missing.length > 0) throw new Error(`Missing in ${toolsDir}: ${missing.join(", ")}. Run the install command first.`);
}

function runStryker(options, toolsDir) {
    if (!options.project) throw new Error("--project is required");
    if (options.mutate.length === 0) throw new Error("--mutate is required: scope the run to the changed files, for example --mutate src/orders/**/*.ts");
    const project = projectRoot(options.project);
    assertOutside(toolsDir, project);
    requireInstalled(toolsDir);
    const runner = options.runner || detectRunner(project);
    if (!RUNNERS.includes(runner)) throw new Error(`--runner must be one of ${RUNNERS.join(", ")}`);

    const work = workDir(toolsDir, project);
    mkdirSync(work, { recursive: true });
    const configFile = join(work, "stryker.config.json");
    writeFileSync(configFile, JSON.stringify(strykerConfig({ runner, mutate: options.mutate, work, testCommand: options.testCommand, concurrency: options.concurrency }), null, 2) + "\n");

    const before = gitStatus(project);
    const stryker = join(toolsDir, "node_modules", "@stryker-mutator", "core", "bin", "stryker.js");
    const result = spawnSync(process.execPath, [stryker, "run", configFile], { stdio: "inherit", cwd: project });
    const after = gitStatus(project);

    const reportFile = join(work, "mutation.json");
    const summary = { project, runner, mutate: options.mutate, config: configFile, html: join(work, "mutation.html"), json: reportFile };
    if (existsSync(reportFile)) Object.assign(summary, mutationScore(JSON.parse(readFileSync(reportFile, "utf8"))));
    if (before !== null && after !== null && before !== after) {
        summary.warning = "git status of the project changed during the run; inspect it with git status";
    }
    console.log(JSON.stringify(summary, null, 2));
    return result.status ?? 1;
}

function runProperty(options, toolsDir) {
    if (!options.project) throw new Error("--project is required");
    const file = options.positional[0];
    if (!file) throw new Error("give the property file to run");
    const project = projectRoot(options.project);
    assertOutside(toolsDir, project);
    requireInstalled(toolsDir);
    const target = resolve(file);
    if (!isInside(target, join(toolsDir, "work"))) {
        throw new Error(`Property files live in the work folder (${workDir(toolsDir, project)}), so fast-check resolves from the tools folder and nothing is written to the project.`);
    }
    const tsx = join(toolsDir, "node_modules", "tsx", "dist", "cli.mjs");
    const result = spawnSync(process.execPath, [tsx, target], { stdio: "inherit", cwd: project });
    return result.status ?? 1;
}

export function main(argv) {
    const [command, ...rest] = argv;
    let options;
    try {
        options = parseArgs(rest);
        const toolsDir = resolve(options.toolsDir || defaultToolsDir());
        if (command === "install") {
            if (options.project) assertOutside(toolsDir, projectRoot(options.project));
            const here = findProjectRoot(process.cwd());
            if (here) assertOutside(toolsDir, here);
            console.log(JSON.stringify({ toolsDir, versions: install(toolsDir, options.update) }, null, 2));
            return 0;
        }
        if (command === "stryker") return runStryker(options, toolsDir);
        if (command === "workdir") {
            if (!options.project) throw new Error("--project is required");
            const project = projectRoot(options.project);
            assertOutside(toolsDir, project);
            const work = workDir(toolsDir, project);
            mkdirSync(work, { recursive: true });
            console.log(JSON.stringify({ project, workDir: work, importPrefix: relative(work, project).split("\\").join("/") }, null, 2));
            return 0;
        }
        if (command === "property") return runProperty(options, toolsDir);
        console.error("Usage: js-tools.mjs install|stryker|workdir|property [options]. See the header of this file.");
        return 2;
    } catch (error) {
        console.error(`Error: ${error.message}`);
        return 1;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(main(process.argv.slice(2)));
}
