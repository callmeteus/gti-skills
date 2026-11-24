// Reads the Maestro ledger under ~/.gti/maestro and builds one snapshot for the central UI.
// Read only: the central never writes into the ledger.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { buildCluster } from "./cluster.mjs";

const ACTIVE = new Set(["spawned", "running"]);
const FEED_LIMIT = 120;
const REVIEW_LIMIT = 40;

/**
 * Folder that holds the Maestro ledger: MAESTRO_HOME, then GTI_HOME/maestro, then ~/.gti/maestro.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function defaultRoot(env = process.env) {
    if (env.MAESTRO_HOME) {
        return env.MAESTRO_HOME;
    }
    return join(env.GTI_HOME || join(homedir(), ".gti"), "maestro");
}

/**
 * Parses a JSON file, or returns null when it is missing or broken.
 * @param {string} file
 * @returns {any}
 */
export function readJson(file) {
    try {
        return JSON.parse(readFileSync(file, "utf8"));
    } catch {
        return null;
    }
}

/**
 * Parses a JSONL file and skips lines that are not valid JSON (a line may be half written).
 * @param {string} file
 * @param {number} [limit] Keep only the last `limit` records
 * @returns {any[]}
 */
export function readJsonl(file, limit = 1000) {
    let text;
    try {
        text = readFileSync(file, "utf8");
    } catch {
        return [];
    }
    const out = [];
    for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) {
            continue;
        }
        try {
            const value = JSON.parse(line);
            if (value && typeof value === "object") {
                out.push(value);
            }
        } catch {
            // A partial write; the next read sees the full line.
        }
    }
    return out.slice(-limit);
}

function mtime(file) {
    try {
        return statSync(file).mtime.toISOString();
    } catch {
        return null;
    }
}

/**
 * Project folders: every subfolder with a run.json or workers.jsonl. Folders that start with `_`
 * (demo, central state) and `tools` are not projects.
 * @param {string} root
 * @returns {string[]}
 */
