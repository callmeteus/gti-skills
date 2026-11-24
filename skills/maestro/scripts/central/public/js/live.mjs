// Live fleet viewer: Maestro in the middle, one cluster per project, one seat per worker chat.

import { esc, num, colorAt, agoTag, modelLabel, seatLine, MAESTRO_MARK } from "./format.mjs";
import { messagesHtml, reviewsHtml } from "./feed.mjs";
import { HOST_MARK } from "./cluster.mjs";

// Host id to label, set per render when the cluster has more than one machine; empty otherwise.
let hostLabels = new Map();

const SEAT_W = 216;
const SEAT_H = 50;
const GAP = 8;
const MOBILE = 620;

function stackHeight(count) {
    return count * SEAT_H + Math.max(0, count - 1) * GAP;
}

/**
 * Cluster anchor points around the core for a stage of width w.
 * @param {number} count
 * @param {number} w
 * @param {number} h
 * @returns {{ core: {x:number,y:number}, points: {x:number,y:number}[] }}
 */
export function layoutClusters(count, w, h) {
    if (count === 1) {
        return { core: { x: w * 0.66, y: h / 2 }, points: [{ x: w * 0.24, y: h / 2 }] };
    }
    const core = { x: w / 2, y: h / 2 };
    const rx = w * 0.34;
    const ry = h * 0.3;
    const points = [];
    for (let i = 0; i < count; i += 1) {
        const angle = Math.PI + (i * 2 * Math.PI) / count;
        points.push({ x: core.x + rx * Math.cos(angle), y: core.y + ry * Math.sin(angle) });
    }
    return { core, points };
}

function seatHtml(project, worker, x, y, color) {
    const cls = worker.active ? "is-active" : "is-idle";
    const host = hostLabels.get(worker.host);
    const label = `${worker.id}: ${worker.task || ""}, ${modelLabel(worker)}${host ? `, on ${host}` : ""}, ${worker.state?.label || ""}. Open details`;
    return `<div class="seat ${cls}" style="left:${x}px;top:${y}px" data-project="${esc(project.name)}" data-worker="${esc(worker.id)}" role="button" tabindex="0" aria-label="${esc(label)}">
        <div class="seat-top"><span class="dot" style="background:${color}"></span>${esc(worker.id)}<span class="meta">· ${esc(worker.tier || "")} ${esc(worker.model || worker.provider || "")}</span></div>
        <div class="seat-state tone-${esc(worker.state?.tone || "muted")}"><span class="dot"></span><span>${esc(seatLine(worker))}</span></div>
        ${host ? `<span class="seat-host">${HOST_MARK}${esc(host)}</span>` : ""}
    </div>`;
}

function edgePath(from, to) {
    const midX = (from.x + to.x) / 2;
    return `M${from.x.toFixed(1)},${from.y.toFixed(1)} C${midX.toFixed(1)},${from.y.toFixed(1)} ${midX.toFixed(1)},${to.y.toFixed(1)} ${to.x.toFixed(1)},${to.y.toFixed(1)}`;
}

function fleetDesktop(projects, width, latest) {
    const tallest = Math.max(...projects.map((project) => stackHeight(Math.max(1, project.workers.length))));
    const height = projects.length === 1 ? Math.max(460, tallest + 170) : Math.max(620, tallest * 2 + 240);
    const { core, points } = layoutClusters(projects.length, width, height);
    const halos = [];
    const labels = [];
    const seats = [];
    const edges = [];

    projects.forEach((project, index) => {
        const color = colorAt(index);
        const point = points[index];
        const workers = project.workers.length ? project.workers : [];
        const stack = stackHeight(Math.max(1, workers.length));
        const left = Math.min(Math.max(point.x - SEAT_W / 2, 12), width - SEAT_W - 12);
        let top = Math.min(Math.max(point.y - stack / 2, 70), height - stack - 16);
        halos.push(`<div class="halo" style="left:${point.x}px;top:${point.y}px;width:${SEAT_W + 200}px;height:${stack + 220}px;background:radial-gradient(closest-side, ${color}33, transparent)"></div>`);
        const run = project.run;
        labels.push(`<div class="cluster-label" style="left:${left + SEAT_W / 2}px;top:${top - 50}px;color:${color}">
            ${esc(project.name)}${run?.kind ? ` · ${esc(run.kind)}` : ""}
            <small>${esc(run?.phase || "no run")} · ${esc(run?.id || "")}</small>
        </div>`);
        if (!workers.length) {
            seats.push(`<div class="seat is-idle" style="left:${left}px;top:${top}px"><div class="seat-top">no workers yet</div><div class="seat-state">${esc(run?.goal || "")}</div></div>`);
        }
        for (const worker of workers) {
            seats.push(seatHtml(project, worker, left, top, color));
            const fromRight = left + SEAT_W < core.x;
            const from = { x: fromRight ? left + SEAT_W : left, y: top + SEAT_H / 2 };
            const path = edgePath(from, core);
            const cls = worker.active ? "edge" : "edge idle";
            edges.push(`<path class="${cls}" d="${path}" stroke="${color}"/>`);
            if (worker.active) {
                const dur = (2 + (worker.id.length % 3) * 0.6).toFixed(1);
                edges.push(`<circle r="2.6" fill="${color}"><animateMotion dur="${dur}s" repeatCount="indefinite" path="${path}"/></circle>`);
            }
            top += SEAT_H + GAP;
        }
    });

    const pill = latest
        ? `<div class="core-pill" style="left:${core.x}px;top:${core.y + 56}px">${esc(latest.result)} ${esc(latest.to || "")} · ${agoTag(latest.ts)}</div>`
        : "";
    return `<div class="fleet card" style="height:${height}px">
        ${halos.join("")}
        <svg class="edges" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${edges.join("")}</svg>
        ${labels.join("")}
        ${seats.join("")}
        <div class="core" style="left:${core.x}px;top:${core.y}px">${MAESTRO_MARK}<span>MAESTRO</span></div>
        ${pill}
    </div>`;
}

