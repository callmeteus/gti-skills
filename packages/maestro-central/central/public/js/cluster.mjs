// The cluster: machines that run Maestro workers. A host bar filters Fleet and Map by machine,
// and the Cluster tab shows each machine with its status, providers, and the workers on it.

import { esc, num, agoTag, shortPath, modelLabel } from "./format.mjs";

const STATUS_TONE = { online: "green", offline: "red", disabled: "muted", unknown: "muted" };

/**
 * Small server glyph, drawn in currentColor.
 */
export const HOST_MARK = `<svg class="host-mark" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="2" y="2.5" width="12" height="4.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="2" y="9" width="12" height="4.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="4.8" cy="4.75" r="0.9" fill="currentColor"/><circle cx="4.8" cy="11.25" r="0.9" fill="currentColor"/></svg>`;

/**
 * The host record for an id, or null.
 * @param {any} snapshot
 * @param {string} id
 * @returns {any}
 */
export function hostById(snapshot, id) {
    return snapshot?.cluster?.hosts.find((host) => host.id === id) || null;
}

/**
 * Copy of the snapshot with only the workers on one host, and the feed narrowed to them.
 * Decisions stay, because they belong to the run, not to a machine.
 * @param {any} snapshot
 * @param {string | null} hostId
 * @returns {any}
 */
export function filterByHost(snapshot, hostId) {
    if (!hostId || !hostById(snapshot, hostId)) {
        return snapshot;
    }
    const keep = new Set();
    const projects = snapshot.projects
        .map((project) => {
            const workers = project.workers.filter((worker) => worker.host === hostId);
            workers.forEach((worker) => keep.add(`${project.name}:${worker.id}`));
            const counts = {
                total: workers.length,
                active: workers.filter((worker) => worker.active).length,
                passed: workers.filter((worker) => worker.verdict === "PASS").length,
                fixing: workers.filter((worker) => worker.verdict === "FIX").length,
                failed: workers.filter((worker) => worker.status === "failed" || worker.status === "blocked").length,
            };
            return { ...project, workers, counts };
        })
        .filter((project) => project.workers.length);
    const visible = (item) => item.kind === "decision" || keep.has(`${item.project}:${item.to}`);
    return { ...snapshot, projects, feed: snapshot.feed.filter(visible), reviews: snapshot.reviews.filter(visible) };
}

function statusDot(host) {
    return `<span class="dot tone-bg-${STATUS_TONE[host.status] || "muted"}"></span>`;
}

/**
 * Host bar above Fleet and Map. Empty when the cluster has one machine.
 * @param {any} snapshot
 * @param {string | null} selected
 * @returns {string}
 */
export function hostBarHtml(snapshot, selected) {
    const cluster = snapshot?.cluster;
    if (!cluster?.multi) {
        return "";
    }
    const chip = (id, label, extra = "") =>
        `<button type="button" class="host-chip${(selected || null) === id ? " is-on" : ""}" data-host-filter="${esc(id ?? "")}" aria-pressed="${(selected || null) === id}">${label}${extra}</button>`;
    const chips = cluster.hosts.map((host) =>
        chip(host.id, `${statusDot(host)}${esc(host.label)}`, `<span class="host-count">${num(host.workersActive)}</span>`),
    );
    return `<div class="wrap hostbar-inner">
        <span class="hostbar-title">${HOST_MARK}Cluster</span>
        ${chip(null, "All machines", `<span class="host-count">${num(snapshot.totals.hostsOnline)}/${num(snapshot.totals.hosts)}</span>`)}
        ${chips.join("")}
        <a class="hostbar-link" data-link href="/cluster">Details &rarr;</a>
    </div>`;
}

function hostCard(snapshot, host) {
    const workers = snapshot.projects.flatMap((project) =>
        project.workers.filter((worker) => worker.host === host.id).map((worker) => ({ project: project.name, worker })),
    );
    const active = workers.filter((entry) => entry.worker.active);
    const shown = (active.length ? active : workers).slice(0, 6);
    const rows = shown
        .map(
            ({ project, worker }) => `<li class="host-worker" data-project="${esc(project)}" data-worker="${esc(worker.id)}" role="button" tabindex="0">
                <span class="mono">${esc(project)} · ${esc(worker.id)}</span>
                <span class="tone-${esc(worker.state?.tone || "muted")}">${esc(worker.state?.label || "")}</span>
                <span class="tone-muted mono">${esc(modelLabel(worker))}</span>
            </li>`,
        )
        .join("");
    const meta = Object.entries(host.meta || {})
        .map(([key, value]) => `<span class="chip">${esc(key)}: ${esc(value)}</span>`)
        .join("");
    return `<article class="card panel host-card${host.status === "offline" ? " is-offline" : ""}">
        <header class="host-head">
            <div class="host-name">${HOST_MARK}<h2>${esc(host.label)}</h2>${host.self ? `<span class="badge">this machine</span>` : ""}</div>
            <span class="host-status tone-${STATUS_TONE[host.status] || "muted"}">${statusDot(host)}${esc(host.status)}</span>
        </header>
        <dl class="kvs host-kvs">
            <div class="kv"><dt>Reached through</dt><dd>${esc(host.via || "unknown")}</dd></div>
            <div class="kv"><dt>Last seen</dt><dd>${host.lastSeen ? agoTag(host.lastSeen) : host.self ? "now" : "never"}</dd></div>
            ${host.address ? `<div class="kv"><dt>Address</dt><dd class="mono" title="${esc(host.address)}">${esc(shortPath(host.address, null, 34))}</dd></div>` : ""}
            <div class="kv"><dt>Workers</dt><dd>${num(host.workersActive)} working, ${num(host.workersTotal)} in total</dd></div>
        </dl>
        ${host.providers.length ? `<div class="msg-chips">${host.providers.map((provider) => `<span class="chip">${esc(provider)}</span>`).join("")}${meta}</div>` : meta ? `<div class="msg-chips">${meta}</div>` : ""}
        <h3>${active.length ? "Working now" : "Recent workers"}</h3>
        ${rows ? `<ul class="host-workers">${rows}</ul>` : `<p class="sub">No workers on this machine yet.</p>`}
    </article>`;
}

/**
 * Renders the Cluster tab.
 * @param {HTMLElement} view
 * @param {any} snapshot
 */
export function renderCluster(view, snapshot) {
    const cluster = snapshot.cluster;
    const online = cluster.hosts.filter((host) => host.status === "online").length;
    const help = cluster.multi
        ? ""
        : `<div class="card panel cluster-help">
            <div class="eyebrow">Only this machine so far</div>
            <p>Maestro can run workers on other machines and show them here. Connect one in Paseo with <code>paseo host add &lt;ssh, ws, or host:port&gt;</code>, or start an OpenCode server there with <code>opencode serve --hostname &lt;address&gt; --port &lt;port&gt;</code>. Maestro adds each machine it can reach to the cluster at the start of a run.</p>
        </div>`;
    view.innerHTML = `<div class="wrap">
        <section class="live-head">
            <h1>Cluster <span class="updated"><span class="dot"></span>updated ${agoTag(snapshot.generatedAt)}</span></h1>
            <div class="stats">
                <div class="stat"><b>${num(cluster.hosts.length)}</b><span>machines</span></div>
                <div class="stat"><b>${num(online)}</b><span>online</span></div>
                <div class="stat"><b>${num(snapshot.totals.workersActive)}</b><span>workers working now</span></div>
            </div>
        </section>
        ${help}
        <section class="host-grid">${cluster.hosts.map((host) => hostCard(snapshot, host)).join("")}</section>
    </div>`;
}