export function listProjects(root) {
    let entries;
    try {
        entries = readdirSync(root, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && entry.name !== "tools")
        .map((entry) => entry.name)
        .filter((name) => existsSync(join(root, name, "run.json")) || existsSync(join(root, name, "workers.jsonl")))
        .sort();
}

/**
 * Wave number from a worker id such as `w2.1`, or 1.
 * @param {string} id
 * @returns {number}
 */
export function waveOf(id) {
    const match = /^w(\d+)/i.exec(String(id || ""));
    return match ? Number(match[1]) : 1;
}

/**
 * Plain status of a worker for the UI: a label and a tone.
 * @param {any} worker
 * @returns {{ label: string, tone: string }}
 */
export function describeWorker(worker) {
    const verdict = worker.verdict;
    if (ACTIVE.has(worker.status)) {
        if (worker.rounds > 0) {
            return { label: `fix round ${worker.rounds}`, tone: "amber" };
        }
        return { label: worker.status === "spawned" ? "starting" : "working", tone: "green" };
    }
    if (verdict === "PASS") {
        return { label: "passed", tone: "ink" };
    }
    if (verdict === "FIX") {
        return { label: "needs a fix", tone: "amber" };
    }
    if (verdict === "REASSIGN" || verdict === "ESCALATE") {
        return { label: verdict === "REASSIGN" ? "reassigned" : "escalated", tone: "violet" };
    }
    if (worker.status === "blocked" || worker.status === "failed") {
        return { label: worker.status, tone: "red" };
    }
    if (worker.status === "cancelled") {
        return { label: "cancelled", tone: "muted" };
    }
    if (worker.status === "done") {
        return { label: "in review", tone: "blue" };
    }
    return { label: "idle", tone: "muted" };
}

/**
 * Last record per worker id, in first-seen order.
 * @param {any[]} records
 * @returns {any[]}
 */
export function latestWorkers(records) {
    const byId = new Map();
    for (const record of records) {
        if (!record.id) {
            continue;
        }
        byId.set(record.id, { ...(byId.get(record.id) || {}), ...record });
    }
    return [...byId.values()].map((worker) => ({
        ...worker,
        wave: waveOf(worker.id),
        active: ACTIVE.has(worker.status),
        state: describeWorker(worker),
    }));
}

function auditText(event) {
    if (event.summary) {
        return String(event.summary);
    }
    const model = event.provider && event.model ? ` on ${event.provider}/${event.model}` : "";
    const result = event.result ? `: ${event.result}` : "";
    switch (event.action) {
        case "spawn":
            return `Started ${event.worker || "a worker"}${model}${event.result && event.result !== "started" ? result : ""}`;
        case "prompt":
            return `Sent the brief to ${event.worker || "a worker"}`;
        case "review":
            return `Reviewed ${event.worker || "the work"}${result}`;
        case "fix":
            return `Sent a fix round to ${event.worker || "a worker"}`;
        case "verify":
            return `Verified ${event.worker || "the run"}${result}`;
        case "report":
            return "Wrote the final report";
        default:
            return `${event.action || "event"}${event.worker ? ` ${event.worker}` : ""}${result}`;
    }
}

function feedFor(project, audit, decisions) {
    const items = [];
    audit.forEach((event, index) => {
        items.push({
            id: `${project}:a:${index}:${event.ts || ""}`,
            ts: event.ts || null,
            project,
            kind: event.action || "event",
            from: event.from || (event.action === "message" ? event.worker : "maestro"),
            to: event.to || event.worker || null,
            text: auditText(event),
            result: event.result || null,
            files: Array.isArray(event.files) ? event.files.slice(0, 4) : [],
        });
    });
    decisions.forEach((event, index) => {
        items.push({
            id: `${project}:d:${index}:${event.ts || ""}`,
            ts: event.ts || null,
            project,
            kind: "decision",
            from: "maestro",
            to: "decision",
            text: String(event.decision || ""),
            reason: event.reason ? String(event.reason) : null,
            result: null,
            files: [],
        });
    });
    return items;
}

function readProject(root, name) {
    const dir = join(root, name);
    const run = readJson(join(dir, "run.json"));
    const workers = latestWorkers(readJsonl(join(dir, "workers.jsonl"), 2000));
    const audit = readJsonl(join(dir, "audit.jsonl"), 400);
    const decisions = readJsonl(join(dir, "decisions.jsonl"), 200);
    const orchestrators = readJson(join(dir, "orchestrators.json"));
    const counts = { total: workers.length, active: 0, passed: 0, fixing: 0, failed: 0 };
    for (const worker of workers) {
        if (worker.active) {
            counts.active += 1;
        }
        if (worker.verdict === "PASS") {
            counts.passed += 1;
        } else if (worker.verdict === "FIX") {
            counts.fixing += 1;
        }
        if (worker.status === "failed" || worker.status === "blocked") {
            counts.failed += 1;
        }
    }
    const lastDecision = decisions.length ? decisions[decisions.length - 1] : null;
    return {
        name,
        updatedAt: mtime(join(dir, "run.json")) || mtime(join(dir, "workers.jsonl")),
        run: run
            ? {
                  id: run.id || null,
                  goal: run.goal || null,
                  class: run.class || null,
                  kind: run.kind || null,
                  phase: run.phase || null,
                  done: Array.isArray(run.done) ? run.done : [],
                  budget: run.budget || null,
                  harness: run.harness || null,
                  routing: run.routing || null,
                  pending: Array.isArray(run.pending) ? run.pending : [],
                  notVerified: Array.isArray(run.notVerified) ? run.notVerified : [],
              }
            : null,
        workers,
        counts,
        orchestrators: orchestrators
            ? {
                  selected: orchestrators.selected || null,
                  servers: (orchestrators.servers || []).map((server) => ({
                      name: server.name,
                      role: server.role,
                      status: server.status,
                  })),
              }
            : null,
        lastDecision,
        feed: feedFor(name, audit, decisions),
    };
}

function readProviders(root) {
    const catalog = readJson(join(root, "providers.json"));
    const rows = [];
    for (const [provider, entry] of Object.entries(catalog?.providers || {})) {
        for (const model of entry?.models || []) {
            rows.push({
                provider,
                model: model.id,
                health: model.health || "unknown",
                cooldownUntil: model.cooldownUntil || null,
                cost: model.cost || "unknown",
                speed: model.speed || "unknown",
            });
        }
    }
    return rows;
}

function normalizePreferences(file, scope) {
    const prefs = readJson(file);
    if (!prefs) {
        return null;
    }
    return {
        scope,
        file,
        updated: prefs.updated || null,
        roles: prefs.roles || {},
        defaults: prefs.defaults || {},
        profiles: Object.entries(prefs.profiles || {}).map(([kind, profile]) => ({
            kind,
            orchestrator: profile?.orchestrator || null,
            executor: profile?.executor || null,
            adapter: profile?.adapter || null,
            tier: profile?.tier || null,
            skills: Array.isArray(profile?.skills) ? profile.skills : [],
            match: Array.isArray(profile?.match) ? profile.match : [],
            source: profile?.source || null,
            lastRun: profile?.lastRun || null,
        })),
        fallbacks: Array.isArray(prefs.fallbacks) ? prefs.fallbacks : [],
        routes: Array.isArray(prefs.routes) ? prefs.routes : [],
        avoid: Array.isArray(prefs.avoid) ? prefs.avoid : [],
    };
}

function readPreferences(root, projects) {
    const user = normalizePreferences(join(root, "preferences.json"), "user");
    const perProject = projects
        .map((name) => normalizePreferences(join(root, name, "preferences.json"), name))
        .filter(Boolean);
    return user || perProject.length ? { user, projects: perProject } : null;
}

function sameDay(ts, now) {
    if (!ts) {
        return false;
    }
    const date = new Date(ts);
    return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    );
}

