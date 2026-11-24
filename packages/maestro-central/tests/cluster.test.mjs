import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, hostname } from "node:os";
import { buildSnapshot } from "../central/server/state.mjs";

function ledger(hosts) {
    const root = mkdtempSync(join(tmpdir(), "maestro-cluster-"));
    mkdirSync(join(root, "shop"));
    writeFileSync(join(root, "shop", "run.json"), JSON.stringify({ id: "run-1", phase: "delegate" }));
    writeFileSync(
        join(root, "shop", "workers.jsonl"),
        [
            { id: "w1.1", status: "running" },
            { id: "w2.1", status: "running", host: "srv_build" },
            { id: "w2.2", status: "done", verdict: "PASS", host: "mystery-box" },
        ]
            .map((line) => JSON.stringify(line))
            .join("\n"),
    );
    if (hosts) {
        writeFileSync(join(root, "hosts.json"), JSON.stringify({ updated: "2026-11-23T10:00:00Z", hosts }));
    }
    return root;
}

test("without a registry the cluster is this machine, and every worker runs here", () => {
    const root = ledger(null);
    writeFileSync(join(root, "shop", "workers.jsonl"), JSON.stringify({ id: "w1.1", status: "running" }));
    const { cluster, projects } = buildSnapshot(root);
    assert.equal(cluster.multi, false);
    assert.equal(cluster.hosts[0].self, true);
    assert.equal(cluster.hosts[0].label, hostname());
    assert.equal(projects[0].workers[0].host, cluster.hosts[0].id);
    rmSync(root, { recursive: true, force: true });
});

test("workers are counted per machine, and an unknown machine joins with status unknown", () => {
    const root = ledger([
        { id: "local", label: "desk", self: true },
        { id: "srv_build", label: "build-box", via: "paseo", status: "online" },
    ]);
    const { cluster, totals } = buildSnapshot(root);
    const byId = Object.fromEntries(cluster.hosts.map((host) => [host.id, host]));
    assert.equal(cluster.multi, true);
    assert.equal(byId.local.workersActive, 1);
    assert.equal(byId.srv_build.workersActive, 1);
    assert.deepEqual(byId.srv_build.projects, ["shop"]);
    assert.equal(byId["mystery-box"].status, "unknown");
    assert.equal(byId["mystery-box"].workersTotal, 1);
    assert.equal(totals.hosts, 3);
    rmSync(root, { recursive: true, force: true });
});

test("addresses never carry credentials into the snapshot", () => {
    const root = ledger([
        { id: "a", label: "a", address: "ssh://deploy:hunter2@build-box?daemonPort=6767&password=hunter2" },
        { id: "b", label: "b", address: "wss://box.example/ws?token=abc123" },
    ]);
    const text = JSON.stringify(buildSnapshot(root).cluster);
    assert.doesNotMatch(text, /hunter2|abc123/);
    rmSync(root, { recursive: true, force: true });
});

test("the user name stays in an address; only the password goes", () => {
    const root = ledger([{ id: "a", label: "a", address: "ssh://deploy:hunter2@build-box" }]);
    const host = buildSnapshot(root).cluster.hosts.find((item) => item.id === "a");
    assert.equal(host.address, "ssh://deploy@build-box");
    rmSync(root, { recursive: true, force: true });
});
