// Settings tab: provider health from the catalog and the preferences Maestro remembers.

import { esc, agoTag, modelLabel, shortPath } from "./format.mjs";

const HEALTH_TONE = { healthy: "green", cooling: "amber", unavailable: "red" };

function table(head, rows) {
    return `<table class="rows"><thead><tr>${head.map((cell) => `<th>${esc(cell)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

function when(value) {
    if (!value) {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    return Object.entries(value)
        .map(([key, val]) => `${key} ${val}`)
        .join(", ");
}

function sourceCell(source) {
    return `<td class="tone-muted">${esc(source || "")}</td>`;
}

/**
 * Provider health table.
 * @param {any[]} providers
 * @returns {string}
 */
export function providersHtml(providers) {
    if (!providers.length) {
        return `<p class="sub">No provider catalog yet. Maestro writes it at intake.</p>`;
    }
    return table(
        ["Model", "Health", "Cost", "Speed"],
        providers.map(
            (row) => `<tr>
                <td>${esc(modelLabel(row))}</td>
                <td class="tone-${HEALTH_TONE[row.health] || "muted"}">${esc(row.health)}${row.cooldownUntil ? ` until ${esc(new Date(row.cooldownUntil).toLocaleTimeString())}` : ""}</td>
                <td>${esc(row.cost)}</td>
                <td>${esc(row.speed)}</td>
            </tr>`,
        ),
    );
}

function rolesAndDefaults(prefs) {
    const rows = [];
    for (const [role, value] of Object.entries(prefs.roles || {})) {
        rows.push(`<tr><td>${esc(role)}</td><td>${esc(modelLabel(value))}</td>${sourceCell(value?.note)}</tr>`);
    }
    const { source, note, ...defaults } = prefs.defaults || {};
    for (const [key, value] of Object.entries(defaults)) {
        const shown = value && typeof value === "object" ? when(value) : String(value);
        rows.push(`<tr><td>${esc(key === "adapter" ? "runtime" : key)}</td><td>${esc(shown)}</td>${sourceCell(source)}</tr>`);
    }
    return rows.length ? table(["Setting", "Value", "Source"], rows) : `<p class="sub">No roles or defaults saved.</p>`;
}

function profilesTable(prefs) {
    if (!prefs.profiles.length) {
        return `<p class="sub">No run profiles saved yet. Maestro saves one when you set a model or runtime for a kind of run.</p>`;
    }
    return table(
        ["Kind", "Executor", "Orchestrator", "Runtime", "Tier", "Source"],
        prefs.profiles.map(
            (profile) => `<tr>
                <td>${esc(profile.kind)}</td>
                <td>${esc(profile.executor ? modelLabel(profile.executor) : "")}</td>
                <td>${esc(profile.orchestrator ? modelLabel(profile.orchestrator) : "")}</td>
                <td>${esc(profile.adapter || "")}</td>
                <td>${esc(profile.tier || "")}</td>
                <td class="tone-muted">${esc(profile.source || "")}${profile.lastRun ? ` · ${esc(profile.lastRun)}` : ""}</td>
            </tr>`,
        ),
    );
}

function routingTable(prefs) {
    const rows = [
        ...prefs.fallbacks.map((item) => `<tr><td>fallback</td><td>${esc(when(item.when))}</td><td>${esc(modelLabel(item))}</td></tr>`),
        ...prefs.routes.map((item) => `<tr><td>route</td><td>${esc(when(item.when))}</td><td>${esc(modelLabel(item))}</td></tr>`),
        ...prefs.avoid.map((item) => `<tr><td>avoid</td><td>${esc(item.note || "")}</td><td>${esc(modelLabel(item))}</td></tr>`),
    ];
    return rows.length ? table(["Rule", "When", "Model"], rows) : `<p class="sub">No fallbacks, routes, or avoided models.</p>`;
}

function pathTag(path, home) {
    return `<span class="tone-muted mono path" title="${esc(path)}">${esc(shortPath(path, home))}</span>`;
}

function scopeBlock(prefs, home) {
    const title = prefs.scope === "user" ? "This machine" : `Project ${prefs.scope}`;
    return `<section class="settings-scope">
        <div class="settings-scope-head">
            <h2>${esc(title)}</h2>
            ${pathTag(prefs.file, home)}${prefs.updated ? `<span class="tone-muted mono">updated ${agoTag(prefs.updated)}</span>` : ""}
        </div>
        <div class="grid-2">
            <div class="card panel"><div class="eyebrow">Roles and defaults</div><div class="panel-body">${rolesAndDefaults(prefs)}</div></div>
            <div class="card panel"><div class="eyebrow">Routing rules</div><div class="panel-body">${routingTable(prefs)}</div></div>
        </div>
        <div class="card panel"><div class="eyebrow">Run profiles</div><div class="panel-body">${profilesTable(prefs)}</div></div>
    </section>`;
}

/**
 * Renders the settings tab.
 * @param {HTMLElement} view
 * @param {any} snapshot
 */
export function renderSettings(view, snapshot) {
    const prefs = snapshot.preferences;
    const scopes = prefs ? [prefs.user, ...prefs.projects].filter(Boolean) : [];
    view.innerHTML = `<div class="wrap settings">
        <section class="live-head">
            <h1>Settings <span class="updated"><span class="dot"></span>updated ${agoTag(snapshot.generatedAt)}</span></h1>
        </section>
        <p class="sub settings-note">Read only. Change them by asking Maestro, or with <code>/maestro preferences</code>; remove one with <code>/maestro preferences forget &lt;key&gt;</code>.</p>
        <section class="settings-scope">
            <div class="settings-scope-head"><h2>Providers</h2>${pathTag(snapshot.root, snapshot.home)}</div>
            <div class="card panel"><div class="panel-body">${providersHtml(snapshot.providers)}</div></div>
        </section>
        ${scopes.length ? scopes.map((prefs) => scopeBlock(prefs, snapshot.home)).join("") : `<div class="card panel"><p class="sub">No saved preferences yet.</p></div>`}
    </div>`;
}
