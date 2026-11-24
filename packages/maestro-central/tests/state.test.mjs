import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildSnapshot, defaultRoot, listProjects, readJsonl, latestWorkers } from "../central/server/state.mjs";

function ledger() {
    const root = mkdtempSync(join(tmpdir(), "maestro-central-"));
    const dir = join(root, "shop");
    mkdirSync(dir);
    writeFileSync(join(dir, "run.json"), JSON.stringify({ id: "run-1", goal: "Add CSV export", kind: "feature", phase: "review" }));
    writeFileSync(
        join(dir, "workers.jsonl"),
        [
            { id: "w1.1", task: "Map routes", status: "spawned" },
            { id: "w2.1", task: "Build route", status: "running", rounds: 0 },
            { id: "w1.1", status: "done", verdict: "PASS" },
        ]
            .map((line) => JSON.stringify(line))
            .join("\n") + "\n{broken",
    );
    writeFileSync(
        join(dir, "audit.jsonl"),
        [
            { ts: "2026-11-23T10:00:00Z", action: "spawn", worker: "w1.1", provider: "opencode", model: "flash", result: "started" },
            { ts: "2026-11-23T10:05:00Z", action: "review", worker: "w1.1", result: "PASS" },
        ]
            .map((line) => JSON.stringify(line))
            .join("\n"),
    );
    writeFileSync(join(dir, "decisions.jsonl"), JSON.stringify({ ts: "2026-11-23T10:06:00Z", decision: "Keep the route small", reason: "One file" }));
    mkdirSync(join(root, "_demo", "other"), { recursive: true });
    writeFileSync(join(root, "_demo", "other", "run.json"), "{}");
    mkdirSync(join(root, "tools"));
    return root;
}

test("the ledger root follows MAESTRO_HOME, then GTI_HOME", () => {
    assert.equal(defaultRoot({ MAESTRO_HOME: "/m" }), "/m");
    assert.equal(defaultRoot({ GTI_HOME: "/g" }), join("/g", "maestro"));
});

test("projects skip underscore folders, tools, and folders with no ledger", () => {
    const root = ledger();
    mkdirSync(join(root, "empty"));
    assert.deepEqual(listProjects(root), ["shop"]);
    rmSync(root, { recursive: true, force: true });
});

test("a half-written JSONL line is skipped, not fatal", () => {
    const root = ledger();
    assert.equal(readJsonl(join(root, "shop", "workers.jsonl")).length, 3);
    rmSync(root, { recursive: true, force: true });
});

test("the last record of each worker wins and keeps the earlier fields", () => {
    const workers = latestWorkers([
        { id: "w1.1", task: "Map routes", status: "spawned" },
        { id: "w1.1", status: "done", verdict: "PASS" },
    ]);
    assert.equal(workers.length, 1);
    assert.equal(workers[0].task, "Map routes");
    assert.equal(workers[0].state.label, "passed");
    assert.equal(workers[0].active, false);
});

test("the snapshot counts active workers and orders the feed newest first", () => {
    const root = ledger();
    const snapshot = buildSnapshot(root, new Date("2026-11-23T12:00:00Z"));
    assert.equal(snapshot.totals.projects, 1);
    assert.equal(snapshot.totals.workersActive, 1);
    assert.equal(snapshot.projects[0].counts.passed, 1);
    assert.equal(snapshot.projects[0].workers.find((w) => w.id === "w2.1").wave, 2);
    assert.deepEqual(
        snapshot.feed.map((item) => item.kind),
        ["decision", "review", "spawn"],
    );
    assert.equal(snapshot.feed[2].text, "Started w1.1 on opencode/flash");
    assert.equal(snapshot.reviews.length, 1);
    rmSync(root, { recursive: true, force: true });
});

test("settings come from the machine and from each project, with their file", () => {
    const root = ledger();
    writeFileSync(
        join(root, "preferences.json"),
        JSON.stringify({ roles: { executor: { provider: "opencode", model: "flash" } }, profiles: { security: { adapter: "paseo-cli", source: "run" } } }),
    );
    writeFileSync(join(root, "shop", "preferences.json"), JSON.stringify({ defaults: { adapter: "claude-cli" } }));
    const { preferences } = buildSnapshot(root);
    assert.equal(preferences.user.file, join(root, "preferences.json"));
    assert.equal(preferences.user.profiles[0].kind, "security");
    assert.equal(preferences.user.profiles[0].adapter, "paseo-cli");
    assert.deepEqual(preferences.projects.map((item) => [item.scope, item.defaults.adapter]), [["shop", "claude-cli"]]);
    rmSync(root, { recursive: true, force: true });
});

test("the version changes only when the ledger changes", () => {
    const root = ledger();
    const now = new Date("2026-11-23T12:00:00Z");
    const a = buildSnapshot(root, now);
    assert.equal(buildSnapshot(root, now).version, a.version);
    writeFileSync(join(root, "shop", "decisions.jsonl"), JSON.stringify({ ts: "2026-11-23T11:00:00Z", decision: "Ship it" }));
    assert.notEqual(buildSnapshot(root, now).version, a.version);
    rmSync(root, { recursive: true, force: true });
});
