import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { gzipSync } from "node:zlib";

import { runInstall } from "../commands/Install.mjs";
import { notifyUpdate, runUpdate } from "../commands/Update.mjs";
import { readInstalls, recordInstalls, writeJson } from "../core/Installs.mjs";
import { RepoRoot } from "../core/Paths.mjs";
import { extractTarball, fetchLatestCommit } from "../core/Source.mjs";
import { readTree } from "../core/Tree.mjs";

process.env.GTI_SKILLS_HOME = mkdtempSync(join(tmpdir(), "gti-state-"));

const Latest = "a".repeat(40);

/**
 * Creates an output collector.
 *
 * @returns {{ out: (line: string) => void, err: (line: string) => void, lines: string[], errors: string[] }} Collector
 */
function collect() {
    const lines = [];
    const errors = [];

    return { out: (line) => lines.push(line), err: (line) => errors.push(line), lines, errors };
}

/**
 * Writes a full-install record for one skill folder, as an install that selected every pack would.
 *
 * @param {string} project Project root
 * @param {string} stateDir State folder
 * @param {string} skill Skill id
 */
function seedFull(project, stateDir, skill = "better-tests") {
    const destination = join(project, ".claude", "skills", skill);
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, "SKILL.md"), "old\n");
    recordInstalls(stateDir, [{ destination, skill, harnesses: ["claude"], scope: "project", projectRoot: project, commit: "b".repeat(40), installedAt: "", full: true }]);
}

/**
 * Builds one tar header block.
 *
 * @param {string} name Entry name (at most 100 bytes)
 * @param {number} size Data size
 * @param {string} type Type flag
 * @returns {Buffer} Header block
 */
function tarHeader(name, size, type) {
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, "utf8");
    header.write("0000644\0", 100);
    header.write(`${size.toString(8).padStart(11, "0")}\0`, 124);
    header.write(type, 156);
    header.write("ustar\0" + "00", 257);
    header.write(" ".repeat(8), 148);
    const sum = header.reduce((total, byte) => total + byte, 0);
    header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);

    return header;
}

/**
 * Builds a gzipped tarball shaped like the ones GitHub serves: one top folder and pax headers for long paths.
 *
 * @param {Map<string, Buffer>} files Relative path to content
 * @returns {Buffer} Gzipped tarball
 */
function makeTarball(files) {
    const blocks = [];
    const pad = (data) => Buffer.concat([data, Buffer.alloc((512 - (data.length % 512)) % 512)]);

    for (const [path, content] of files) {
        const name = `callmeteus-gti-skills-aaaaaaa/${path}`;

        if (Buffer.byteLength(name) > 100) {
            let record = ` path=${name}\n`;
            record = `${Buffer.byteLength(record) + String(Buffer.byteLength(record)).length + 1}${record}`;
            blocks.push(tarHeader("pax", Buffer.byteLength(record), "x"), pad(Buffer.from(record)));
        }

        blocks.push(tarHeader(name.slice(0, 100), content.length, "0"), pad(content));
    }

    blocks.push(Buffer.alloc(1024));

    return gzipSync(Buffer.concat(blocks));
}

/**
 * Packs the CLI and the requested skills from this checkout, as a stand-in for the GitHub tarball.
 *
 * @param {string[]} [skillIds] Skill folders to include
 * @returns {Buffer} Gzipped tarball
 */
function repoTarball(skillIds = ["better-tests"]) {
    const files = new Map();

    for (const folder of ["packages/cli", ...skillIds.map((id) => `skills/${id}`)]) {
        for (const [path, content] of readTree(join(RepoRoot, ...folder.split("/")), (relative) => relative === "tests")) {
            files.set(`${folder}/${path}`, content);
        }
    }

    return makeTarball(files);
}

/**
 * Fakes the two GitHub endpoints the updater calls.
 *
 * @param {Buffer} tarball Tarball served for any commit
 * @returns {{ fetch: typeof fetch, calls: string[] }} Fetch stub and the URLs it served
 */
function fakeGitHub(tarball) {
    const calls = [];

    return {
        calls,
        fetch: async (url) => {
            calls.push(url);

            return url.includes("/commits/") ? new Response(`${Latest}\n`) : new Response(tarball);
        }
    };
}

