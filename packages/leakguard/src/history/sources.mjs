import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

/** All source ids accepted by `--sources`. */
export const SOURCE_IDS = ["transcripts", "shell", "git", "guard", "injection"];

/** Default per-file cap. Larger files are skipped and recorded, never read into memory. */
export const DEFAULT_MAX_FILE_BYTES = 32 * 1024 * 1024;

/** Longest single JSONL line accepted. Longer lines are skipped and counted. */
export const MAX_LINE_CHARS = 2 * 1024 * 1024;

/** Directories that never hold useful history and are not worth walking. */
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "coverage", ".cache"]);

/**
 * Parses a comma separated source selection. An empty selection means every source.
 *
 * @param {string|string[]|undefined} value Raw selection
 * @returns {{ selected: string[], unknown: string[] }} Selection and unknown ids
 */
export function parseSources(value) {
    const ids = Array.isArray(value)
        ? value.flatMap((item) => String(item).split(","))
        : String(value ?? "").split(",");
    const cleaned = ids.map((id) => id.trim()).filter(Boolean);
    const selected = cleaned.length === 0 ? [...SOURCE_IDS] : cleaned.filter((id) => SOURCE_IDS.includes(id));
    return { selected: [...new Set(selected)], unknown: cleaned.filter((id) => !SOURCE_IDS.includes(id)) };
}

/**
 * Expands `~`, `%APPDATA%`, `%LOCALAPPDATA%` and `%USERPROFILE%` from a context, so tests can point
 * every source at a temporary home.
 *
 * @param {string} path Template path
 * @param {{ home: string, env: NodeJS.ProcessEnv }} ctx Context
 * @returns {string} Absolute path
 */
export function expand(path, ctx) {
    const env = ctx.env ?? {};
    const appData = env.APPDATA ?? join(ctx.home, "AppData", "Roaming");
    const localAppData = env.LOCALAPPDATA ?? join(ctx.home, "AppData", "Local");
    const userProfile = env.USERPROFILE ?? ctx.home;

    return path
        .replace(/^~[\\/]/, `${ctx.home}/`)
        .replace(/%APPDATA%/gi, appData)
        .replace(/%LOCALAPPDATA%/gi, localAppData)
        .replace(/%USERPROFILE%/gi, userProfile)
        .replace(/\\/g, "/");
}

/**
 * Declares where each source looks. `recursive` roots are walked for `.jsonl` files; exact paths
 * are read directly. `status` records whether the location is documented for this scanner.
 *
 * @param {{ home: string, env: NodeJS.ProcessEnv, stateDir: string }} ctx Context
 * @returns {{ transcripts: object[], shell: object[], guard: object[] }} Source specs
 */
export function sourceSpecs(ctx) {
    const stateDir = ctx.stateDir.replace(/\\/g, "/");

    return {
        transcripts: [
            { id: "claude", root: expand("~/.claude/projects", ctx), recursive: true },
            { id: "codex", root: expand("~/.codex/sessions", ctx), recursive: true },
            { id: "opencode", root: expand("~/.local/share/opencode", ctx), recursive: true },
            { id: "kilo", root: expand("~/.local/share/kilo", ctx), recursive: true },
            { id: "opencode-windows", root: expand("%APPDATA%/opencode", ctx), recursive: true },
            { id: "kilo-windows", root: expand("%APPDATA%/kilo", ctx), recursive: true },
            { id: "copilot", root: expand("~/.copilot/session-state", ctx), recursive: true }
        ],
        shell: [
            { id: "bash", root: expand("~/.bash_history", ctx), recursive: false },
            { id: "zsh", root: expand("~/.zsh_history", ctx), recursive: false },
            { id: "fish", root: expand("~/.local/share/fish/fish_history", ctx), recursive: false },
            {
                id: "powershell",
                root: expand("%APPDATA%/Microsoft/Windows/PowerShell/PSReadLine/ConsoleHost_history.txt", ctx),
                recursive: false
            }
        ],
        guard: [{ id: "events", root: join(stateDir, "events.jsonl").replace(/\\/g, "/"), recursive: false }]
    };
}

