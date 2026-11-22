import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { gzipSync } from "node:zlib";

import { listEntries, matchEntries, readConfig, setEntry } from "../scripts/core/agents.mjs";
import { binaryName, binaryPath, carryState, checkServer, discoverMcps, installDeps, markDepsInstalled, syncFiles, venvPython } from "../scripts/core/mcps.mjs";
import { McpsSources, cachedSource, ensureLatestSource, extractTarball, mcpsSource } from "../scripts/core/source.mjs";
import { runMcps, skillsUpdate } from "../scripts/gti.mjs";

function temp(t) {
    const dir = mkdtempSync(join(tmpdir(), "gti-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    return dir;
}

function write(root, files) {
    for (const [path, text] of Object.entries(files)) {
        const full = join(root, ...path.split("/"));
        mkdirSync(join(full, ".."), { recursive: true });
        writeFileSync(full, text);
    }
}

function sourceTree(t, extra = {}) {
    const root = temp(t);
    write(root, {
        "kabum-mcp/server.py": "print('kabum v2')\n",
        "kabum-mcp/requirements.txt": "mcp\nhttpx\n",
        "shopee-mcp/mcp_server.py": "print('shopee')\n",
        "shopee-mcp/login.py": "",
        "shopee-mcp/requirements.txt": "mcp\npatchright\n",
        "shopee-mcp/shopee/api.py": "",
        "twitter-mcp/server.py": "",
        "twitter-mcp/requirements.txt": "mcp\nplaywright\n",
        "shared/requirements.txt": "",
        ...extra,
    });
    return { root, commit: "c".repeat(40) };
}

function sourceTreeGo(t, extra = {}) {
    const root = temp(t);
    write(root, {
        "go.mod": "module github.com/gtihq/ai-mcps\n\ngo 1.25.0\n",
        "go.sum": "github.com/example v1.0.0 h1:abc\n",
        "internal/mcpserver/server.go": "package mcpserver\n",
        "mcps/kabum-mcp/main.go": "package main\nfunc main() {}\n",
        "mcps/kabum-mcp/tools.go": "package main\n",
        "mcps/mercadolivre-mcp/main.go": "package main\nfunc main() {}\n",
        "mcps/mercadolivre-mcp/browser.go": "package main\n",
        "mcps/shopee-mcp/main.go": "package main\nfunc main() {}\n",
        ...extra,
    });
    return { root, commit: "d".repeat(40) };
}

const quiet = { out: () => {}, err: () => {} };
const ok = () => ({ ok: true });

test("discovers MCP servers with their entry script, aliases, browser, and login", (t) => {
    const mcps = discoverMcps(sourceTree(t).root);
    assert.deepEqual(mcps.map((m) => [m.name, m.entry, m.browser, m.login, m.language, m.runtime]), [
        ["kabum", "server.py", null, false, "python", "python"],
        ["shopee", "mcp_server.py", "patchright", true, "python", "python"],
        ["twitter", "server.py", "playwright", false, "python", "python"],
    ]);
    assert.deepEqual(mcps[0].aliases, ["kabum", "kabum-mcp"]);
});

test("discovers Go servers from go.mod and main.go, exposing language, runtime and binary", (t) => {
    const source = sourceTreeGo(t);
    const mcps = discoverMcps(source.root);
    assert.deepEqual(mcps.map((m) => [m.name, m.entry, m.language, m.runtime, m.serverDir, m.binary]), [
        ["kabum", "main.go", "go", "go", "mcps/kabum-mcp", "kabum-mcp"],
        ["mercadolivre", "main.go", "go", "go", "mcps/mercadolivre-mcp", "mercadolivre-mcp"],
        ["shopee", "main.go", "go", "go", "mcps/shopee-mcp", "shopee-mcp"],
    ]);
    assert.equal(mcps[0].source, source.root);
    assert.deepEqual(mcps[0].aliases, ["kabum", "kabum-mcp"]);
    assert.equal(mcps[0].browser, null);
    assert.equal(mcps[0].login, false);
});

test("discovers a Go server with its own module and keeps legacy Python alongside Go", (t) => {
    const root = temp(t);
    write(root, {
        "zoom-mcp/go.mod": "module zoom\n\ngo 1.25.0\n",
        "zoom-mcp/main.go": "package main\n",
        "netdev-mcp/requirements.txt": "mcp\n",
        "netdev-mcp/server.py": "print('netdev')\n",
    });
    const mcps = discoverMcps(root);
    assert.deepEqual(mcps.map((m) => [m.name, m.language, m.source, m.serverDir]), [
        ["netdev", "python", join(root, "netdev-mcp"), "netdev-mcp"],
        ["zoom", "go", join(root, "zoom-mcp"), "."],
    ]);
});

test("sync copies sources, removes files dropped upstream, and keeps runtime state", (t) => {
    const source = sourceTree(t);
    const [kabum] = discoverMcps(source.root);
    const dir = join(temp(t), "kabum");
    write(source.root, { "kabum-mcp/old.py": "" });
    assert.equal(syncFiles(kabum, dir, source.commit).fresh, true);
    write(dir, { "cookies.json": "{}", "data/cache.db": "x" });
    rmSync(join(source.root, "kabum-mcp/old.py"));
    write(source.root, { "kabum-mcp/server.py": "print('kabum v3')\n" });

    const second = syncFiles(kabum, dir, source.commit);
    assert.deepEqual(second.removed, ["old.py"]);
    assert.equal(second.changed, 1);
    assert.equal(readFileSync(join(dir, "server.py"), "utf8"), "print('kabum v3')\n");
    assert.ok(existsSync(join(dir, "cookies.json")));
    assert.ok(existsSync(join(dir, "data", "cache.db")));
});

test("copies only git-tracked files from a checkout and never overwrites runtime files it does not own", (t) => {
    const source = sourceTree(t);
    spawnSync("git", ["-C", source.root, "init", "-q"]);
    write(source.root, { ".gitignore": ".browser-profile/" + String.fromCharCode(10), "shopee-mcp/.browser-profile/Default/Cookies": "dev login" });
    spawnSync("git", ["-C", source.root, "add", "-A"]);
    const shopee = discoverMcps(source.root)[1];
    const dir = join(temp(t), "shopee");
    write(dir, { "shopee/api.py": "runtime copy" });

    const first = syncFiles(shopee, dir, source.commit);
    assert.ok(!existsSync(join(dir, ".browser-profile")));
    assert.deepEqual(first.kept, ["shopee/api.py"]);
    assert.equal(readFileSync(join(dir, "shopee", "api.py"), "utf8"), "runtime copy");

    write(dir, { ".browser-profile/Default/Cookies": "real login" });
    const second = syncFiles(shopee, dir, source.commit);
    assert.deepEqual(second.removed, []);
    assert.equal(readFileSync(join(dir, ".browser-profile", "Default", "Cookies"), "utf8"), "real login");
});

test("carries login state from an older install folder", (t) => {
    const source = sourceTree(t);
    const shopee = discoverMcps(source.root)[1];
    const old = temp(t);
    write(old, { "mcp_server.py": "", "cookies.json": "{}", ".browser-profile/Default/Prefs": "x", "README.md": "", ".venv/x": "" });
    const dir = join(temp(t), "shopee");
    syncFiles(shopee, dir, source.commit);
    assert.deepEqual(carryState(old, dir, shopee).sort(), [".browser-profile", "cookies.json"]);
    assert.ok(existsSync(join(dir, ".browser-profile", "Default", "Prefs")));
    assert.ok(!existsSync(join(dir, ".venv", "x")));
});

test("sync for Go hashes the module and Go sources, never reads requirements.txt", (t) => {
    const source = sourceTreeGo(t);
    const [kabum] = discoverMcps(source.root);
    const dir = join(temp(t), "kabum");
    const first = syncFiles(kabum, dir, source.commit);
    assert.equal(first.fresh, true);
    assert.equal(first.depsCurrent, false);
    for (const file of ["go.mod", "go.sum", "internal/mcpserver/server.go", "mcps/kabum-mcp/main.go", "mcps/kabum-mcp/tools.go"]) {
        assert.ok(existsSync(join(dir, ...file.split("/"))), file);
    }
    const manifest = JSON.parse(readFileSync(join(dir, ".gti-mcp.json"), "utf8"));
    assert.equal(manifest.language, "go");
    assert.equal(typeof manifest.requirements, "string");
    assert.equal(manifest.depsInstalled, null);
    assert.ok(!manifest.files.some((file) => file.endsWith("requirements.txt")));

    write(dir, { [binaryName(kabum)]: "fake binary" });
    assert.equal(syncFiles(kabum, dir, source.commit).depsCurrent, false);
    markDepsInstalled(dir);
    assert.equal(syncFiles(kabum, dir, source.commit).depsCurrent, true);

    write(source.root, { "mcps/kabum-mcp/tools.go": "package main\n// changed\n" });
    const changed = syncFiles(kabum, dir, source.commit);
    assert.equal(changed.changed, 1);
    assert.equal(changed.depsCurrent, false);
    const after = JSON.parse(readFileSync(join(dir, ".gti-mcp.json"), "utf8"));
    assert.notEqual(after.requirements, manifest.requirements);
});

test("installDeps builds a Go binary with a fake run, without pip or a venv", (t) => {
    const source = sourceTreeGo(t);
    const [kabum] = discoverMcps(source.root);
    const dir = join(temp(t), "kabum");
    syncFiles(kabum, dir, source.commit);
    const calls = [];
    const run = (command, args, options) => {
        calls.push({ command, args, options });
        if (command === "go" && args[0] === "build") write(dir, { "kabum-mcp.exe": "binary" });
        return { status: 0, stdout: "go version go1.25.0 windows/amd64\n" };
    };
    installDeps(kabum, dir, { run, platform: "win32" });
    assert.deepEqual(calls.map((c) => c.command), ["go", "go"]);
    assert.deepEqual(calls[0].args, ["version"]);
    assert.deepEqual(calls[1].args, ["build", "-o", join(dir, "kabum-mcp.exe"), "./kabum-mcp"]);
    assert.equal(calls[1].options.cwd, dir);
    assert.ok(existsSync(join(dir, "kabum-mcp.exe")));
    assert.ok(!existsSync(join(dir, ".venv")));
});

test("installDeps reports go build failures and missing Go clearly", (t) => {
    const source = sourceTreeGo(t);
    const [kabum] = discoverMcps(source.root);
    const dir = join(temp(t), "kabum");
    syncFiles(kabum, dir, source.commit);
    const failing = (command, args) => ({ status: command === "go" && args[0] === "build" ? 1 : 0, stdout: "go version go1.25.0 linux/amd64\n" });
    assert.throws(() => installDeps(kabum, dir, { run: failing }), /go build failed for kabum/);
    const missing = () => ({ status: 1 });
    assert.throws(() => installDeps(kabum, dir, { run: missing }), /Go 1\.25 or later was not found/);
});

test("checkServer probes the Go binary instead of a Python interpreter", (t) => {
    const source = sourceTreeGo(t);
    const [kabum] = discoverMcps(source.root);
    const dir = join(temp(t), "kabum");
    let probe = null;
    const run = (command, args, options) => {
        probe = { command, args, options };
        return { status: 0, stdout: `${JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } })}\n` };
    };
    assert.deepEqual(checkServer(kabum, dir, run), { ok: true });
    assert.equal(probe.command, binaryPath(dir, kabum));
    assert.deepEqual(probe.args, []);
    assert.equal(probe.options.cwd, dir);
});

test("reads and updates OpenCode mcp.servers, Claude, Cursor, and Codex entries", (t) => {
    const home = temp(t);
    write(home, {
        ".config/opencode/opencode.json": JSON.stringify({ model: "x", mcp: { servers: { kabum: { type: "local", command: ["old/python", "C:/old/kabum-mcp/mcp_server.py"], enabled: false }, cloudflare: { type: "remote", url: "u" } } } }),
        ".claude.json": JSON.stringify({ projects: {}, mcpServers: { "kabum-mcp": { type: "stdio", command: "python", args: ["/x/kabum-mcp/server.py"], env: { A: "1" } } } }),
        ".cursor/mcp.json": JSON.stringify({ mcpServers: { other: { command: "node", args: ["a.js"] } } }),
        ".codex/config.toml": "model = 'x'\n\n[mcp_servers.kabum]\ncommand = 'python'\nargs = ['C:\\old\\kabum-mcp\\server.py']\nstartup_timeout_sec = 30\n\n[other]\nkey = 1\n",
    });
    const kabum = { name: "kabum", folder: "kabum-mcp", aliases: ["kabum", "kabum-mcp"] };

    const opencode = readConfig("opencode", home);
    assert.deepEqual(matchEntries(opencode, kabum).map((e) => e.key), ["kabum"]);
    setEntry(opencode, "kabum", "/new/py", "/new/server.py");
    assert.deepEqual(opencode.data.mcp.servers.kabum, { type: "local", command: ["/new/py", "/new/server.py"], enabled: false });
    assert.equal(opencode.data.mcp.servers.cloudflare.url, "u");

    const claude = readConfig("claude", home);
    assert.deepEqual(matchEntries(claude, kabum).map((e) => e.key), ["kabum-mcp"]);
    setEntry(claude, "kabum-mcp", "/new/py", "/new/server.py");
    assert.deepEqual(claude.data.mcpServers["kabum-mcp"], { type: "stdio", command: "/new/py", args: ["/new/server.py"], env: { A: "1" } });

    assert.equal(matchEntries(readConfig("cursor", home), kabum).length, 0);

    const codex = readConfig("codex", home);
    assert.deepEqual(listEntries(codex), [{ key: "kabum", command: ["python", "C:\\old\\kabum-mcp\\server.py"] }]);
    setEntry(codex, "kabum", "C:\\new\\py.exe", "C:\\new\\server.py");
    assert.match(codex.text, /\[mcp_servers\.kabum\]\ncommand = 'C:\\new\\py\.exe'\nargs = \['C:\\new\\server\.py'\]\nstartup_timeout_sec = 30\n\n\[other\]/);
    setEntry(codex, "zoom", "/p", "/s.py");
    assert.match(codex.text, /\[mcp_servers\.zoom\]\ncommand = '\/p'\nargs = \['\/s\.py'\]\n$/);
});

test("mcps update repoints existing registrations, carries state, backs up configs, and skips MCPs that are not installed", (t) => {
    const source = sourceTree(t);
    const home = temp(t);
    const userHome = temp(t);
    const oldShopee = join(userHome, "servers", "shopee-scraper");
    write(oldShopee, { "mcp_server.py": "", "cookies.json": "{}" });
    write(userHome, {
        ".config/opencode/opencode.json": JSON.stringify({ mcp: { servers: { shopee: { type: "local", command: ["py", join(oldShopee, "mcp_server.py")] } } } }),
    });
    const installed = [];
    const { report, backups } = runMcps({ mode: "update", source, home, userHome, io: quiet, deps: (mcp) => installed.push(mcp.name) , check: ok });

    assert.deepEqual(report.map((r) => [r.name, r.status ?? r.files]), [["kabum", "not installed"], ["shopee", "installed"], ["twitter", "not installed"]]);
    assert.deepEqual(installed, ["shopee"]);
    const config = JSON.parse(readFileSync(join(userHome, ".config/opencode/opencode.json"), "utf8"));
    const dir = join(home, "mcps", "shopee");
    assert.deepEqual(config.mcp.servers.shopee.command, [venvPython(dir), join(dir, "mcp_server.py")]);
    assert.ok(existsSync(join(dir, "cookies.json")));
    assert.equal(backups.length, 1);
    assert.ok(readdirSync(join(userHome, ".config", "opencode")).some((f) => f.includes(".gti-backup-")));

    const again = runMcps({ mode: "update", source, home, userHome, io: quiet, deps: (mcp) => installed.push(mcp.name) , check: ok });
    assert.equal(again.backups.length, 0);
    assert.equal(again.report[1].registrations[0], "opencode:shopee current");
});

test("a server that fails to start keeps the agent entries on the old copy", (t) => {
    const source = sourceTree(t);
    const home = temp(t);
    const userHome = temp(t);
    const original = { mcp: { servers: { kabum: { type: "local", command: ["py", "/old/kabum-mcp/server.py"] } } } };
    write(userHome, { ".config/opencode/opencode.json": JSON.stringify(original) });
    const lines = [];
    const { report, backups } = runMcps({ mode: "update", source, home, userHome, io: { out: (l) => lines.push(l), err: () => {} }, deps: () => {}, check: () => ({ ok: false, error: "ModuleNotFoundError: No module named 'x'" }) });
    assert.equal(report[0].failed, "ModuleNotFoundError: No module named 'x'");
    assert.deepEqual(JSON.parse(readFileSync(join(userHome, ".config/opencode/opencode.json"), "utf8")), original);
    assert.equal(backups.length, 0);
    assert.ok(lines.some((l) => l.includes("FAILED to start, agent entries left unchanged")));
});

test("mcps install registers in the chosen agents and dry-run writes nothing", (t) => {
    const source = sourceTree(t);
    const home = temp(t);
    const userHome = temp(t);
    write(userHome, { ".cursor/mcp.json": "{}" });

    runMcps({ mode: "install", names: ["kabum"], agents: "cursor", source, home, userHome, dryRun: true, io: quiet, deps: () => {} });
    assert.equal(readFileSync(join(userHome, ".cursor/mcp.json"), "utf8"), "{}");
    assert.ok(!existsSync(join(home, "mcps", "kabum")));

    runMcps({ mode: "install", names: ["kabum"], agents: "cursor", source, home, userHome, io: quiet, deps: () => {}, check: ok });
    const cursor = JSON.parse(readFileSync(join(userHome, ".cursor/mcp.json"), "utf8"));
    assert.deepEqual(cursor.mcpServers.kabum.args, [join(home, "mcps", "kabum", "server.py")]);

    assert.throws(() => runMcps({ mode: "install", names: ["nope"], source, home, userHome, io: quiet }), /Unknown MCP: nope/);
    assert.throws(() => runMcps({ mode: "install", names: ["kabum"], agents: "cline", source, home, userHome, io: quiet }), /Cannot register in cline/);
});

test("mcps install registers the built Go binary and skips --skip-deps work", (t) => {
    const source = sourceTreeGo(t);
    const [kabum] = discoverMcps(source.root);
    const home = join(temp(t), "home");
    const userHome = temp(t);
    write(userHome, { ".cursor/mcp.json": "{}" });
    const built = [];
    const probes = [];

    runMcps({ mode: "install", names: ["kabum"], agents: "cursor", source, home, userHome, io: quiet, deps: (mcp, target) => {
        built.push(mcp.name);
        write(target, { [binaryName(mcp)]: "binary" });
    }, check: (mcp, target) => {
        probes.push(binaryPath(target, mcp));
        return ok();
    } });
    const cursor = JSON.parse(readFileSync(join(userHome, ".cursor/mcp.json"), "utf8"));
    assert.deepEqual(cursor.mcpServers.kabum.command, binaryPath(join(home, "mcps", "kabum"), kabum));
    assert.deepEqual(cursor.mcpServers.kabum.args, []);
    assert.deepEqual(built, ["kabum"]);
    assert.deepEqual(probes, [binaryPath(join(home, "mcps", "kabum"), kabum)]);

    const skipped = runMcps({ mode: "install", names: ["kabum"], agents: "cursor", source: sourceTreeGo(t), home: join(temp(t), "skipped"), userHome: temp(t), skipDeps: true, io: quiet, deps: () => { throw new Error("deps must be skipped"); }, check: () => { throw new Error("probe must be skipped"); } });
    assert.equal(skipped.report[0].deps, "skipped");
});

test("mcps update repoints a legacy Python entry to the built Go binary and keeps its state", (t) => {
    const source = sourceTreeGo(t);
    const [kabum] = discoverMcps(source.root);
    const home = temp(t);
    const userHome = temp(t);
    const old = join(userHome, "servers", "kabum-mcp");
    write(old, { "server.py": "", "cookies.json": "{}" });
    write(userHome, { ".config/opencode/opencode.json": JSON.stringify({ mcp: { servers: { kabum: { type: "local", command: ["py", join(old, "server.py")], enabled: false } } } }) });
    const { report } = runMcps({ mode: "update", source, home, userHome, io: quiet, deps: (mcp, dir) => write(dir, { [binaryName(mcp)]: "binary" }), check: ok });
    assert.equal(report[0].files, "installed");
    const config = JSON.parse(readFileSync(join(userHome, ".config/opencode/opencode.json"), "utf8"));
    assert.deepEqual(config.mcp.servers.kabum.command, [binaryPath(join(home, "mcps", "kabum"), kabum)]);
    assert.equal(config.mcp.servers.kabum.enabled, false);
    assert.ok(existsSync(join(home, "mcps", "kabum", "cookies.json")));
});

test("skills update asks the CLI for new skills by default and honors --no-install-new", () => {
    const calls = [];
    const run = (command, args) => {
        calls.push(args);
        return { status: 0 };
    };
    const source = { root: "C:/gti-skills", commit: "c".repeat(40) };

    skillsUpdate(source, { passthrough: [] }, quiet, run);
    assert.ok(calls[0].includes("--install-new"));

    skillsUpdate(source, { passthrough: ["--no-install-new"] }, quiet, run);
    assert.ok(!calls[1].includes("--install-new"));
    assert.ok(calls[1].includes("--no-install-new"));
});

test("downloads the latest commit into the shared sources folder with the CLI's stamp", async (t) => {
    const home = temp(t);
    const commit = "a".repeat(40);
    const header = (name, size, type) => {
        const block = Buffer.alloc(512);
        block.write(name, 0);
        block.write(size.toString(8).padStart(11, "0"), 124);
        block.write(type, 156);
        block.write("ustar", 257);
        return block;
    };
    const body = Buffer.from("console.log(1)\n");
    const tar = Buffer.concat([header("repo-abc/", 0, "5"), header("repo-abc/packages/cli/index.mjs", body.length, "0"), body, Buffer.alloc(512 - body.length), Buffer.alloc(1024)]);
    const calls = [];
    const fakeFetch = async (url) => {
        calls.push(url);
        if (url.includes("/commits/")) return new Response(commit);
        return new Response(gzipSync(tar));
    };
    const first = await ensureLatestSource({ home, fetch: fakeFetch, source: { repo: "o/r", branch: "master" } });
    assert.equal(first.downloaded, true);
    assert.equal(readFileSync(join(home, "sources", commit.slice(0, 12), "packages", "cli", "index.mjs"), "utf8"), "console.log(1)\n");
    const second = await ensureLatestSource({ home, fetch: fakeFetch, source: { repo: "o/r", branch: "master" } });
    assert.equal(second.downloaded, false);
    assert.equal(calls.filter((u) => u.includes("tarball")).length, 1);
    assert.equal(extractTarball(gzipSync(Buffer.concat([header("x/../../evil", 0, "0"), Buffer.alloc(1024)])), join(home, "unsafe")), 0);
});

test("downloads the MCP repository into its own folder, apart from the skills sources the CLI prunes", async (t) => {
    const home = temp(t);
    const commit = "b".repeat(40);
    const header = (name, size, type) => {
        const block = Buffer.alloc(512);
        block.write(name, 0);
        block.write(size.toString(8).padStart(11, "0"), 124);
        block.write(type, 156);
        block.write("ustar", 257);
        return block;
    };
    const body = Buffer.from("print(1)\n");
    const tar = Buffer.concat([header("repo-abc/", 0, "5"), header("repo-abc/kabum-mcp/server.py", body.length, "0"), body, Buffer.alloc(512 - body.length), Buffer.alloc(1024)]);
    const fakeFetch = async (url) => (url.includes("/commits/") ? new Response(commit) : new Response(gzipSync(tar)));

    const result = await ensureLatestSource({ home, fetch: fakeFetch, source: mcpsSource(), kind: McpsSources });

    assert.equal(result.root, join(home, "mcps-sources", commit.slice(0, 12)));
    assert.equal(mcpsSource().repo, "gtihq/ai-mcps");
    assert.deepEqual(discoverMcps(result.root), []);
    assert.equal(cachedSource(home, McpsSources).commit, commit);
    assert.equal(cachedSource(home), null);
});