describe("source", () => {
    it("extracts a GitHub style tarball without its top folder, including long paths", () => {
        const long = `deep/${"x".repeat(90)}/file.txt`;
        const target = mkdtempSync(join(tmpdir(), "gti-tar-"));
        const count = extractTarball(makeTarball(new Map([["a.txt", Buffer.from("A")], [long, Buffer.from("L")]])), target);
        assert.equal(count, 2);
        assert.equal(readFileSync(join(target, "a.txt"), "utf8"), "A");
        assert.equal(readFileSync(join(target, ...long.split("/")), "utf8"), "L");
    });

    it("skips entries that escape the destination", () => {
        const target = mkdtempSync(join(tmpdir(), "gti-tar-"));
        assert.equal(extractTarball(makeTarball(new Map([["../evil.txt", Buffer.from("x")]])), target), 0);
        assert.ok(!existsSync(join(target, "..", "evil.txt")));
    });

    it("reads the latest commit and rejects bad answers", async () => {
        const source = { repo: "gtihq/ai-skills", branch: "master" };
        assert.equal(await fetchLatestCommit(source, { fetch: async () => new Response(Latest) }), Latest);
        await assert.rejects(fetchLatestCommit(source, { fetch: async () => new Response("nope", { status: 404 }) }), /404/);
        await assert.rejects(fetchLatestCommit(source, { fetch: async () => new Response("<html>") }), /unexpected commit/);
    });
});

describe("update", () => {
    it("records installs with the source commit", () => {
        const project = mkdtempSync(join(tmpdir(), "gti-install-"));
        const stateDir = mkdtempSync(join(tmpdir(), "gti-state-"));
        assert.equal(runInstall({ harness: "codex,muse", skill: "better-tests" }, collect(), { cwd: project, stateDir }), 0);
        const [record] = readInstalls(stateDir);
        assert.equal(record.destination, join(project, ".agents", "skills", "better-tests"));
        assert.deepEqual(record.harnesses, ["codex", "muse"]);
        assert.match(record.commit ?? "", /^[0-9a-f]{40}$/);
    });

    it("downloads the latest commit and reinstalls outdated skills, then reports up to date", async () => {
        const project = mkdtempSync(join(tmpdir(), "gti-install-"));
        const home = mkdtempSync(join(tmpdir(), "gti-home-"));
        const stateDir = mkdtempSync(join(tmpdir(), "gti-state-"));
        assert.equal(runInstall({ harness: "claude", skill: "better-tests" }, collect(), { cwd: project, home, stateDir }), 0);

        const github = fakeGitHub(repoTarball());
        const check = collect();
        assert.equal(await runUpdate({ check: true }, check, { cwd: project, home, stateDir, fetch: github.fetch }), 0);
        assert.ok(check.lines.some((line) => line.startsWith("outdated better-tests")));
        assert.ok(!github.calls.some((url) => url.includes("/tarball/")), "--check downloads nothing");

        // Two earlier downloads: the newer one may still run a studio, so only the oldest goes.
        for (const [name, seconds] of [["oldest000000", 1000], ["previous0000", 2000]]) {
            mkdirSync(join(stateDir, "sources", name), { recursive: true });
            const stamp = join(stateDir, "sources", name, ".gti-skills-source.json");
            writeFileSync(stamp, "{}");
            utimesSync(stamp, seconds, seconds);
        }

        const io = collect();
        assert.equal(await runUpdate({}, io, { cwd: project, home, stateDir, fetch: github.fetch }), 0, io.errors.join("\n"));
        assert.ok(!existsSync(join(stateDir, "sources", "oldest000000")));
        assert.ok(existsSync(join(stateDir, "sources", "previous0000")));
        assert.equal(readInstalls(stateDir)[0].commit, Latest);
        assert.ok(existsSync(join(project, ".claude", "skills", "better-tests", "SKILL.md")));
        assert.ok(existsSync(join(stateDir, "sources", Latest.slice(0, 12), ".gti-skills-source.json")));

        const again = collect();
        github.calls.length = 0;
        assert.equal(await runUpdate({}, again, { cwd: project, home, stateDir, fetch: github.fetch }), 0);
        assert.ok(again.lines.some((line) => line.startsWith("Everything is at aaaaaaa")));
        assert.ok(!github.calls.some((url) => url.includes("/tarball/")));
    });

    it("installs an explicit selection from the latest commit", async () => {
        const project = mkdtempSync(join(tmpdir(), "gti-install-"));
        const home = mkdtempSync(join(tmpdir(), "gti-home-"));
        const stateDir = mkdtempSync(join(tmpdir(), "gti-state-"));
        const io = collect();
        const flags = { harness: "cursor", skill: "better-tests" };
        assert.equal(await runUpdate(flags, io, { cwd: project, home, stateDir, fetch: fakeGitHub(repoTarball()).fetch }), 0, io.errors.join("\n"));
        assert.ok(existsSync(join(project, ".cursor", "skills", "better-tests", "SKILL.md")));
        assert.equal(readInstalls(stateDir)[0].commit, Latest);
    });

    it("installs skills that are new in the latest commit when --install-new is set", async () => {
        const project = mkdtempSync(join(tmpdir(), "gti-install-"));
        const home = mkdtempSync(join(tmpdir(), "gti-home-"));
        const stateDir = mkdtempSync(join(tmpdir(), "gti-state-"));
        seedFull(project, stateDir);

        const github = fakeGitHub(repoTarball(["better-tests", "maestro"]));
        const check = collect();
        assert.equal(await runUpdate({ check: true, "install-new": true }, check, { cwd: project, home, stateDir, fetch: github.fetch }), 0);
        assert.ok(check.lines.some((line) => line.startsWith("new      maestro")), check.lines.join("\n"));
        assert.ok(check.lines.some((line) => line.includes("new skill install(s) would be added")));
        assert.ok(!github.calls.some((url) => url.includes("/tarball/")), "--check downloads nothing");

        const io = collect();
        assert.equal(await runUpdate({ "install-new": true }, io, { cwd: project, home, stateDir, fetch: github.fetch }), 0, io.errors.join("\n"));
        assert.ok(existsSync(join(project, ".claude", "skills", "maestro", "SKILL.md")));
        assert.equal(readInstalls(stateDir).find((record) => record.skill === "maestro").commit, Latest);
    });

    it("installs a new pack when the recorded install was full", async () => {
        const project = mkdtempSync(join(tmpdir(), "gti-install-"));
        const home = mkdtempSync(join(tmpdir(), "gti-home-"));
        const stateDir = mkdtempSync(join(tmpdir(), "gti-state-"));
        seedFull(project, stateDir);

        const io = collect();
        assert.equal(await runUpdate({ "install-new": true }, io, { cwd: project, home, stateDir, fetch: fakeGitHub(repoTarball(["better-tests", "ux-psychology-review"])).fetch }), 0, io.errors.join("\n"));
        assert.ok(existsSync(join(project, ".claude", "skills", "ux-psychology-review", "SKILL.md")));
    });

    it("leaves a partial install unchanged even with --install-new", async () => {
        const project = mkdtempSync(join(tmpdir(), "gti-install-"));
        const home = mkdtempSync(join(tmpdir(), "gti-home-"));
        const stateDir = mkdtempSync(join(tmpdir(), "gti-state-"));
        assert.equal(runInstall({ harness: "claude", skill: "better-tests" }, collect(), { cwd: project, home, stateDir }), 0);

        const io = collect();
        assert.equal(await runUpdate({ "install-new": true }, io, { cwd: project, home, stateDir, fetch: fakeGitHub(repoTarball(["better-tests", "maestro"])).fetch }), 0, io.errors.join("\n"));
        assert.ok(!existsSync(join(project, ".claude", "skills", "maestro")));
    });

    it("leaves a full install alone without --install-new", async () => {
        const project = mkdtempSync(join(tmpdir(), "gti-install-"));
        const home = mkdtempSync(join(tmpdir(), "gti-home-"));
        const stateDir = mkdtempSync(join(tmpdir(), "gti-state-"));
        seedFull(project, stateDir);

        const io = collect();
        assert.equal(await runUpdate({}, io, { cwd: project, home, stateDir, fetch: fakeGitHub(repoTarball(["better-tests", "maestro"])).fetch }), 0, io.errors.join("\n"));
        assert.ok(!existsSync(join(project, ".claude", "skills", "maestro")));
    });

    it("fails cleanly when GitHub cannot be reached", async () => {
        const io = collect();
        const fail = async () => {
            throw new Error("offline");
        };
        assert.equal(await runUpdate({}, io, { stateDir: mkdtempSync(join(tmpdir(), "gti-state-")), fetch: fail }), 1);
        assert.ok(io.errors[0].includes("offline"));
    });
});