/**
 * Agents with no documented local history folder that this scanner reads. A scan lists them as
 * not covered instead of guessing at a location.
 */
export const UNCOVERED_TRANSCRIPTS = ["cursor", "kiro", "antigravity", "cline", "muse"];

/**
 * Walks a root for readable files. Missing roots are recorded quietly; large and old files become
 * skip records so the report can account for them.
 *
 * @param {{ id: string, root: string, recursive: boolean }} spec Source spec
 * @param {number|null} cutoffMs Lower bound on modification time
 * @param {number} maxFileBytes Per-file cap
 * @returns {{ files: string[], missing: object[], skipped: object[] }} Discovery result
 */
export function discover(spec, cutoffMs = null, maxFileBytes = DEFAULT_MAX_FILE_BYTES) {
    const files = [];
    const missing = [];
    const skipped = [];

    function consider(path) {
        let stat;
        try {
            stat = statSync(path);
        } catch {
            return;
        }
        if (!stat.isFile()) {
            return;
        }
        if (stat.size > maxFileBytes) {
            skipped.push({ source: spec.id, path, reason: "file exceeds size cap", bytes: stat.size });
            return;
        }
        if (cutoffMs !== null && stat.mtimeMs < cutoffMs) {
            skipped.push({ source: spec.id, path, reason: "older than --since", bytes: stat.size });
            return;
        }
        files.push(path);
    }

    let stat;
    try {
        stat = statSync(spec.root);
    } catch {
        missing.push({ source: spec.id, path: spec.root, reason: "not present" });
        return { files, missing, skipped };
    }

    if (!spec.recursive) {
        consider(spec.root);
        return { files, missing, skipped };
    }

    if (stat.isFile()) {
        consider(spec.root);
        return { files, missing, skipped };
    }

    const pending = [spec.root];
    let visited = 0;

    while (pending.length > 0 && visited < 20000) {
        const dir = pending.shift();
        visited += 1;
        let entries = [];
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            skipped.push({ source: spec.id, path: dir, reason: "directory unreadable" });
            continue;
        }

        for (const entry of entries) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name)) {
                    pending.push(path);
                }
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".jsonl")) {
                consider(path);
            }
        }
    }

    if (pending.length > 0) {
        skipped.push({ source: spec.id, path: spec.root, reason: "directory walk limit reached" });
    }

    return { files, missing, skipped };
}

/**
 * Streams a JSONL file one line at a time. Malformed and oversized lines are counted, not thrown.
 *
 * @param {string} file File path
 * @param {(record: object, line: number, raw: string) => void} onLine Line handler
 * @returns {Promise<{ lines: number, badLines: number, skippedLines: number }>} Read statistics
 */
export async function readJsonl(file, onLine) {
    const stats = { lines: 0, badLines: 0, skippedLines: 0 };
    const stream = createReadStream(file, { encoding: "utf8" });
    const lines = createInterface({ input: stream, crlfDelay: Infinity });

    let lineNumber = 0;
    for await (const raw of lines) {
        lineNumber += 1;
        if (!raw.trim()) {
            continue;
        }
        if (raw.length > MAX_LINE_CHARS) {
            stats.skippedLines += 1;
            continue;
        }
        let record;
        try {
            record = JSON.parse(raw);
        } catch {
            stats.badLines += 1;
            continue;
        }
        if (!record || typeof record !== "object" || Array.isArray(record)) {
            stats.badLines += 1;
            continue;
        }
        stats.lines += 1;
        onLine(record, lineNumber, raw);
    }

    return stats;
}

/**
 * Reads a complete small text file. Returns null for binary content.
 *
 * @param {string} file File path
 * @returns {string|null} UTF-8 text
 */
export function readText(file) {
    let content;
    try {
        content = readFileSync(file, "utf8");
    } catch {
        return null;
    }
    if (content.includes("\u0000")) {
        return null;
    }
    return content;
}

/**
 * Runs a read only git command and returns its stdout, or an error note when git is absent or the
 * path is not a repository. No shell is used and no repository state is changed.
 *
 * @param {string[]} args Git arguments
 * @param {string} repo Repository path
 * @returns {{ ok: boolean, stdout: string, note?: string }} Command result
 */
