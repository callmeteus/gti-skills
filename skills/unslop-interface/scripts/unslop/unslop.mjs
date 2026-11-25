#!/usr/bin/env node
// Unslop Interface CLI: plans a run, inventories screens from source, and checks the report.
//
//   node unslop.mjs start  [--repo <dir>] [--request "<user's words>"] [--rounds N] [--since <ref>] [--paths <file|dir>...]
//   node unslop.mjs scan   [--run | <file|dir>...] [--json]
//   node unslop.mjs strings <file> [--json]
//   node unslop.mjs check  <report.md> [--run <run.json>]
//
// Run state goes to $GTI_HOME/unslop-interface/<project>/ (default ~/.gti).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join, relative, resolve } from "node:path";
import { PASSES, UI_EXTENSIONS, extractStrings, readRequest, scanText } from "./rules.mjs";

const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", ".next", ".nuxt", ".svelte-kit", "coverage", "static", "public", "vendor"]);
const SCREEN_DIR = /(^|\/)(views|pages|routes|screens|app)\//;

function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith("--")) {
            args._.push(a);
            continue;
        }
        const key = a.slice(2);
        if (key === "json" || key === "run" && (argv[i + 1] === undefined || argv[i + 1].startsWith("--"))) {
            args[key] = true;
        } else if (key === "paths") {
            args.paths = [];
            while (argv[i + 1] && !argv[i + 1].startsWith("--")) args.paths.push(argv[++i]);
        } else {
            args[key] = argv[++i];
        }
    }
    return args;
}

function gitRoot(dir) {
    try {
        return execFileSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
    } catch {
        return resolve(dir);
    }
}

export function outDir(project) {
    const home = process.env.GTI_HOME || join(homedir(), ".gti");
    const dir = join(home, "unslop-interface", project);
    mkdirSync(dir, { recursive: true });
    return dir;
}

function isUiFile(path) {
    return UI_EXTENSIONS.includes(extname(path)) && !/\.(spec|test|stories)\./.test(path);
}

function walk(path, out = []) {
    if (!existsSync(path)) return out;
    const st = statSync(path);
    if (st.isFile()) {
        if (isUiFile(path)) out.push(path);
        return out;
    }
    for (const name of readdirSync(path)) {
        if (SKIP_DIRS.has(name) || name.startsWith(".")) continue;
        walk(join(path, name), out);
    }
    return out;
}

function changedFiles(root, since) {
    const run = (args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).split("\n").filter(Boolean);
    const files = new Set([...run(["diff", "--name-only", `${since}...HEAD`]), ...run(["diff", "--name-only", "HEAD"])]);
    return [...files]
        .filter((f) => !f.split("/").some((part) => SKIP_DIRS.has(part)))
        .map((f) => join(root, f))
        .filter((f) => existsSync(f) && isUiFile(f));
}

function screenKind(path) {
    return SCREEN_DIR.test(path) ? "screen" : "component";
}

function hasCheckboxComponent(files) {
    return files.some((f) => /checkbox\.(vue|svelte|tsx|jsx)$/i.test(f));
}

function loadRun(file) {
    return JSON.parse(readFileSync(file, "utf8"));
}

function defaultRunFile(repo = ".") {
    return join(outDir(basename(gitRoot(repo))), "run.json");
}

