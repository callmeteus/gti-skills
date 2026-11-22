/**
 * MCP servers shipped in gtihq/ai-mcps: discovery, managed installs, and dependencies.
 *
 * A managed install lives in ~/.gti/skills/mcps/<name>/: a copy of the server's source plus
 * either a built Go binary or a Python .venv. Files the server writes at runtime (logins,
 * cookies, browser profiles) are never deleted; only files that came from an earlier copy
 * and are gone upstream are removed.
 *
 * Go servers are Go commands in one module at the repository root (go.mod/go.sum there).
 * Python servers keep their own requirements.txt and entry script. Discovery uses the files
 * that are present, so both generations can coexist during a migration.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

export const Manifest = ".gti-mcp.json";
const SKIP = new Set([".venv", "venv", "__pycache__", ".git", "node_modules", ".pytest_cache", ".mypy_cache", "tests", Manifest]);
const SKIP_FILES = new Set([".env", "cookies.json"]);

/** Finds every MCP server in the gtihq/ai-mcps tree: one <name>-mcp folder per server at the root. */
export function discoverMcps(root) {
    const found = [];
    const candidates = [];
    // Cada servidor é uma pasta "<nome>-mcp" na raiz do repositório
    for (const entry of readdirSync(root)) if (entry.endsWith("-mcp")) candidates.push(join(root, entry));
    const rootGo = existsSync(join(root, "go.mod"));
    for (const dir of candidates.sort()) {
        if (!statSync(dir).isDirectory()) continue;
        const folder = dir.split(sep).pop();
        const name = folder.replace(/-mcp$/, "");
        const aliases = [...new Set([name, folder])];
        const localGo = existsSync(join(dir, "go.mod"));

        // Go: an explicit module in the server folder, or the single module at the repo root.
        if (existsSync(join(dir, "main.go")) && (localGo || rootGo)) {
            found.push({
                name,
                folder,
                source: localGo ? dir : root,
                serverDir: localGo ? "." : folder,
                entry: "main.go",
                language: "go",
                runtime: "go",
                aliases,
                browser: null,
                login: false,
                binary: folder,
            });
            continue;
        }

        // Legacy Python server.
        if (!existsSync(join(dir, "requirements.txt"))) continue;
        const entry = existsSync(join(dir, "mcp_server.py")) ? "mcp_server.py" : existsSync(join(dir, "server.py")) ? "server.py" : null;
        if (!entry) continue;
        const requirements = readFileSync(join(dir, "requirements.txt"), "utf8");
        found.push({
            name,
            folder,
            source: dir,
            serverDir: folder,
            entry,
            language: "python",
            runtime: "python",
            aliases,
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

/** File name of the binary a Go server is built into, inside its managed folder. */
export function binaryName(mcp, platform = process.platform) {
    const base = mcp.binary ?? `${mcp.name}-mcp`;
    return platform === "win32" ? `${base}.exe` : base;
}

export function binaryPath(dir, mcp, platform = process.platform) {
    return join(dir, binaryName(mcp, platform));
}

/** Command and arguments an agent config must run for this server. */
export function runtimeCommand(mcp, dir, platform = process.platform) {
    return mcp.language === "go" ? [binaryPath(dir, mcp, platform)] : [venvPython(dir, platform), join(dir, mcp.entry)];
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
 * A built Go binary is not part of the source and is skipped.
 */
export function listFiles(dir, run = spawnSync) {
    const git = run("git", ["-C", dir, "ls-files", "-z", "--", "."], { encoding: "utf8" });
    const files = git.status === 0 && git.stdout ? git.stdout.split("\0").filter(Boolean) : walkFiles(dir);
    return files
        .filter((file) => !file.split("/").some((part) => SKIP.has(part)) && !SKIP_FILES.has(file.split("/").pop()))
        .filter((file) => !isBuiltBinary(file))
        .filter((file) => existsSync(join(dir, ...file.split("/"))))
        .sort();
}

function isBuiltBinary(file) {
    const name = file.split("/").pop();
    return /\.exe$/i.test(name) || /^[A-Za-z0-9_-]+-mcp$/i.test(name);
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

/** Value stored as requirements in the manifest: Python requirements or the Go module and sources. */
function depsKey(mcp) {
    if (mcp.language === "go") {
        const mod = existsSync(join(mcp.source, "go.mod")) ? readFileSync(join(mcp.source, "go.mod"), "utf8") : "";
        const sum = existsSync(join(mcp.source, "go.sum")) ? readFileSync(join(mcp.source, "go.sum"), "utf8") : "";
        const sources = listFiles(mcp.source)
            .filter((file) => file.endsWith(".go"))
            .map((file) => `${file}\n${readFileSync(join(mcp.source, ...file.split("/")), "utf8")}`)
            .join("\n");
        return hash(`${mod}\n${sum}\n${sources}`);
    }
    return hash(readFileSync(join(mcp.source, "requirements.txt"), "utf8"));
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
    const requirements = depsKey(mcp);
    const runtime = mcp.language === "go" ? binaryPath(dir, mcp) : venvPython(dir);
    const manifest = {
        name: mcp.name,
        language: mcp.language ?? "python",
        commit,
        files: files.filter((file) => !kept.includes(file)),
        requirements,
        depsInstalled: previous?.depsInstalled ?? null,
    };
    writeFileSync(join(dir, Manifest), `${JSON.stringify(manifest, null, 4)}\n`);
    return { changed, removed, kept, fresh: previous === null, depsCurrent: previous?.depsInstalled === requirements && existsSync(runtime) };
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
        if (/\.(py|md|txt|toml|yaml|yml|lock|png|jpg|go|sum|mod)$/i.test(entry) || entry === "Dockerfile" || entry === "LICENSE") continue;
        cpSync(join(fromDir, entry), join(toDir, entry), { recursive: true });
        carried.push(entry);
    }
    return carried;
}

/** First Python 3.10+ on this machine, as [command, ...args]. Legacy Python servers only. */
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

/** Go on PATH with, when given, at least the version required by go.mod. */
export function findGo(run = spawnSync, required = null) {
    const result = run("go", ["version"], { encoding: "utf8" });
    if (result.status !== 0) return null;
    if (!required) return "go";
    const version = /go(\d+)\.(\d+)/.exec(String(result.stdout ?? ""));
    if (!version) return "go";
    const major = Number(version[1]);
    const minor = Number(version[2]);
    if (major > required[0] || (major === required[0] && minor >= required[1])) return "go";
    return null;
}

/** Installs or rebuilds the server: go build for Go, venv plus pip for legacy Python. */
export function installDeps(mcp, dir, options = {}) {
    const run = options.run ?? spawnSync;
    const stdio = options.stdio ?? "inherit";
    const platform = options.platform ?? process.platform;

    if (mcp.language === "go") {
        const mod = existsSync(join(mcp.source, "go.mod")) ? readFileSync(join(mcp.source, "go.mod"), "utf8") : "";
        const declared = /^\s*go\s+(\d+)\.(\d+)/m.exec(mod);
        const required = declared ? [Number(declared[1]), Number(declared[2])] : null;
        if (!findGo(run, required)) {
            const label = required ? `${required[0]}.${required[1]} or later ` : "";
            throw new Error(`Go ${label}was not found. Install Go, then run the update again.`);
        }
        const target = mcp.serverDir && mcp.serverDir !== "." ? `./${mcp.serverDir}` : ".";
        const result = run("go", ["build", "-o", binaryPath(dir, mcp, platform), target], { stdio, cwd: dir });
        if (result.status !== 0) throw new Error(`go build failed for ${mcp.name}.`);
        return;
    }

    const python = venvPython(dir, platform);
    if (!existsSync(python)) {
        const base = options.python ?? findPython(run, platform);
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
    const [command, ...args] = runtimeCommand(mcp, dir);
    const result = run(command, args, { input, encoding: "utf8", timeout: 60000, cwd: dir });
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