export function git(args, repo) {
    try {
        const stdout = execFileSync("git", ["-C", repo, ...args], {
            encoding: "utf8",
            maxBuffer: 128 * 1024 * 1024,
            timeout: 180000,
            windowsHide: true
        });
        return { ok: true, stdout };
    } catch (error) {
        return { ok: false, stdout: "", note: String(error.message ?? error).slice(0, 300) };
    }
}

/**
 * Collects git evidence: added lines from all patches, currently tracked files, and the contents
 * of dotenv files that were ever committed but are no longer tracked.
 *
 * @param {string} repo Repository path
 * @param {number|null} sinceDays Optional age window
 * @param {number} maxFileBytes Per-file cap for blob contents
 * @returns {object} Git evidence with skip and error records
 */
export function gitEvidence(repo, sinceDays = null, maxFileBytes = DEFAULT_MAX_FILE_BYTES) {
    const result = {
        addedLines: [],
        tracked: [],
        envBlobs: [],
        skipped: [],
        errors: []
    };

    if (!existsSync(repo)) {
        result.errors.push({ path: repo, note: "repository path not present" });
        return result;
    }

    const patchArgs = ["--no-pager", "log", "--no-color", "-p", "--all", "--diff-filter=AM"];
    if (sinceDays !== null) {
        patchArgs.push(`--since=${sinceDays}.days`);
    }

    const patch = git(patchArgs, repo);
    if (!patch.ok) {
        result.errors.push({ path: repo, note: `git log failed: ${patch.note}` });
    } else {
        let file = "unknown";
        for (const line of patch.stdout.split("\n")) {
            if (line.startsWith("+++ b/")) {
                file = line.slice(6).trim();
            } else if (line.startsWith("+") && !line.startsWith("+++")) {
                result.addedLines.push({ file, text: line.slice(1) });
            }
        }
    }

    const tracked = git(["--no-pager", "ls-files", "-z"], repo);
    if (!tracked.ok) {
        result.errors.push({ path: repo, note: `git ls-files failed: ${tracked.note}` });
    } else {
        result.tracked = tracked.stdout.split("\0").filter(Boolean);
    }

    const addedFiles = git(["--no-pager", "log", "--all", "--name-only", "--pretty=format:", "--diff-filter=A"], repo);
    if (!addedFiles.ok) {
        result.errors.push({ path: repo, note: `git log names failed: ${addedFiles.note}` });
    } else {
        const envPaths = [...new Set(
            addedFiles.stdout.split("\n")
                .map((line) => line.trim())
                .filter((line) => /(^|\/)\.env(?:\.|$)/i.test(line))
        )];
        const trackedSet = new Set(result.tracked);

        for (const path of envPaths.slice(0, 100)) {
            if (trackedSet.has(path)) {
                continue;
            }
            const commit = git(["--no-pager", "log", "--all", "--diff-filter=A", "--format=%H", "--max-count=1", "--", path], repo);
            if (!commit.ok || !commit.stdout.trim()) {
                continue;
            }
            const hash = commit.stdout.trim().split("\n")[0];
            const blob = git(["--no-pager", "show", `${hash}:${path}`], repo);
            if (!blob.ok) {
                continue;
            }
            if (Buffer.byteLength(blob.stdout, "utf8") > maxFileBytes) {
                result.skipped.push({ source: "git", path, reason: "blob exceeds size cap", bytes: Buffer.byteLength(blob.stdout, "utf8") });
                continue;
            }
            result.envBlobs.push({ path, text: blob.stdout });
        }

        if (envPaths.length > 100) {
            result.skipped.push({ source: "git", path: repo, reason: "dotenv blob limit reached", bytes: envPaths.length - 100 });
        }
    }

    return result;
}

/**
 * Resolves the project name used for the default output folder.
 *
 * @param {string} repo Repository path
 * @returns {string} Folder name
 */
export function projectName(repo) {
    const normalized = resolve(repo).replace(/[\\/]+$/, "");
    const parts = normalized.split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] ?? "project";
}