function cmdStart(args) {
    const root = gitRoot(args.repo || ".");
    const project = basename(root);
    const fromRequest = readRequest(args.request || "");
    const rounds = Number(args.rounds) || fromRequest.rounds || 1;
    let files;
    let scope;
    if (args.paths?.length) {
        files = args.paths.flatMap((p) => walk(resolve(p)));
        scope = `paths: ${args.paths.join(", ")}`;
    } else if (args.since) {
        files = changedFiles(root, args.since);
        scope = `changed since ${args.since}`;
    } else {
        files = walk(root);
        scope = "every UI file in the repository";
    }
    const screens = [...new Set(files)].sort().map((f) => ({ path: relative(root, f), kind: screenKind(relative(root, f)) }));
    const run = {
        project,
        repo: root,
        request: args.request || "",
        rounds,
        passes: fromRequest.passes,
        scope,
        screens,
        created: new Date().toISOString(),
    };
    const dir = outDir(project);
    writeFileSync(join(dir, "run.json"), `${JSON.stringify(run, null, 2)}\n`);

    const passNames = PASSES.filter((p) => run.passes.includes(p.id)).map((p) => `${p.n}. ${p.name}`);
    console.log(`Run for ${project}: ${rounds} round(s) of ${passNames.length} pass(es) on ${screens.length} file(s) (${scope}).`);
    if (fromRequest.rounds && !args.rounds) console.log(`"${args.request}" asks for ${fromRequest.rounds} rounds: each round runs every pass below, in order.`);
    console.log(`Passes per round: ${passNames.join(", ")}`);
    console.log("Screens:");
    for (const s of screens.filter((s) => s.kind === "screen")) console.log(`  ${s.path}`);
    const components = screens.filter((s) => s.kind === "component");
    if (components.length) console.log(`Components (${components.length}): ${components.map((s) => s.path).join(", ")}`);
    if (!screens.length) console.log("No UI files in scope: pass --paths or --since, or check the repository.");
    console.log(`\nWrote ${join(dir, "run.json")}`);
    console.log("Next: scan --run, then strings <file> for every screen, then the passes, then check <report.md>.");
}

function cmdScan(args) {
    let files;
    let runFile = null;
    if (args.run || !args._.length) {
        runFile = typeof args.run === "string" ? args.run : defaultRunFile(args.repo || ".");
        if (!existsSync(runFile)) throw new Error(`No run at ${runFile}: run start first, or pass files`);
        const run = loadRun(runFile);
        files = run.screens.map((s) => join(run.repo, s.path));
    } else {
        files = args._.flatMap((p) => walk(resolve(p)));
    }
    const context = { hasCheckboxComponent: hasCheckboxComponent(runFile ? walk(loadRun(runFile).repo) : files) };
    const findings = files.flatMap((f) => scanText(f, readFileSync(f, "utf8"), context));
    if (runFile) writeFileSync(join(resolve(runFile, ".."), "scan.json"), `${JSON.stringify(findings, null, 2)}\n`);
    if (args.json) {
        console.log(JSON.stringify(findings, null, 2));
        return;
    }
    const byFile = new Map();
    for (const f of findings) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
    for (const [file, list] of byFile) {
        console.log(`\n${file}`);
        for (const f of list.sort((a, b) => a.pass - b.pass || a.line - b.line)) {
            console.log(`  pass ${f.pass}  ${String(f.line).padStart(4)}  ${f.rule}: ${f.message}`);
        }
    }
    console.log(`\n${findings.length} candidate(s) in ${byFile.size} of ${files.length} file(s).`);
    for (const p of PASSES) {
        const n = findings.filter((f) => f.pass === p.n).length;
        if (n) console.log(`  ${p.n}. ${p.name}: ${n}`);
    }
    console.log("Confirm each candidate on the screen; these are source matches, not verdicts. Read the strings of every screen too.");
    if (runFile) console.log(`Wrote ${join(resolve(runFile, ".."), "scan.json")}`);
}

function cmdStrings(args) {
    const file = args._[0];
    if (!file) throw new Error("strings needs a file");
    const entries = extractStrings(file, readFileSync(file, "utf8"));
    if (args.json) {
        console.log(JSON.stringify(entries, null, 2));
        return;
    }
    console.log(`${file}: every visible string and rendered value, in order. Mark narration, repeats, raw IDs and enums, and empty rows.\n`);
    for (const e of entries) {
        const mark = e.repeats > 1 ? `  x${e.repeats}` : "";
        console.log(`${String(e.line).padStart(4)}  ${e.kind.padEnd(16)} ${e.value}${mark}`);
    }
}

