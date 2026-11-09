#!/usr/bin/env node
/**
 * Runs lintapple against a rendered page and prints a short summary for the agent.
 *
 * Synced into the Frontend Design Review and Unslop Interface skills from
 * packages/lintapple/agent/scripts. Edit it there, then run `node packages/cli build`.
 *
 * Usage:
 *   node run.mjs <url> [--project DIR] [--config FILE] [--ready SELECTOR]
 *                      [--interactions FILE] [--out FILE] [--top N]
 *   node run.mjs --write-policy FILE      Writes the default policy to FILE to adapt
 *   node run.mjs --where                  Shows which lintapple would run
 *
 * lintapple is found in this order: the project's own node_modules/lintapple, the
 * gti-skills package this skill was installed with (lintapple.root next to this file),
 * then `npx lintapple@<version>` from npm. The policy is --config, else the project's
 * ui-policy.json, else the default policy. Nothing is written to the project.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const FALLBACK_VERSION = "0.1.24";

export const DEFAULT_POLICY = {
    fonts: ["system-ui", "-apple-system", "BlinkMacSystemFont", "SF Pro Text", "SF Pro Display"],
    fontSizes: [12, 14, 16, 18, 20, 24, 32, 40, 48, 64],
    typeRules: [
        { selector: "h1", sizes: [24, 32, 40, 48, 64] },
        { selector: "h2", sizes: [20, 24, 32] },
        { selector: "h3", sizes: [18, 20, 24] },
        { selector: "button, [role=button]", sizes: [14, 16] },
    ],
    minControlSize: 15,
    controlSizeRules: [],
    minControlGap: 8,
    minControlInset: 8,
    controlContainers: ["[data-ui-container]"],
    contentInsetRules: [],
    iconSizeRules: [],
    minLayoutGap: 8,
    bannedCopy: ["unlock your potential", "seamlessly", "game-changing"],
    viewports: [{ width: 390, height: 844 }, { width: 1440, height: 900 }],
    colorSchemes: ["light"],
    exceptions: [],
};

function packageRoot() {
    const pointer = join(here, "lintapple.root");
    if (!existsSync(pointer)) return null;
    const root = readFileSync(pointer, "utf8").trim();
    return root && existsSync(join(root, "package.json")) ? root : null;
}

/** Decides which lintapple to run. Returns { kind, command, args, version, note }. */
export function resolveLintapple(project, root = packageRoot(), exists = existsSync) {
    const local = join(project, "node_modules", "lintapple", "dist", "bin", "lintapple.js");
    if (exists(local)) return { kind: "project", command: process.execPath, args: [local], note: "the project's own lintapple" };
    if (root) {
        const built = join(root, "dist", "bin", "lintapple.js");
        if (exists(built)) return { kind: "package", command: process.execPath, args: [built], root, note: `gti-skills package at ${root}` };
    }
    let version = FALLBACK_VERSION;
    try {
        if (root) version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version || version;
    } catch {
        // keep the fallback version
    }
    const hint = root ? `The gti-skills copy at ${root} is not built; run "npm ci && npm run build" there to use it.` : "";
    return { kind: "npx", command: "npx", args: ["--yes", `lintapple@${version}`], note: `lintapple@${version} from npm. ${hint}`.trim() };
}

/** Picks the policy file: --config, the project's ui-policy.json, or the default written to a temp file. */
export function resolvePolicy(project, config, tempDir = tmpdir()) {
    if (config) return { file: resolve(config), source: "--config" };
    const own = join(project, "ui-policy.json");
    if (existsSync(own)) return { file: own, source: "project ui-policy.json" };
    const dir = join(tempDir, "lintapple-gti");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "default-ui-policy.json");
    writeFileSync(file, `${JSON.stringify(DEFAULT_POLICY, null, 2)}\n`);
    return { file, source: "default policy (fonts and sizes not adapted to this project)" };
}

