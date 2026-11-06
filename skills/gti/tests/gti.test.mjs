import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";

import { listEntries, matchEntries, readConfig, setEntry } from "../scripts/core/agents.mjs";
import { carryState, discoverMcps, syncFiles, venvPython } from "../scripts/core/mcps.mjs";
import { ensureLatestSource, extractTarball } from "../scripts/core/source.mjs";
import { runMcps } from "../scripts/gti.mjs";

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
        "packages/cli/index.mjs": "",
        "mcps/kabum-mcp/server.py": "print('kabum v2')\n",
        "mcps/kabum-mcp/requirements.txt": "mcp\nhttpx\n",
        "mcps/shopee-mcp/mcp_server.py": "print('shopee')\n",
        "mcps/shopee-mcp/login.py": "",
        "mcps/shopee-mcp/requirements.txt": "mcp\npatchright\n",
        "mcps/shopee-mcp/shopee/api.py": "",
        "packages/python/twitter-mcp/server.py": "",
        "packages/python/twitter-mcp/requirements.txt": "mcp\nplaywright\n",
        "packages/python/shared/requirements.txt": "",
        ...extra,
    });
    return { root, commit: "c".repeat(40) };
}

const quiet = { out: () => {}, err: () => {} };

test("discovers MCP servers with their entry script, aliases, browser, and login", (t) => {
    const mcps = discoverMcps(sourceTree(t).root);
    assert.deepEqual(mcps.map((m) => [m.name, m.entry, m.browser, m.login]), [
        ["kabum", "server.py", null, false],
        ["shopee", "mcp_server.py", "patchright", true],
        ["twitter", "server.py", "playwright", false],
    ]);
    assert.deepEqual(mcps[0].aliases, ["kabum", "kabum-mcp"]);
});

test("sync copies sources, removes files dropped upstream, and keeps runtime state", (t) => {
    const source = sourceTree(t);
    const [kabum] = discoverMcps(source.root);
    const dir = join(temp(t), "kabum");
    write(source.root, { "mcps/kabum-mcp/old.py": "" });
    assert.equal(syncFiles(kabum, dir, source.commit).fresh, true);
    write(dir, { "cookies.json": "{}", "data/cache.db": "x" });
    rmSync(join(source.root, "mcps/kabum-mcp/old.py"));
    write(source.root, { "mcps/kabum-mcp/server.py": "print('kabum v3')\n" });

    const second = syncFiles(kabum, dir, source.commit);
    assert.deepEqual(second.removed, ["old.py"]);
    assert.equal(second.changed, 1);
    assert.equal(readFileSync(join(dir, "server.py"), "utf8"), "print('kabum v3')\n");
    assert.ok(existsSync(join(dir, "cookies.json")));
    assert.ok(existsSync(join(dir, "data", "cache.db")));
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
    const { report, backups } = runMcps({ mode: "update", source, home, userHome, io: quiet, deps: (mcp) => installed.push(mcp.name) });

    assert.deepEqual(report.map((r) => [r.name, r.status ?? r.files]), [["kabum", "not installed"], ["shopee", "installed"], ["twitter", "not installed"]]);
    assert.deepEqual(installed, ["shopee"]);
    const config = JSON.parse(readFileSync(join(userHome, ".config/opencode/opencode.json"), "utf8"));
    const dir = join(home, "mcps", "shopee");
    assert.deepEqual(config.mcp.servers.shopee.command, [venvPython(dir), join(dir, "mcp_server.py")]);
    assert.ok(existsSync(join(dir, "cookies.json")));
    assert.equal(backups.length, 1);
    assert.ok(readdirSync(join(userHome, ".config", "opencode")).some((f) => f.includes(".gti-backup-")));

    const again = runMcps({ mode: "update", source, home, userHome, io: quiet, deps: (mcp) => installed.push(mcp.name) });
    assert.equal(again.backups.length, 0);
    assert.equal(again.report[1].registrations[0], "opencode:shopee current");
});

test("mcps install registers in the chosen agents and dry-run writes nothing", (t) => {
    const source = sourceTree(t);
    const home = temp(t);
    const userHome = temp(t);
    write(userHome, { ".cursor/mcp.json": "{}" });

    runMcps({ mode: "install", names: ["kabum"], agents: "cursor", source, home, userHome, dryRun: true, io: quiet, deps: () => {} });
    assert.equal(readFileSync(join(userHome, ".cursor/mcp.json"), "utf8"), "{}");
    assert.ok(!existsSync(join(home, "mcps", "kabum")));

    runMcps({ mode: "install", names: ["kabum"], agents: "cursor", source, home, userHome, io: quiet, deps: () => {} });
    const cursor = JSON.parse(readFileSync(join(userHome, ".cursor/mcp.json"), "utf8"));
    assert.deepEqual(cursor.mcpServers.kabum.args, [join(home, "mcps", "kabum", "server.py")]);

    assert.throws(() => runMcps({ mode: "install", names: ["nope"], source, home, userHome, io: quiet }), /Unknown MCP: nope/);
    assert.throws(() => runMcps({ mode: "install", names: ["kabum"], agents: "cline", source, home, userHome, io: quiet }), /Cannot register in cline/);
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
