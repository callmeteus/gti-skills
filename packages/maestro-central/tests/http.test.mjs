import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { request } from "node:http";
import { startCentral } from "../central/server/http.mjs";

const TOKEN = "t0k3n-for-tests";

function ledger() {
    const root = mkdtempSync(join(tmpdir(), "maestro-central-http-"));
    mkdirSync(join(root, "shop"));
    writeFileSync(join(root, "shop", "run.json"), JSON.stringify({ id: "run-1", goal: "Add CSV export", phase: "delegate" }));
    writeFileSync(join(root, "shop", "workers.jsonl"), JSON.stringify({ id: "w1.1", task: "Map routes", status: "running" }) + "\n");
    return root;
}

function get(port, path, host = `127.0.0.1:${port}`) {
    return new Promise((resolve, reject) => {
        const req = request({ host: "127.0.0.1", port, path, headers: { host } }, (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => resolve({ status: res.statusCode, type: res.headers["content-type"], body }));
        });
        req.on("error", reject);
        req.end();
    });
}

test("the API needs the token and a local Host header", async () => {
    const root = ledger();
    const central = await startCentral({ root, token: TOKEN, port: 0 });
    try {
        assert.equal((await get(central.port, "/api/state")).status, 401);
        assert.equal((await get(central.port, `/api/state?token=${TOKEN}`, "evil.example:80")).status, 403);
        const ok = await get(central.port, `/api/state?token=${TOKEN}`);
        assert.equal(ok.status, 200);
        assert.equal(JSON.parse(ok.body).projects[0].name, "shop");
    } finally {
        await central.close();
        rmSync(root, { recursive: true, force: true });
    }
});

test("pages and assets are served without the token, and paths cannot leave the public folder", async () => {
    const root = ledger();
    const central = await startCentral({ root, token: TOKEN, port: 0 });
    try {
        for (const path of ["/", "/live", "/map", "/settings", "/icon.svg"]) {
            const page = await get(central.port, path);
            assert.equal(page.status, 200);
            assert.match(page.type, path === "/icon.svg" ? /svg/ : /text\/html/);
        }
        assert.match((await get(central.port, "/js/app.mjs")).type, /javascript/);
        assert.equal((await get(central.port, "/../server/http.mjs")).status, 404);
        assert.equal((await get(central.port, "/%2e%2e/server/http.mjs")).status, 404);
    } finally {
        await central.close();
        rmSync(root, { recursive: true, force: true });
    }
});

test("a ledger append reaches an open event stream in real time", async () => {
    const root = ledger();
    const central = await startCentral({ root, token: TOKEN, port: 0, pollMs: 100 });
    try {
        const frames = await new Promise((resolve, reject) => {
            const seen = [];
            const req = request({ host: "127.0.0.1", port: central.port, path: `/api/events?token=${TOKEN}`, headers: { host: `127.0.0.1:${central.port}` } }, (res) => {
                let buffer = "";
                res.on("data", (chunk) => {
                    buffer += chunk;
                    let index;
                    while ((index = buffer.indexOf("\n\n")) !== -1) {
                        const frame = buffer.slice(0, index);
                        buffer = buffer.slice(index + 2);
                        const data = frame.split("\n").find((line) => line.startsWith("data: "));
                        if (!data) {
                            continue;
                        }
                        seen.push(JSON.parse(data.slice(6)));
                        if (seen.length === 1) {
                            appendFileSync(join(root, "shop", "workers.jsonl"), JSON.stringify({ id: "w1.1", status: "done", verdict: "PASS" }) + "\n");
                        } else {
                            req.destroy();
                            resolve(seen);
                        }
                    }
                });
            });
            req.on("error", (error) => (error.code === "ECONNRESET" ? null : reject(error)));
            req.end();
            setTimeout(() => reject(new Error("no update within 4 s")), 4000).unref();
        });
        assert.equal(frames[0].totals.workersActive, 1);
        assert.equal(frames[1].totals.workersActive, 0);
        assert.equal(frames[1].projects[0].counts.passed, 1);
    } finally {
        await central.close();
        rmSync(root, { recursive: true, force: true });
    }
});
