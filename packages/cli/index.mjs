#!/usr/bin/env node
import { runBuild } from "./commands/Build.mjs";
import { runCheck } from "./commands/Check.mjs";
import { runInstall } from "./commands/Install.mjs";
import { runList } from "./commands/List.mjs";
import { notifyUpdate, runUpdate } from "./commands/Update.mjs";
import { runValidate } from "./commands/Validate.mjs";
import { parseArgs } from "./core/Args.mjs";

const Usage = `gti-skills CLI

Usage:
  node packages/cli <command> [flags]

Commands:
  list                         Show skills, packs, and supported agents
  validate [--skill <id>]      Validate skills against the Agent Skills standard
  build                        Sync shared files, validate, and regenerate harnesses/
  check                        Fail when generated files are out of date (use in CI)
  install --harness <ids|all>  Install skills into coding agents
          [--skill <ids|all>] [--pack <ids|all>] [--scope project|user] [--dest <dir>] [--dry-run]
  update                       Update installed skills to the latest commit on GitHub master
          [--check] [--dry-run] [--force] [--skip-build]
          [--harness <ids|all> [--skill <ids|all>] [--pack <ids|all>] [--scope project|user] [--dest <dir>]]
`;

const Commands = {
    list: runList,
    validate: runValidate,
    build: runBuild,
    check: runCheck,
    install: runInstall,
    update: runUpdate
};

const NotifyCommands = new Set(["list", "install"]);

const io = {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`)
};

const { command, flags } = parseArgs(process.argv.slice(2));
const handler = Commands[command];

if (!handler) {
    io.out(Usage);
    process.exit(command ? 1 : 0);
}

const code = await handler(flags, io);

if (NotifyCommands.has(command)) {
    await notifyUpdate(io);
}

// Setting the exit code instead of calling process.exit lets pending network handles close (Windows aborts otherwise).
process.exitCode = code;
