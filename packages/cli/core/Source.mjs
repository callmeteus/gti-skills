import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gunzipSync } from "node:zlib";

import { readJson } from "./Installs.mjs";
import { RepoRoot } from "./Paths.mjs";

/**
 * File written at the root of a downloaded source tree with the commit it came from.
 */
export const SourceStamp = ".gti-skills-source.json";

/**
 * Resolves the GitHub repository and branch that updates come from.
 * GTI_SKILLS_REPO (owner/name) and GTI_SKILLS_BRANCH override the defaults.
 *
 * @param {string} [root] Repository root that holds package.json
 * @returns {{ repo: string, branch: string }} Repository slug and branch
 */
export function updateSource(root = RepoRoot) {
    const url = readJson(join(root, "packages", "cli", "package.json"), {}).repository?.url ?? "";
    const match = /github\.com[/:]([^/]+\/[^/.]+)/.exec(url);

    return {
        repo: process.env.GTI_SKILLS_REPO ?? match?.[1] ?? "callmeteus/gti-skills",
        branch: process.env.GTI_SKILLS_BRANCH ?? "master"
    };
}

/**
 * Finds the commit a source tree came from: the stamp of a downloaded tree, or HEAD of a git checkout.
 *
 * @param {string} [root] Source tree root
 * @returns {string | null} Full commit hash, or null when unknown
 */
export function sourceCommit(root = RepoRoot) {
    const stamp = readJson(join(root, SourceStamp), null);

    if (stamp?.commit) {
        return stamp.commit;
    }

    const result = spawnSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" });

    return result.status === 0 ? result.stdout.trim() : null;
}

/**
 * Builds GitHub API request headers, with a token from GITHUB_TOKEN or GH_TOKEN when set.
 *
 * @param {string} accept Accept header
 * @returns {Record<string, string>} Headers
 */
function githubHeaders(accept) {
    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
    const headers = { "Accept": accept, "User-Agent": "gti-skills-cli", "X-GitHub-Api-Version": "2022-11-28" };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

/**
 * Asks GitHub for the latest commit hash on a branch.
 *
 * @param {{ repo: string, branch: string }} source Repository and branch
 * @param {{ fetch?: typeof fetch, timeoutMs?: number }} [options] Fetch override and timeout
 * @returns {Promise<string>} Full commit hash
 */
export async function fetchLatestCommit(source, options = {}) {
    const request = options.fetch ?? fetch;
    const url = `https://api.github.com/repos/${source.repo}/commits/${encodeURIComponent(source.branch)}`;
    const response = await request(url, {
        headers: githubHeaders("application/vnd.github.sha"),
        signal: AbortSignal.timeout(options.timeoutMs ?? 15000)
    });

    if (!response.ok) {
        throw new Error(`GitHub answered ${response.status} for ${source.repo}@${source.branch}. Set GITHUB_TOKEN if the repository is private or the rate limit was hit.`);
    }

    const commit = (await response.text()).trim();

    if (!/^[0-9a-f]{40}$/.test(commit)) {
        throw new Error(`GitHub returned an unexpected commit for ${source.repo}@${source.branch}: ${commit.slice(0, 80)}`);
    }

    return commit;
}

/**
 * Downloads the tarball of one commit.
 *
 * @param {string} repo Repository slug
 * @param {string} commit Commit hash
 * @param {{ fetch?: typeof fetch }} [options] Fetch override
 * @returns {Promise<Buffer>} Gzipped tarball
 */
export async function downloadTarball(repo, commit, options = {}) {
    const request = options.fetch ?? fetch;
    const response = await request(`https://api.github.com/repos/${repo}/tarball/${commit}`, {
        headers: githubHeaders("application/vnd.github+json"),
        signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
        throw new Error(`Downloading ${repo}@${commit.slice(0, 7)} failed with ${response.status}.`);
    }

    return Buffer.from(await response.arrayBuffer());
}

/**
 * Reads a NUL terminated string from a tar header field.
 *
 * @param {Buffer} block Header block
 * @param {number} start Field offset
 * @param {number} length Field length
 * @returns {string} Field text
 */
function field(block, start, length) {
    const raw = block.subarray(start, start + length);
    const end = raw.indexOf(0);

    return raw.subarray(0, end === -1 ? raw.length : end).toString("utf8");
}

/**
 * Extracts a gzipped tarball into a folder, dropping the top-level folder GitHub adds.
 * Only regular files and folders are written; links and unsafe paths are skipped.
 *
 * @param {Buffer} archive Gzipped tarball
 * @param {string} destination Folder to write into
 * @returns {number} Number of files written
 */
export function extractTarball(archive, destination) {
    const tar = gunzipSync(archive);
    let offset = 0;
    let longPath = null;
    let written = 0;

    while (offset + 512 <= tar.length) {
        const header = tar.subarray(offset, offset + 512);

        if (header.every((byte) => byte === 0)) {
            break;
        }

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

        if (type !== "0" && type !== "5") {
            continue;
        }

        const parts = path.split("/").slice(1).filter(Boolean);

        if (parts.length === 0 || parts.some((part) => part === ".." || part.includes(":") || part.includes("\\"))) {
            continue;
        }

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
