/**
 * Latest gti-skills source tree, shared with the gti-skills CLI.
 *
 * Downloads the latest commit of the repository into ~/.gti-skills/sources/<commit-12>/,
 * the same folder and stamp file the CLI's `update` command uses, so both reuse one copy.
 * Standard library only; no git or tar needed.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { gunzipSync } from "node:zlib";

export const SourceStamp = ".gti-skills-source.json";

export function gtiHome(env = process.env) {
    return env.GTI_SKILLS_HOME || join(homedir(), ".gti-skills");
}

export function updateSource(env = process.env) {
    return { repo: env.GTI_SKILLS_REPO || "callmeteus/gti-skills", branch: env.GTI_SKILLS_BRANCH || "master" };
}

function githubHeaders(accept, env = process.env) {
    const headers = { Accept: accept, "User-Agent": "gti-skills-cli", "X-GitHub-Api-Version": "2022-11-28" };
    const token = env.GITHUB_TOKEN || env.GH_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

export async function fetchLatestCommit(source, options = {}) {
    const request = options.fetch ?? fetch;
    const response = await request(`https://api.github.com/repos/${source.repo}/commits/${encodeURIComponent(source.branch)}`, {
        headers: githubHeaders("application/vnd.github.sha"),
        signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${source.repo}@${source.branch}. Set GITHUB_TOKEN if the rate limit was hit.`);
    const commit = (await response.text()).trim();
    if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`GitHub returned an unexpected commit: ${commit.slice(0, 80)}`);
    return commit;
}

function field(block, start, length) {
    const raw = block.subarray(start, start + length);
    const end = raw.indexOf(0);
    return raw.subarray(0, end === -1 ? raw.length : end).toString("utf8");
}

/** Extracts a GitHub tarball, dropping its top folder. Only regular files and folders; unsafe paths are skipped. */
export function extractTarball(archive, destination) {
    const tar = gunzipSync(archive);
    let offset = 0;
    let longPath = null;
    let written = 0;
    while (offset + 512 <= tar.length) {
        const header = tar.subarray(offset, offset + 512);
        if (header.every((byte) => byte === 0)) break;
        const size = parseInt(field(header, 124, 12).trim() || "0", 8);
        const type = String.fromCharCode(header[156] || 48);
        const prefix = field(header, 257, 6).startsWith("ustar") ? field(header, 345, 155) : "";
        const data = tar.subarray(offset + 512, offset + 512 + size);
        let path = longPath ?? (prefix ? `${prefix}/${field(header, 0, 100)}` : field(header, 0, 100));
        offset += 512 + Math.ceil(size / 512) * 512;
        if (type === "x") {
            const pax = data.toString("utf8").match(/\d+ path=([^\n]*)\n/);
            longPath = pax ? pax[1] : null;
            continue;
        }
        if (type === "L") {
            longPath = data.toString("utf8").replace(/\0+$/, "");
            continue;
        }
        longPath = null;
        if (type !== "0" && type !== "5") continue;
        const parts = path.split("/").slice(1).filter(Boolean);
        if (parts.length === 0 || parts.some((part) => part === ".." || part.includes(":") || part.includes("\\"))) continue;
        path = join(destination, ...parts);
        if (type === "5") {
            mkdirSync(path, { recursive: true });
        } else {
            mkdirSync(dirname(path), { recursive: true });
            writeFileSync(path, data);
            written += 1;
        }
    }
    return written;
}

export function stampedCommit(root) {
    try {
        return JSON.parse(readFileSync(join(root, SourceStamp), "utf8")).commit ?? null;
    } catch {
        return null;
    }
}

/** Newest complete source tree already on disk, or null. */
export function cachedSource(home = gtiHome()) {
    const folder = join(home, "sources");
    if (!existsSync(folder)) return null;
    for (const entry of readdirSync(folder)) {
        const root = join(folder, entry);
        const commit = stampedCommit(root);
        if (commit && existsSync(join(root, "packages", "cli", "index.mjs"))) return { root, commit };
    }
    return null;
}

/** Returns { root, commit, downloaded } for the latest commit, downloading it when missing. */
export async function ensureLatestSource(options = {}) {
    const home = options.home ?? gtiHome();
    const source = options.source ?? updateSource();
    const request = options.fetch ?? fetch;
    const commit = await fetchLatestCommit(source, { fetch: request });
    const root = join(home, "sources", commit.slice(0, 12));
    if (stampedCommit(root) === commit) return { root, commit, downloaded: false };

    const response = await request(`https://api.github.com/repos/${source.repo}/tarball/${commit}`, {
        headers: githubHeaders("application/vnd.github+json"),
        signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`Downloading ${source.repo}@${commit.slice(0, 7)} failed with ${response.status}.`);
    const partial = `${root}.partial`;
    rmSync(partial, { recursive: true, force: true });
    mkdirSync(partial, { recursive: true });
    extractTarball(Buffer.from(await response.arrayBuffer()), partial);
    writeFileSync(join(partial, SourceStamp), `${JSON.stringify({ repo: source.repo, branch: source.branch, commit }, null, 4)}\n`);
    rmSync(root, { recursive: true, force: true });
    renameSync(partial, root);
    return { root, commit, downloaded: true };
}
