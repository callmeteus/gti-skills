/**
 * MCP servers shipped in gti-skills: discovery, managed installs, and Python dependencies.
 *
 * A managed install lives in ~/.gti-skills/mcps/<name>/: a copy of the server's files plus
 * a .venv. Files the server writes at runtime (logins, cookies, browser profiles) are never
 * deleted; only files that came from an earlier copy and are gone upstream are removed.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

export const Manifest = ".gti-mcp.json";
const SKIP = new Set([".venv", "venv", "__pycache__", ".git", "node_modules", ".pytest_cache", ".mypy_cache", "tests", Manifest]);
const SKIP_FILES = new Set([".env", "cookies.json"]);

/** Finds every MCP server in a source tree: mcps/<folder> and packages/python/*-mcp. */
export function discoverMcps(root) {
    const found = [];
    const candidates = [];
    const mcpsDir = join(root, "mcps");
    if (existsSync(mcpsDir)) for (const entry of readdirSync(mcpsDir)) candidates.push(join(mcpsDir, entry));
    const pyDir = join(root, "packages", "python");
    if (existsSync(pyDir)) for (const entry of readdirSync(pyDir)) if (entry.endsWith("-mcp")) candidates.push(join(pyDir, entry));
    for (const dir of candidates.sort()) {
        if (!statSync(dir).isDirectory() || !existsSync(join(dir, "requirements.txt"))) continue;
        const entry = existsSync(join(dir, "mcp_server.py")) ? "mcp_server.py" : existsSync(join(dir, "server.py")) ? "server.py" : null;
        if (!entry) continue;
        const folder = dir.split(sep).pop();
        const name = folder.replace(/-mcp$/, "");
        const requirements = readFileSync(join(dir, "requirements.txt"), "utf8");
        found.push({
            name,
            folder,
            source: dir,
            entry,
            aliases: [...new Set([name, folder])],
            browser: /^\s*patchright\b/m.test(requirements) ? "patchright" : /^\s*playwright\b/m.test(requirements) ? "playwright" : null,
            login: existsSync(join(dir, "login.py")),
        });
    }
    return found;
}

export function mcpsHome(home) {
    return join(home, "mcps");
}

export function installDir(home, mcp) {
    return join(mcpsHome(home), mcp.name);
}

export function venvPython(dir, platform = process.platform) {
    return platform === "win32" ? join(dir, ".venv", "Scripts", "python.exe") : join(dir, ".venv", "bin", "python");
}

function walkFiles(dir, base = dir) {
    const files = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (SKIP.has(entry.name) || entry.isSymbolicLink()) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) files.push(...walkFiles(full, base));
        else if (entry.isFile()) files.push(relative(base, full).split(sep).join("/"));
    }
    return files;
}

/**
 * The server's own files. In a git checkout only tracked files count, so logins, browser
 * profiles, and other ignored runtime files in a developer's checkout are never copied.
 * A downloaded source tree holds tracked files only, so it is walked.
 */
export function listFiles(dir, run = spawnSync) {
    const git = run("git", ["-C", dir, "ls-files", "-z", "--", "."], { encoding: "utf8" });
    const files = git.status === 0 && git.stdout ? git.stdout.split("\0").filter(Boolean) : walkFiles(dir);
    return files
        .filter((file) => !file.split("/").some((part) => SKIP.has(part)) && !SKIP_FILES.has(file.split("/").pop()))
        .filter((file) => existsSync(join(dir, ...file.split("/"))))
        .sort();
}

function readManifest(dir) {
    try {
        return JSON.parse(readFileSync(join(dir, Manifest), "utf8"));
    } catch {
        return null;
    }
}