/** Short text summary of a lintapple JSON report. */
export function summarize(report, top = 15) {
    const lines = [];
    const summary = report.summary ?? {};
    const runs = report.runs ?? [];
    const setups = runs.map((run) => `${run.viewport?.width}x${run.viewport?.height} ${run.colorScheme}`);
    lines.push(`Checked ${report.url} at ${[...new Set(setups)].join(", ") || "no viewport"}`);
    lines.push(`Problems: ${summary.problems ?? 0} (${summary.failed ?? 0} failed occurrences, ${summary.unresolved ?? 0} unresolved)`);
    for (const row of summary.byRule ?? []) lines.push(`  ${row.rule}: ${row.problems} problem(s), ${row.occurrences} occurrence(s)${row.unresolved ? `, ${row.unresolved} unresolved` : ""}`);
    const groups = summary.groups ?? [];
    if (groups.length) lines.push("", `Top problems (${Math.min(top, groups.length)} of ${groups.length}):`);
    for (const group of groups.slice(0, top)) {
        const f = group.finding ?? {};
        const where = [...new Set((group.occurrences ?? []).map((o) => `${o.viewport?.width ?? "?"}px ${o.colorScheme ?? ""} ${o.state ?? ""}`.trim()))];
        lines.push(`- [${f.rule}] ${f.selector}`);
        lines.push(`    actual: ${f.actual}; expected: ${f.expected}`);
        lines.push(`    fix: ${f.fix}`);
        if (where.length) lines.push(`    seen at: ${where.join(" | ")}`);
    }
    const omitted = runs.flatMap((run) => run.frameCoverage?.omitted ?? []);
    const unmeasured = runs.flatMap((run) => run.controlContentCoverage?.unmeasured ?? []);
    if (omitted.length) lines.push("", `Not checked: ${omitted.length} child frame(s). Check them separately or review by eye.`);
    if (unmeasured.length) lines.push(`Unmeasured control content: ${unmeasured.length} item(s); review their spacing by eye.`);
    return lines.join("\n");
}

function parseArgs(argv) {
    const options = { passthrough: [] };
    for (let index = 0; index < argv.length; index++) {
        const value = argv[index];
        const next = () => {
            if (index + 1 >= argv.length) throw new Error(`${value} needs a value`);
            return argv[++index];
        };
        if (value === "--project") options.project = next();
        else if (value === "--config") options.config = next();
        else if (value === "--out") options.out = next();
        else if (value === "--top") options.top = Number(next());
        else if (value === "--write-policy") options.writePolicy = next();
        else if (value === "--where") options.where = true;
        else if (value === "--ready" || value === "--interactions") options.passthrough.push(value, next());
        else if (value.startsWith("--")) throw new Error(`unknown option ${value}`);
        else if (!options.url) options.url = value;
        else throw new Error(`unexpected argument ${value}`);
    }
    return options;
}

export function main(argv) {
    let options;
    try {
        options = parseArgs(argv);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        return 2;
    }
    const major = Number(process.versions.node.split(".")[0]);
    if (major < 22) {
        console.error(`lintapple needs Node.js 22 or later; this is ${process.versions.node}. Install Node.js 22+, then run again.`);
        return 2;
    }
    const project = resolve(options.project ?? process.cwd());
    if (options.writePolicy) {
        writeFileSync(options.writePolicy, `${JSON.stringify(DEFAULT_POLICY, null, 2)}\n`);
        console.log(`Wrote the default policy to ${resolve(options.writePolicy)}. Set fonts, fontSizes, and typeRules to the project's design system.`);
        return 0;
    }
    const tool = resolveLintapple(project);
    if (options.where) {
        console.log(`${tool.kind}: ${tool.note}`);
        return 0;
    }
    if (!options.url) {
        console.error("Usage: run.mjs <url> [--project DIR] [--config FILE] [--ready SELECTOR] [--interactions FILE] [--out FILE]");
        return 2;
    }

    const policy = resolvePolicy(project, options.config);
    console.error(`lintapple: ${tool.note}`);
    console.error(`policy: ${policy.file} (${policy.source})`);
    const result = spawnSync(tool.command, [...tool.args, options.url, "--config", policy.file, "--json", ...options.passthrough], {
        cwd: project,
        encoding: "utf8",
        shell: tool.kind === "npx" && process.platform === "win32",
        maxBuffer: 64 * 1024 * 1024,
    });
    const stderr = String(result.stderr ?? "");
    if (result.status === 2 || result.status === null) {
        console.error(stderr.trim() || result.error?.message || "lintapple did not finish");
        if (/Executable doesn't exist|playwright install/i.test(stderr)) {
            const cwd = tool.root ?? project;
            console.error(`Chromium for Playwright is missing. Install it once, then run again:\n  cd "${cwd}" && npx playwright install chromium`);
        }
        return 2;
    }
    let report;
    try {
        report = JSON.parse(result.stdout);
    } catch {
        console.error(`lintapple returned output that is not JSON:\n${String(result.stdout).slice(0, 2000)}\n${stderr}`);
        return 2;
    }
    const out = resolve(options.out ?? join(tmpdir(), "lintapple-gti", `report-${Date.now()}.json`));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(summarize(report, options.top ?? 15));
    console.log(`\nFull report: ${out}`);
    return result.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(main(process.argv.slice(2)));
}
