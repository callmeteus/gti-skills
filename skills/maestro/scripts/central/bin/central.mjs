#!/usr/bin/env node
// Maestro central CLI: start (detached, reused when running), serve (foreground), stop, status, demo.

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { defaultRoot } from "../server/state.mjs";
import { startCentral } from "../server/http.mjs";
import { readLock, writeLock, clearLock, alive, healthy, openBrowser } from "../server/lock.mjs";
import { writeDemo, simulate } from "../server/demo.mjs";

const SELF = fileURLToPath(import.meta.url);
const HELP = `Usage: central <command> [options]

Commands:
  start     Start the central in the background, or reuse the running one
  serve     Run the central in the foreground
  stop      Stop the running central
  status    Show the running central
  demo      Write a sample ledger and start a central that replays live events

Options:
  --root <dir>   Ledger folder (default: MAESTRO_HOME, GTI_HOME/maestro, or ~/.gti/maestro)
  --port <n>     Preferred port (default: MAESTRO_CENTRAL_PORT or 4731)
  --open         Open the fleet view in the browser
  --json         Print JSON
`;

function parse(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--open" || arg === "--json" || arg === "--simulate" || arg === "--help" || arg === "-h") {
            args[arg.replace(/^-+/, "")] = true;
        } else if (arg.startsWith("--")) {
            args[arg.slice(2)] = argv[i + 1];
            i += 1;
        } else {
            args._.push(arg);
        }
    }
    return args;
}

function print(args, data, text) {
    process.stdout.write(args.json ? `${JSON.stringify(data)}\n` : `${text}\n`);
}

function liveUrl(lock) {
    return `${lock.url}/?token=${lock.token}`;
}

async function serve(args, root) {
    const token = args.token || randomBytes(18).toString("hex");
    const central = await startCentral({
        root,
        token,
        port: Number(args.port ?? process.env.MAESTRO_CENTRAL_PORT ?? 4731),
        log: process.env.MAESTRO_CENTRAL_DEBUG ? (line) => process.stderr.write(`${line}\n`) : undefined,
    });
    const lock = { pid: process.pid, port: central.port, token, url: central.url, root, startedAt: new Date().toISOString() };
    writeLock(root, lock);
    const stopSim = args.simulate ? simulate(root) : null;
    const shutdown = async () => {
        stopSim?.();
        clearLock(root, process.pid);
        await central.close();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    process.on("exit", () => clearLock(root, process.pid));
    if (!args.quiet) {
        print(args, { url: liveUrl(lock), port: central.port, pid: process.pid, root }, `Maestro central: ${liveUrl(lock)}`);
    }
    if (args.open) {
        openBrowser(liveUrl(lock));
    }
}

async function waitForLock(root, pid, timeoutMs = 8000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
        const lock = readLock(root);
        if (lock && lock.pid === pid && (await healthy(lock))) {
            return lock;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return null;
}

async function start(args, root, extra = {}) {
    const existing = readLock(root);
    if (existing && alive(existing.pid) && (await healthy(existing))) {
        print(args, { url: liveUrl(existing), reused: true, pid: existing.pid, root }, `Maestro central already running: ${liveUrl(existing)}`);
        if (args.open) {
            openBrowser(liveUrl(existing));
        }
        return;
    }
    // Keep the previous token so an open tab reconnects on its own after a restart.
    const token = extra.token || existing?.token;
    const childArgs = [SELF, "serve", "--root", root, "--quiet", "1", ...(extra.args || [])];
    if (token) {
        childArgs.push("--token", token);
    }
    if (args.port) {
        childArgs.push("--port", String(args.port));
    }
    const child = spawn(process.execPath, childArgs, { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
    const lock = await waitForLock(root, child.pid);
    if (!lock) {
        print(args, { error: "the central did not start", root }, "The central did not start. Run `central serve` to see the error.");
        process.exitCode = 1;
        return;
    }
    print(args, { url: liveUrl(lock), reused: false, pid: lock.pid, root }, `Maestro central: ${liveUrl(lock)}`);
    if (args.open) {
        openBrowser(liveUrl(lock));
    }
}

function stop(args, root) {
    const lock = readLock(root);
    if (!lock || !alive(lock.pid)) {
        clearLock(root, lock?.pid);
        print(args, { stopped: false, root }, "No central is running.");
        return;
    }
    process.kill(lock.pid);
    clearLock(root, lock.pid);
    print(args, { stopped: true, pid: lock.pid, root }, `Stopped the central (pid ${lock.pid}).`);
}

async function status(args, root) {
    const lock = readLock(root);
    const running = Boolean(lock && alive(lock.pid) && (await healthy(lock)));
    print(
        args,
        { running, url: running ? liveUrl(lock) : null, pid: running ? lock.pid : null, root },
        running ? `Running: ${liveUrl(lock)}` : "Not running.",
    );
}

async function main() {
    const args = parse(process.argv.slice(2));
    const command = args._[0];
    if (!command || args.help || args.h) {
        process.stdout.write(HELP);
        return;
    }
    const root = args.root || defaultRoot();
    switch (command) {
        case "serve":
            await serve(args, root);
            return;
        case "start":
            await start(args, root);
            return;
        case "stop":
            stop(args, root);
            return;
        case "status":
            await status(args, root);
            return;
        case "demo": {
            // A running demo central holds the old sample; stop it before rewriting the sample.
            const previous = readLock(join(root, "_demo"));
            if (previous && alive(previous.pid)) {
                process.kill(previous.pid);
                await new Promise((resolve) => setTimeout(resolve, 400));
            }
            const demoRoot = writeDemo(root);
            await start(args, demoRoot, { args: ["--simulate"], token: previous?.token });
            return;
        }
        default:
            process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
            process.exitCode = 2;
    }
}

main().catch((error) => {
    process.stderr.write(`[central] failed: ${error?.stack || error}\n`);
    process.exitCode = 1;
});