// Report check: coverage of screens, rounds, and every pass.
export function checkReport(report, run, scan = []) {
    const errors = [];
    const warnings = [];
    const coverage = report.match(/^## Coverage\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m);
    if (!coverage) {
        errors.push('No "## Coverage" section: list the screens, the rounds, and every pass.');
        return { errors, warnings };
    }
    const body = coverage[1];
    const rows = body.split("\n").filter((l) => /^\|\s*\d\./.test(l));
    for (const p of PASSES) {
        if (run && !run.passes.includes(p.id)) continue;
        const row = rows.find((l) => new RegExp(`^\\|\\s*${p.n}\\.`).test(l));
        if (!row) {
            errors.push(`Pass ${p.n} (${p.name}) is missing from the coverage table.`);
            continue;
        }
        const cells = row.split("|").slice(1, -1).map((c) => c.trim());
        const ran = (cells[1] || "").toLowerCase();
        const reason = cells[2] || "";
        if (!ran) errors.push(`Pass ${p.n} (${p.name}): say whether it ran.`);
        const skipped = /^(no|não|nao|skipped|pulada|pulado)\b/.test(ran);
        if (skipped && !reason) errors.push(`Pass ${p.n} (${p.name}) was skipped with no reason.`);
        if (skipped && /\b(asked|pediu|requested|number|número|numero|first|primeiras)\b/i.test(reason)) {
            errors.push(`Pass ${p.n} (${p.name}) was skipped because of the number in the request: a number of passes is a number of rounds.`);
        }
        const found = scan.filter((f) => f.pass === p.n).length;
        if (skipped && found) errors.push(`Pass ${p.n} (${p.name}) was skipped, but the scan found ${found} candidate(s) for it: fix them or list each one as kept.`);
    }
    if (run) {
        const roundsLine = body.match(/\*\*Rounds:\*\*\s*([^\n]*)/);
        if (!roundsLine || !new RegExp(`\\b${run.rounds}\\b`).test(roundsLine[1])) {
            errors.push(`The coverage must say that ${run.rounds} round(s) ran.`);
        }
        for (const s of run.screens.filter((s) => s.kind === "screen")) {
            if (!report.includes(basename(s.path))) errors.push(`Screen ${s.path} is in scope but not in the report.`);
        }
    }
    const measured = report.match(/^## Measured checks[\s\S]*?(?=^## |(?![\s\S]))/m);
    if (measured && /could not run|não rodou|nao rodou|skipped|pendente|pending/i.test(measured[0]) && !/locally|localmente|seed|fixture|dev server|tried|tentei|tentado/i.test(measured[0])) {
        warnings.push("Measured checks were skipped without saying how running the app locally with a test user was tried.");
    }
    return { errors, warnings };
}

function cmdCheck(args) {
    const reportFile = args._[0];
    if (!reportFile) throw new Error("check needs the report file");
    const runFile = args.run && typeof args.run === "string" ? args.run : defaultRunFile(args.repo || ".");
    const run = existsSync(runFile) ? loadRun(runFile) : null;
    const scanFile = join(resolve(runFile, ".."), "scan.json");
    const scan = run && existsSync(scanFile) ? JSON.parse(readFileSync(scanFile, "utf8")) : [];
    if (!run) console.log(`No run at ${runFile}: checking the pass table only.`);
    const { errors, warnings } = checkReport(readFileSync(reportFile, "utf8"), run, scan);
    for (const w of warnings) console.log(`warning  ${w}`);
    for (const e of errors) console.log(`error    ${e}`);
    if (errors.length) {
        console.log(`\nReport incomplete: ${errors.length} error(s). Finish the missing work, then check again.`);
        process.exitCode = 1;
    } else {
        console.log("Report covers every screen, round, and pass.");
    }
}

const COMMANDS = { start: cmdStart, scan: cmdScan, strings: cmdStrings, check: cmdCheck };

if (process.argv[1]?.endsWith("unslop.mjs")) {
    const [command, ...rest] = process.argv.slice(2);
    const fn = COMMANDS[command];
    if (!fn) {
        console.log("Usage: node unslop.mjs <start|scan|strings|check> [options]\n");
        console.log("  start   --request \"<user's words>\" [--rounds N] [--since <ref> | --paths <file|dir>...] [--repo <dir>]");
        console.log("  scan    [--run [<run.json>] | <file|dir>...] [--json]");
        console.log("  strings <file> [--json]");
        console.log("  check   <report.md> [--run <run.json>]");
        process.exitCode = command ? 2 : 0;
    } else {
        try {
            fn(parseArgs(rest));
        } catch (err) {
            console.error(`error: ${err.message}`);
            process.exitCode = 2;
        }
    }
}
