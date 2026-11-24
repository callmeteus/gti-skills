// The cluster: every machine Maestro can run workers on. The registry is ~/.gti/maestro/hosts.json,
// written by Maestro from Paseo connected hosts or OpenCode servers; worker records name their host.
// This machine is always in the cluster, even when the registry is missing.

import { readFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";

const SELF_ID = "local";

function readRegistry(file) {
    try {
        return JSON.parse(readFileSync(file, "utf8"));
    } catch {
        return null;
    }
}

function cleanAddress(address) {
    if (!address) {
        return null;
    }
    // Never show credentials, even if a registry was written with them.
    return String(address)
        .replace(/\/\/([^/:@]*):[^/@]*@/, "//$1@")
        .replace(/([?&])(password|token|key)=[^&]*/gi, "$1$2=***");
}

function normalizeHost(raw, selfName) {
    const self = Boolean(raw.self);
    return {
        id: String(raw.id || (self ? SELF_ID : raw.label || "unknown")),
        label: String(raw.label || (self ? selfName : raw.id || "unknown")),
        self,
        via: raw.via || (self ? "local" : null),
        address: cleanAddress(raw.address),
        status: raw.status || (self ? "online" : "unknown"),
        lastSeen: raw.lastSeen || null,
        providers: Array.isArray(raw.providers) ? raw.providers.map(String) : [],
        meta: raw.meta && typeof raw.meta === "object" ? raw.meta : {},
    };
}

/**
 * Builds the cluster from the registry and the worker records, and tags every worker with its host id.
 * A worker without a host runs on this machine; a host named by a worker but missing from the registry
 * is added with status unknown.
 * @param {string} root Maestro ledger folder
 * @param {{ name: string, workers: any[] }[]} projects Projects with their latest workers (mutated: worker.host is filled)
 * @returns {{ hosts: any[], multi: boolean, updated: string | null }}
 */
export function buildCluster(root, projects) {
    const registry = readRegistry(join(root, "hosts.json"));
    const selfName = hostname();
    const hosts = (Array.isArray(registry?.hosts) ? registry.hosts : []).map((raw) => normalizeHost(raw, selfName));
    let self = hosts.find((host) => host.self);
    if (!self) {
        self = normalizeHost({ self: true }, selfName);
        hosts.unshift(self);
    }
    const byId = new Map(hosts.map((host) => [host.id, host]));
    const byLabel = new Map(hosts.map((host) => [host.label, host]));
    const stats = new Map(hosts.map((host) => [host.id, { active: 0, total: 0, projects: new Set() }]));

    for (const project of projects) {
        for (const worker of project.workers) {
            const named = worker.host ? String(worker.host) : null;
            let host = named ? byId.get(named) || byLabel.get(named) : self;
            if (!host) {
                host = normalizeHost({ id: named, label: named, status: "unknown" }, selfName);
                hosts.push(host);
                byId.set(host.id, host);
                stats.set(host.id, { active: 0, total: 0, projects: new Set() });
            }
            worker.host = host.id;
            const entry = stats.get(host.id);
            entry.total += 1;
            entry.active += worker.active ? 1 : 0;
            entry.projects.add(project.name);
        }
    }

    return {
        updated: registry?.updated || null,
        multi: hosts.length > 1,
        hosts: hosts.map((host) => {
            const entry = stats.get(host.id);
            return { ...host, workersActive: entry.active, workersTotal: entry.total, projects: [...entry.projects].sort() };
        }),
    };
}