describe("update notice", () => {
    it("prints a notice for outdated installs using the cached daily check", async () => {
        const saved = process.env.CI;
        delete process.env.CI;

        try {
            const stateDir = mkdtempSync(join(tmpdir(), "gti-state-"));
            recordInstalls(stateDir, [{ destination: stateDir, skill: "better-tests", harnesses: ["claude"], scope: "user", projectRoot: stateDir, commit: "b".repeat(40), installedAt: "" }]);
            writeJson(join(stateDir, "state.json"), { checkedAt: new Date().toISOString(), latest: Latest });
            const io = collect();
            await notifyUpdate(io, { stateDir, fetch: async () => assert.fail("a fresh check must not call GitHub") });
            assert.ok(io.errors[0].startsWith("notice"));
        } finally {
            if (saved !== undefined) {
                process.env.CI = saved;
            }
        }
    });

    it("stays silent when GitHub is unreachable", async () => {
        const stateDir = mkdtempSync(join(tmpdir(), "gti-state-"));
        recordInstalls(stateDir, [{ destination: stateDir, skill: "better-tests", harnesses: ["claude"], scope: "user", projectRoot: stateDir, commit: null, installedAt: "" }]);
        const io = collect();
        await notifyUpdate(io, { stateDir, fetch: async () => {
            throw new Error("offline");
        } });
        assert.deepEqual(io.errors, []);
    });
});
