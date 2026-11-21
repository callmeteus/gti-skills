import { existsSync, readFileSync, realpathSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves and runs the Video Editor CLI from the linked package.
 * Follows junctions so a skill folder linked into any agent directory still finds the package.
 *
 * Resolution order: VIDEOEDITOR_HOME, an ancestor that is the package, an ancestor that
 * contains packages/videoeditor, then the videoeditor.root file written by the installer.
 */
const scriptsDir = dirname(fileURLToPath(import.meta.url));
const realScripts = realpathSync(scriptsDir);

/** True when a directory holds the Video Editor CLI entry point. */
function isPackageRoot(directory) {
    return existsSync(join(directory, "dist", "bin", "videoeditor.js")) ||
        existsSync(join(directory, "src", "bin", "videoeditor.ts"));
}

/** Walks upward from the script directory to find the package root. */
function findPackageRoot(start) {
    let current = start;

    for (let index = 0; index < 10; index += 1) {
        if (isPackageRoot(current)) {
            return current;
        }

        const nested = join(current, "packages", "videoeditor");

        if (isPackageRoot(nested)) {
            return nested;
        }

        const parent = dirname(current);

        if (parent === current) {
            break;
        }

        current = parent;
    }

    return null;
}

let packageRoot = process.env.VIDEOEDITOR_HOME && isPackageRoot(process.env.VIDEOEDITOR_HOME)
    ? process.env.VIDEOEDITOR_HOME
    : findPackageRoot(realScripts);

if (!packageRoot) {
    const rootFile = join(scriptsDir, "videoeditor.root");

    if (existsSync(rootFile)) {
        packageRoot = readFileSync(rootFile, "utf8").trim();
    }
}

if (!packageRoot) {
    packageRoot = join(realScripts, "..", "..", "..");
}
const args = process.argv.slice(2);
const distBin = join(packageRoot, "dist", "bin", "videoeditor.js");
const srcBin = join(packageRoot, "src", "bin", "videoeditor.ts");
const tsxCli = join(packageRoot, "node_modules", "tsx", "dist", "cli.mjs");

/** Spawns a process and forwards the exit code. */
function run(command, commandArgs) {
    const child = spawn(command, commandArgs, {
        stdio: "inherit",
        windowsHide: true
    });

    child.on("error", (error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    });

    child.on("exit", (code, signal) => {
        if (signal) {
            process.exit(1);
            return;
        }

        process.exit(code ?? 1);
    });
}

if (process.env.VIDEOEDITOR_BIN && existsSync(process.env.VIDEOEDITOR_BIN)) {
    run(process.execPath, [process.env.VIDEOEDITOR_BIN, ...args]);
} else if (existsSync(distBin)) {
    run(process.execPath, [distBin, ...args]);
} else if (existsSync(srcBin) && existsSync(tsxCli)) {
    run(process.execPath, [tsxCli, srcBin, ...args]);
} else {
    console.error(
        "Video Editor CLI not found. Build the package (`npm run build` in packages/videoeditor), then either\n" +
        "set VIDEOEDITOR_HOME to that folder or reinstall the skill with `node packages/cli install`.\n" +
        "Do not search npm, npx cache, or GitHub for a binary."
    );
    process.exit(1);
}