/**
 * Builds the full snapshot the UI renders.
 * @param {string} root Maestro ledger folder
 * @param {Date} [now]
 * @returns {object}
 */
export function buildSnapshot(root, now = new Date()) {
    const projects = listProjects(root).map((name) => readProject(root, name));
    // Fills worker.host, so it runs before the projects are copied into the snapshot.
    const cluster = buildCluster(root, projects);
    const feed = projects
        .flatMap((project) => project.feed)
        .sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));
    const reviews = feed.filter((item) => item.kind === "review" || item.kind === "verify").slice(0, REVIEW_LIMIT);
    const orchestrators = new Set();
    for (const project of projects) {
        for (const worker of project.workers) {
            if (worker.active) {
                orchestrators.add(worker.orchestrator || worker.adapter || "native");
            }
        }
        if (project.orchestrators?.selected?.spawner) {
            orchestrators.add(project.orchestrators.selected.spawner);
        }
    }
    const history = readJsonl(join(root, "history.jsonl"), 50).reverse();
    const totals = {
        projects: projects.length,
        runsActive: projects.filter((project) => project.run && !["done", "blocked"].includes(project.run.phase)).length,
        runsSoFar: Math.max(history.length, projects.filter((project) => project.run).length),
        workersTotal: projects.reduce((sum, project) => sum + project.counts.total, 0),
        hosts: cluster.hosts.length,
        hostsOnline: cluster.hosts.filter((host) => host.status === "online").length,
        workersActive: projects.reduce((sum, project) => sum + project.counts.active, 0),
        orchestrators: orchestrators.size,
        eventsToday: feed.filter((item) => sameDay(item.ts, now)).length,
    };
    const body = {
        root,
        home: homedir(),
        totals,
        projects: projects.map(({ feed: _feed, ...rest }) => rest),
        cluster,
        feed: feed.slice(0, FEED_LIMIT),
        reviews,
        providers: readProviders(root),
        preferences: readPreferences(root, projects.map((project) => project.name)),
        history: history.slice(0, 20),
    };
    const version = createHash("sha1").update(JSON.stringify(body)).digest("hex").slice(0, 12);
    return { version, generatedAt: now.toISOString(), ...body };
}
