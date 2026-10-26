import { existsSync, readFileSync, realpathSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves and runs the ArtDirector CLI from the linked package.
 * Follows junctions so Cursor's ~/.cursor/skills/artdirector still finds Pacotes/artdirector.
 */
const scriptsDir = dirname(fileURLToPath(import.meta.url));
const realScripts = realpathSync(scriptsDir);

/**
 * Walks upward from the script directory to find the ArtDirector package root.
 *
 * @param start Starting directory
 * @returns Package root or null
 */
function findPackageRoot(start) {
    let current = start;

    for (let i = 0; i < 8; i += 1) {
        if (
            existsSync(join(current, "dist", "bin", "artdirector.js")) ||
            existsSync(join(current, "src", "bin", "artdirector.ts"))
        ) {
            return current;
        }

        const parent = dirname(current);

        if (parent === current) {
            break;
        }

        current = parent;
    }

    return null;
}

let packageRoot = findPackageRoot(realScripts);

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
        "ArtDirector CLI not found. From the package root run `npm run build` then `npm link`.\n" +
        "Do not search npm, npx cache, or GitHub for a binary."
    );
    process.exit(1);
}
