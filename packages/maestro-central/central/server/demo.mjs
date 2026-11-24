// Demo ledger: three sample runs, plus a simulator that appends events so the central moves in real time.
// Writes only under <maestro root>/_demo, never into a real project ledger.

import { mkdirSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const PROJECTS = [
    {
        name: "reports-app",
        run: { kind: "feature", class: "complex", goal: "Add CSV export to the reports page", phase: "review" },
        adapter: "paseo-mcp",
        workers: [
            ["w1.1", "Map the reports routes and tests", "scout", "T1", "opencode", "deepseek-v4.1-flash-free", "gpu-rig"],
            ["w1.2", "List the export formats in use", "scout", "T1", "opencode", "deepseek-v4.1-flash-free", "gpu-rig"],
            ["w2.1", "Add the CSV serializer and route", "build", "T2", "opencode", "deepseek-v4.1-flash"],
            ["w2.2", "Add the download action to the page", "build", "T2", "codex", "gpt-5.5", "build-box"],
            ["w3.1", "Verify the full suite and the page", "verify", "T3", "claude", "claude-opus-5.5"],
        ],
    },
    {
        name: "billing-api",
        run: { kind: "security", class: "complex", goal: "Audit the billing API for broken access control", phase: "delegate" },
        adapter: "paseo-cli",
        workers: [
            ["w1.1", "Inventory every billing route and its guard", "scout", "T1", "opencode", "deepseek-v4.1-flash-free"],
            ["w2.1", "Check invoice reads for IDOR", "build", "T3", "codex", "gpt-5.5", "build-box"],
            ["w2.2", "Check refund and coupon logic", "build", "T3", "claude", "claude-opus-5.5"],
            ["w2.3", "Check webhook signature handling", "build", "T2", "kilo", "kimi-k3", "gpu-rig"],
        ],
    },
    {
        name: "landing",
        run: { kind: "frontend", class: "simple", goal: "Fix the hero layout at 390 px", phase: "delegate" },
        adapter: "claude-cli",
        workers: [["w1.1", "Fix the hero overflow on small screens", "build", "T2", "claude", "claude-sonnet-5.5"]],
    },
];

const LINES = [
    "Brief sent: own src/reports, return the diff and the test output.",
    "Found 4 routes without a role check; listing them with file and line.",
    "Self-review done: tests pass, no public surface changed.",
    "Evidence attached: npm test -- reports, 38 passed.",
    "The serializer escapes quotes and commas; added two edge-case tests.",
    "Rate limit on the primary model, moved to the free tier of the same family.",
    "Diff touches only the files in scope. Asking for the failing case first.",
    "Verified independently: git diff matches the claim, suite is green.",
];

function now(offsetSeconds = 0) {
    return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

function workerRecord(project, row, status, verdict, rounds) {
    const [id, task, type, tier, provider, model, host] = row;
    return {
        id,
        task,
        type,
        tier,
        provider,
        model,
        adapter: project.adapter,
        orchestrator: project.adapter.startsWith("paseo") ? "paseo" : null,
        chat: `agent_${project.name.slice(0, 3)}_${id.replace(".", "")}`,
        resumable: true,
        status,
        verdict,
        rounds,
        routing: `${tier} ${type}; healthy; fits the task profile`,
        ...(host ? { host } : {}),
    };
}

/**
 * Writes the demo ledger. Returns the demo root.
 * @param {string} maestroRoot
 * @returns {string}
 */
export function writeDemo(maestroRoot) {
    const root = join(maestroRoot, "_demo");
    rmSync(root, { recursive: true, force: true });
    PROJECTS.forEach((project, p) => {
        const dir = join(root, project.name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            join(dir, "run.json"),
            JSON.stringify(
                {
                    id: `run-2026-11-23-00${p + 1}`,
                    ...project.run,
                    done: ["The change is verified by an independent worker", "The project checks pass"],
                    budget: { workersMax: 12, fixRoundsMax: 2, wavesMax: 6, tokenCap: null },
                    harness: { name: project.adapter.split("-")[0], adapter: project.adapter, resumable: true },
                    pending: p === 1 ? ["Push the branch (outward, needs approval)"] : [],
                    notVerified: [],
                },
                null,
                2,
            ),
        );
        const lines = [];
        const audit = [];
        project.workers.forEach((row, w) => {
            const finished = w < project.workers.length - 2;
            lines.push(workerRecord(project, row, "spawned", null, 0));
            audit.push({ ts: now(-900 + w * 60), action: "spawn", worker: row[0], provider: row[4], model: row[5], result: "started" });
            if (finished) {
                lines.push(workerRecord(project, row, "done", "PASS", w % 2));
                audit.push({ ts: now(-600 + w * 50), action: "review", worker: row[0], result: "PASS", summary: LINES[(w + p) % LINES.length] });
            } else {
                lines.push(workerRecord(project, row, "running", null, 0));
                audit.push({ ts: now(-300 + w * 40), action: "prompt", worker: row[0], summary: LINES[(w + p + 3) % LINES.length] });
            }
        });
        writeFileSync(join(dir, "workers.jsonl"), lines.map((line) => JSON.stringify(line)).join("\n") + "\n");
        writeFileSync(join(dir, "audit.jsonl"), audit.map((line) => JSON.stringify(line)).join("\n") + "\n");
        writeFileSync(
            join(dir, "decisions.jsonl"),
            JSON.stringify({ ts: now(-1000), decision: `Run kind ${project.run.kind}, ${project.run.class} run`, reason: "Detected from the request and the stored profiles" }) + "\n",
        );
    });
    writeFileSync(
        join(root, "providers.json"),
        JSON.stringify({
            version: 1,
            providers: {
                opencode: { models: [{ id: "deepseek-v4.1-flash", health: "healthy", cost: "low", speed: "fast" }, { id: "deepseek-v4.1-flash-free", health: "cooling", cooldownUntil: now(240), cost: "free", speed: "fast" }] },
                codex: { models: [{ id: "gpt-5.5", health: "healthy", cost: "medium", speed: "medium" }] },
                claude: { models: [{ id: "claude-opus-5.5", health: "healthy", cost: "high", speed: "medium" }, { id: "claude-sonnet-5.5", health: "healthy", cost: "medium", speed: "fast" }] },
                kilo: { models: [{ id: "kimi-k3", health: "unknown", cost: "low", speed: "fast" }] },
            },
        }),
    );
    writeFileSync(
        join(root, "hosts.json"),
        JSON.stringify({
            version: 1,
            updated: now(-120),
            hosts: [
                { id: "local", label: "studio-desktop", self: true, via: "local", status: "online", lastSeen: now(), providers: ["claude", "codex", "opencode"] },
                { id: "build-box", label: "build-box", via: "paseo", address: "ssh://deploy@build-box", status: "online", lastSeen: now(-20), providers: ["codex", "claude"], meta: { team: "infra" } },
                { id: "gpu-rig", label: "gpu-rig", via: "opencode", address: "http://10.0.0.42:4096", status: "online", lastSeen: now(-8), providers: ["opencode", "kilo"] },
                { id: "old-laptop", label: "old-laptop", via: "paseo", address: "ws://192.168.0.31:6767", status: "offline", lastSeen: now(-7200), providers: ["claude"] },
            ],
        }),
    );
    writeFileSync(
        join(root, "preferences.json"),
        JSON.stringify({
            version: 2,
            roles: { orchestrator: { provider: "claude", model: "claude-opus-5.5" }, executor: { provider: "opencode", model: "deepseek-v4.1-flash" } },
            defaults: { adapter: "paseo-mcp", source: "user" },
            profiles: { security: { executor: { provider: "codex", model: "gpt-5.5" }, adapter: "paseo-cli", source: "run" } },
        }),
    );
    writeFileSync(
        join(root, "history.jsonl"),
        Array.from({ length: 14 }, (_, i) => JSON.stringify({ ts: now(-86400 * (i + 1)), project: PROJECTS[i % 3].name, kind: PROJECTS[i % 3].run.kind })).join("\n") + "\n",
    );
    return root;
}

/**
 * Appends one event every `everyMs` so the central has something to show. Returns a stop function.
 * @param {string} demoRoot
 * @param {number} [everyMs]
 * @returns {() => void}
 */
export function simulate(demoRoot, everyMs = 2500) {
    let tick = 0;
    const state = PROJECTS.map((project) => project.workers.map((_, w) => (w < project.workers.length - 2 ? "done" : "running")));
    const timer = setInterval(() => {
        tick += 1;
        const p = tick % PROJECTS.length;
        const project = PROJECTS[p];
        const dir = join(demoRoot, project.name);
        const w = tick % project.workers.length;
        const row = project.workers[w];
        const current = state[p][w];
        let record;
        let event;
        if (current === "running") {
            const pass = tick % 3 !== 0;
            state[p][w] = pass ? "done" : "fixing";
            record = workerRecord(project, row, pass ? "done" : "running", pass ? "PASS" : "FIX", pass ? 0 : 1);
            event = { ts: now(), action: "review", worker: row[0], result: pass ? "PASS" : "FIX", summary: LINES[tick % LINES.length] };
        } else if (current === "fixing") {
            state[p][w] = "running";
            record = workerRecord(project, row, "running", null, 1);
            event = { ts: now(), action: "fix", worker: row[0], summary: "Fix round 1: add the failing case as a test, then fix it." };
        } else {
            state[p][w] = "running";
            record = workerRecord(project, row, "spawned", null, 0);
            event = { ts: now(), action: "spawn", worker: row[0], provider: row[4], model: row[5], result: "started" };
        }
        appendFileSync(join(dir, "workers.jsonl"), JSON.stringify(record) + "\n");
        appendFileSync(join(dir, "audit.jsonl"), JSON.stringify(event) + "\n");
        if (tick % 7 === 0) {
            appendFileSync(join(dir, "decisions.jsonl"), JSON.stringify({ ts: now(), decision: `Keep ${row[0]} on ${row[4]}/${row[5]}`, reason: "Healthy, and the last review passed" }) + "\n");
        }
    }, everyMs);
    return () => clearInterval(timer);
}