function fleetMobile(projects) {
    const groups = projects.map((project, index) => {
        const color = colorAt(index);
        const seats = project.workers.length
            ? project.workers.map((worker) => seatHtml(project, worker, 0, 0, color)).join("")
            : `<div class="seat is-idle"><div class="seat-top">no workers yet</div></div>`;
        return `<section><div class="cluster-label" style="color:${color}">${esc(project.name)}${project.run?.kind ? ` · ${esc(project.run.kind)}` : ""}<small>${esc(project.run?.phase || "no run")}</small></div>${seats}</section>`;
    });
    return `<div class="fleet card mobile-fleet">${groups.join("")}</div>`;
}

/**
 * Attention band above the fleet: gated actions and open decisions Maestro is waiting on. Hidden when empty.
 * @param {{ project: string, item: string }[]} pending
 * @returns {string}
 */
function attentionHtml(pending) {
    if (!pending.length) {
        return "";
    }
    const rows = pending
        .map((entry) => `<li><button type="button" class="attention-item" data-pending-project="${esc(entry.project)}" data-pending-item="${esc(entry.item)}"><span class="attention-project">${esc(entry.project)}</span><span>${esc(entry.item)}</span><span class="attention-more" aria-hidden="true">Details &rarr;</span></button></li>`)
        .join("");
    return `<section class="attention" role="status" aria-label="Waiting on you">
        <div class="attention-head"><span class="dot"></span>Waiting on you<span class="attention-count">${num(pending.length)}</span></div>
        <ul>${rows}</ul>
    </section>`;
}

/**
 * Renders the live view into `view`.
 * @param {HTMLElement} view
 * @param {any} snapshot
 */
export function renderLive(view, snapshot) {
    hostLabels = snapshot.cluster?.multi ? new Map(snapshot.cluster.hosts.map((host) => [host.id, host.label])) : new Map();
    const { totals, projects } = snapshot;
    const width = Math.min(view.clientWidth || window.innerWidth, 1220) - 56;
    const latest = snapshot.reviews[0] || null;
    const fleet = !projects.length
        ? `<div class="fleet card empty">No Maestro runs found in <code>${esc(snapshot.root)}</code>.<br>Start one with <code>/maestro &lt;task&gt;</code>, or run <code>central demo</code> to see a sample.</div>`
        : width < MOBILE
          ? fleetMobile(projects)
          : fleetDesktop(projects, width, latest);
    const pending = projects.flatMap((project) => (project.run?.pending || []).map((item) => ({ project: project.name, item })));
    // The feed scrolls inside its card; keep the reader's place across live updates.
    const feedScroll = view.querySelector(".feed")?.scrollTop || 0;

    view.innerHTML = `<div class="wrap">
        <section class="live-head">
            <h1>Fleet <span class="updated"><span class="dot"></span>updated ${agoTag(snapshot.generatedAt)}</span></h1>
            <div class="stats">
                <div class="stat"><b>${num(totals.runsSoFar)}</b><span>runs so far</span></div>
                <div class="stat"><b>${num(totals.workersActive)}</b><span>workers working now</span></div>
                <div class="stat"><b>${num(totals.orchestrators)}</b><span>orchestrators</span></div>
                <div class="stat"><b>${num(totals.eventsToday)}</b><span>events today</span></div>
            </div>
        </section>
        ${attentionHtml(pending)}
        ${fleet}
        <section class="section grid-2">
            <div class="card panel">
                <h2>Run feed <span class="badge live">live</span></h2>
                <p class="sub">Briefs, reviews, and decisions, as Maestro wrote them.</p>
                <div class="feed">${messagesHtml(snapshot.feed)}</div>
            </div>
            <div class="stack">
                <div class="card panel"><div class="eyebrow">Reviews · latest</div><div style="margin-top:12px">${reviewsHtml(snapshot.reviews)}</div></div>
            </div>
        </section>
    </div>`;
    const feed = view.querySelector(".feed");
    if (feed) {
        feed.scrollTop = feedScroll;
    }
}
