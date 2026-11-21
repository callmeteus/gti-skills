#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { evaluate, scanText } from "../src/engine.mjs";
import { install, status, uninstall } from "../src/install.mjs";

const MAX_SCAN_BYTES = 2 * 1024 * 1024;
const SKIP_DIRS = new Set([".git", "node_modules", "dist", ".gti"]);

const USAGE = `leakguard

Usage:
  node packages/leakguard/bin/leakguard.mjs install --agent <ids|all> --scope project|user [--dest <dir>] [--dry-run]
  node packages/leakguard/bin/leakguard.mjs uninstall --agent <ids|all> --scope project|user [--dest <dir>] [--dry-run]
  node packages/leakguard/bin/leakguard.mjs status [--agent <ids|all>] [--dest <dir>]
  node packages/leakguard/bin/leakguard.mjs test "<command>" [--agent claude]
  node packages/leakguard/bin/leakguard.mjs scan <file|dir> [--json]
`;

/**
 * Parses positional arguments and long flags.
 *
 * @param {string[]} argv Arguments after the command
 * @returns {{ positionals: string[], flags: Record<string, string|boolean> }} Parsed arguments
 */
function parse(argv) {
    const positionals = [];
    const flags = {};

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];

        if (!token.startsWith("--")) {
            positionals.push(token);
            continue;
        }

        const key = token.slice(2);
        const next = argv[index + 1];

        if (next === undefined || next.startsWith("--")) {
            flags[key] = true;
        } else {
            flags[key] = next;
            index += 1;
        }
    }

    return { positionals, flags };
}

/** Output channels. */
const io = {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`)
};

/**
 * Lists files to scan. Skips common generated directories and large or binary files.
 *
 * @param {string} target File or directory
 * @returns {string[]} File paths
 */
function listFiles(target) {
    const absolute = resolve(target);
    let stat;

    try {
        stat = statSync(absolute);
    } catch (error) {
        io.err(`scan: ${error.message}`);
        return [];
    }

    if (stat.isFile()) {
        return [absolute];
    }

    const files = [];

    function walk(dir) {
        let entries = [];
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const path = join(dir, entry.name);

            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name)) {
                    walk(path);
                }
            } else if (entry.isFile()) {
                try {
                    if (statSync(path).size <= MAX_SCAN_BYTES) {
                        files.push(path);
                    }
                } catch {
                    // A file disappeared between listing and stat.
                }
            }
        }
    }

    walk(absolute);
    return files;
}

const [command, ...rest] = process.argv.slice(2);
const { positionals, flags } = parse(rest);

if (!command || command === "--help" || command === "-h") {
    io.out(USAGE);
    process.exitCode = command ? 1 : 0;
} else if (command === "install") {
    if (typeof flags.agent !== "string") {
        io.err("install requires --agent <ids|all>.");
        process.exitCode = 1;
    } else {
        install(flags.agent, {
            scope: typeof flags.scope === "string" ? flags.scope : "project",
            dest: typeof flags.dest === "string" ? flags.dest : ".",
            dryRun: flags["dry-run"] === true,
            io
        });
    }
} else if (command === "uninstall") {
    if (typeof flags.agent !== "string") {
        io.err("uninstall requires --agent <ids|all>.");
        process.exitCode = 1;
    } else {
        uninstall(flags.agent, {
            scope: typeof flags.scope === "string" ? flags.scope : "project",
            dest: typeof flags.dest === "string" ? flags.dest : ".",
            dryRun: flags["dry-run"] === true,
            io
        });
    }
} else if (command === "status") {
    for (const row of status(typeof flags.agent === "string" ? flags.agent : "all", {
        dest: typeof flags.dest === "string" ? flags.dest : "."
    })) {
        io.out(`${row.agent.padEnd(13)}${row.scope.padEnd(9)}${row.installed ? "installed" : "not installed"}${
            row.path ? `  ${row.path}` : row.note ? `  ${row.note}` : ""
        }`);
    }
} else if (command === "test") {
    const text = positionals.join(" ").trim();

    if (!text) {
        io.err('test requires a command string, for example: test "curl http://example.com"');
        process.exitCode = 1;
    } else {
        const agent = typeof flags.agent === "string" ? flags.agent : "claude";
        const result = evaluate({ tool: "shell", input: { command: text }, agent });
        io.out(`decision: ${result.decision}`);
        io.out(`policy: ${result.policyDecision}`);
        io.out(`severity: ${result.severity ?? "none"}`);
        io.out(`detectors: ${result.detectorIds.join(", ") || "none"}`);
        io.out(`reason: ${result.reason}`);
    }
} else if (command === "scan") {
    const target = positionals[0];

    if (!target) {
        io.err("scan requires a file or directory.");
        process.exitCode = 1;
    } else {
        const findings = [];

        for (const file of listFiles(target)) {
            let content;
            try {
                content = readFileSync(file, "utf8");
            } catch {
                continue;
            }
            if (content.includes("\u0000")) {
                continue;
            }

            for (const finding of scanText(content)) {
                findings.push({ file, ...finding });
            }
        }

        if (flags.json === true) {
            io.out(JSON.stringify(findings, null, 2));
        } else if (findings.length === 0) {
            io.out("No findings.");
        } else {
            for (const finding of findings) {
                const line = finding.line ?? 0;
                const evidence = finding.evidence.join(" ").slice(0, 120);
                io.out(`${finding.file}:${line}: [${finding.severity}] ${finding.id} ${evidence}`);
            }
        }
    }
} else {
    io.err(`Unknown command: ${command}`);
    io.out(USAGE);
    process.exitCode = 1;
}
