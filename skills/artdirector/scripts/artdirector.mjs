import { existsSync, readFileSync, realpathSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves and runs the ArtDirector CLI from the linked package.
 * Follows junctions so a skill folder linked into any agent directory still finds the package.
 *
 * Resolution order: ARTDIRECTOR_HOME, an ancestor that is the package, an ancestor that
 * contains packages/artdirector (a copy generated inside the gti-skills repository), then
 * the artdirector.root file written by the installer.
 */
const scriptsDir = dirname(fileURLToPath(import.meta.url));
const realScripts = realpathSync(scriptsDir);

/**
 * True when a directory holds the ArtDirector CLI entry point.
 *
 * @param directory Candidate package root
 * @returns Whether the CLI can run from it
 */
function isPackageRoot(directory) {
    return existsSync(join(directory, "dist", "bin", "artdirector.js")) ||
        existsSync(join(directory, "src", "bin", "artdirector.ts"));
}

/**
 * Walks upward from the script directory to find the ArtDirector package root.
 *
 * @param start Starting directory
 * @returns Package root or null
 */
function findPackageRoot(start) {
    let current = start;

    for (let i = 0; i < 10; i += 1) {
        if (isPackageRoot(current)) {
            return current;
        }

        const nested = join(current, "packages", "artdirector");

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

let packageRoot = process.env.ARTDIRECTOR_HOME && isPackageRoot(process.env.ARTDIRECTOR_HOME)
    ? process.env.ARTDIRECTOR_HOME
    : findPackageRoot(realScripts);

if (!packageRoot) {
    const rootFile = join(scriptsDir, "artdirector.root");

    if (existsSync(rootFile)) {
        packageRoot = readFileSync(rootFile, "utf8").trim();
    }
}

if (!packageRoot) {
    packageRoot = join(realScripts, "..", "..", "..");
}
const args = process.argv.slice(2);
const distBin = join(packageRoot, "dist", "bin", "artdirector.js");
const srcBin = join(packageRoot, "src", "bin", "artdirector.ts");
const tsxCli = join(packageRoot, "node_modules", "tsx", "dist", "cli.mjs");

/**
 * Spawns a process and forwards the exit code.
 *
 * @param command Executable
 * @param commandArgs Arguments
 */
function run(command, commandArgs) {
    const child = spawn(command, commandArgs, {
        stdio: "inherit",
        windowsHide: true
    });

    child.on("error", (err) => {
        console.error(err instanceof Error ? err.message : String(err));
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

if (process.env.ARTDIRECTOR_BIN && existsSync(process.env.ARTDIRECTOR_BIN)) {
    run(process.execPath, [process.env.ARTDIRECTOR_BIN, ...args]);
} else if (existsSync(distBin)) {
    run(process.execPath, [distBin, ...args]);
} else if (existsSync(srcBin) && existsSync(tsxCli)) {
    run(process.execPath, [tsxCli, srcBin, ...args]);
} else {
    console.error(
        "ArtDirector CLI not found. Build the package (`npm run build` in packages/artdirector), then either\n" +
        "set ARTDIRECTOR_HOME to that folder or reinstall the skill with `node packages/cli install`.\n" +
        "Do not search npm, npx cache, or GitHub for a binary."
    );
    process.exit(1);
}