function hash(text) {
    return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/**
 * Copies the server's files into its managed folder. Returns what changed.
 * Only files this folder got from an earlier copy are overwritten or removed; a file that
 * already exists without being in the manifest belongs to the server's runtime and is kept.
 */
export function syncFiles(mcp, dir, commit) {
    mkdirSync(dir, { recursive: true });
    const previous = readManifest(dir);
    const owned = new Set(previous?.files ?? []);
    const files = listFiles(mcp.source);
    let changed = 0;
    const kept = [];
    for (const file of files) {
        const from = join(mcp.source, ...file.split("/"));
        const to = join(dir, ...file.split("/"));
        if (existsSync(to) && !owned.has(file)) {
            kept.push(file);
            continue;
        }
        const same = existsSync(to) && readFileSync(to).equals(readFileSync(from));
        if (!same) {
            mkdirSync(join(to, ".."), { recursive: true });
            copyFileSync(from, to);
            changed += 1;
        }
    }
    const removed = [];
    for (const file of previous?.files ?? []) {
        if (!files.includes(file) && existsSync(join(dir, ...file.split("/")))) {
            rmSync(join(dir, ...file.split("/")), { force: true });
            removed.push(file);
        }
    }
    const requirements = hash(readFileSync(join(mcp.source, "requirements.txt"), "utf8"));
    const manifest = { name: mcp.name, commit, files: files.filter((file) => !kept.includes(file)), requirements, depsInstalled: previous?.depsInstalled ?? null };
    writeFileSync(join(dir, Manifest), `${JSON.stringify(manifest, null, 4)}\n`);
    return { changed, removed, kept, fresh: previous === null, depsCurrent: previous?.depsInstalled === requirements && existsSync(venvPython(dir)) };
}

export function markDepsInstalled(dir) {
    const manifest = readManifest(dir);
    manifest.depsInstalled = manifest.requirements;
    writeFileSync(join(dir, Manifest), `${JSON.stringify(manifest, null, 4)}\n`);
}

/**
 * Copies runtime state (cookies, browser profiles, .env) from an older install folder into the
 * managed one, for each top-level entry that is not part of the server's source and is missing.
 */
export function carryState(fromDir, toDir, mcp) {
    if (!existsSync(fromDir) || resolve(fromDir) === resolve(toDir)) return [];
    const sourceTop = new Set(readdirSync(mcp.source));
    const carried = [];
    for (const entry of readdirSync(fromDir)) {
        if (SKIP.has(entry) || (sourceTop.has(entry) && !SKIP_FILES.has(entry)) || existsSync(join(toDir, entry))) continue;
        if (/\.(py|md|txt|toml|yaml|yml|lock|png|jpg)$/i.test(entry) || entry === "Dockerfile" || entry === "LICENSE") continue;
        cpSync(join(fromDir, entry), join(toDir, entry), { recursive: true });
        carried.push(entry);
    }
    return carried;
}

/** First Python 3.10+ on this machine, as [command, ...args]. */
export function findPython(run = spawnSync, platform = process.platform) {
    const candidates = platform === "win32" ? [["py", "-3"], ["python"], ["python3"]] : [["python3"], ["python"]];
    for (const [command, ...args] of candidates) {
        const result = run(command, [...args, "-c", "import sys; print('%d.%d' % sys.version_info[:2])"], { encoding: "utf8" });
        if (result.status !== 0) continue;
        const [major, minor] = String(result.stdout).trim().split(".").map(Number);
        if (major === 3 && minor >= 10) return [command, ...args];
    }
    return null;
}

/** Creates the venv when missing, installs requirements, and installs the browser when the server needs one. */
export function installDeps(mcp, dir, options = {}) {
    const run = options.run ?? spawnSync;
    const stdio = options.stdio ?? "inherit";
    const python = venvPython(dir);
    if (!existsSync(python)) {
        const base = options.python ?? findPython(run);
        if (!base) throw new Error("Python 3.10 or later was not found. Install it, then run the update again.");
        const made = run(base[0], [...base.slice(1), "-m", "venv", join(dir, ".venv")], { stdio });
        if (made.status !== 0) throw new Error(`Creating the virtual environment for ${mcp.name} failed.`);
    }
    const steps = [["-m", "pip", "install", "--disable-pip-version-check", "-q", "-r", join(dir, "requirements.txt")]];
    if (mcp.browser) steps.push(["-m", mcp.browser, "install", "chromium"]);
    for (const args of steps) {
        const result = run(python, args, { stdio });
        if (result.status !== 0) throw new Error(`${args.slice(1, 3).join(" ")} failed for ${mcp.name}.`);
    }
}

/**
 * Starts the server once and sends an MCP initialize request over stdio.
 * Returns { ok: true } when it answers, or { ok: false, error } with the end of its stderr.
 */
export function checkServer(mcp, dir, run = spawnSync) {
    const input = `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "gti", version: "1" } } })}\n`;
    const result = run(venvPython(dir), [join(dir, mcp.entry)], { input, encoding: "utf8", timeout: 60000, cwd: dir });
    const answered = String(result.stdout ?? "").split("\n").some((line) => {
        try {
            const message = JSON.parse(line);
            return message.id === 1 && message.result;
        } catch {
            return false;
        }
    });
    if (answered) return { ok: true };
    const stderr = String(result.stderr ?? "").trim().split("\n").slice(-3).join(" | ");
    return { ok: false, error: result.error?.code === "ETIMEDOUT" ? "no answer within 60 s" : stderr || `exit ${result.status}` };
}
