// Dark task map: one cluster per project, one dot per worker task, rings by wave. Pan, zoom, search.

import { esc, colorAt } from "./format.mjs";

const NS = "http://www.w3.org/2000/svg";
const LEGEND = [
    ["#e9e4d6", "passed"],
    ["#5a9cf0", "worker at work"],
    ["#f0b24a", "fix round"],
    ["#a989dd", "reassigned or escalated"],
    ["#e0604e", "failed or blocked"],
    ["transparent", "waiting", "#6f7684"],
];

const view = { x: 0, y: 0, k: 1, fitted: false };
let els = null;
let clusters = [];
let query = "";
let keyBound = false;

function nodeColor(worker) {
    if (worker.active) {
        return worker.rounds > 0 ? "#f0b24a" : "#5a9cf0";
    }
    if (worker.verdict === "PASS") {
        return "#e9e4d6";
    }
    if (worker.verdict === "FIX") {
        return "#f0b24a";
    }
    if (worker.verdict === "REASSIGN" || worker.verdict === "ESCALATE") {
        return "#a989dd";
    }
    if (worker.status === "failed" || worker.status === "blocked") {
        return "#e0604e";
    }
    return "transparent";
}

/**
 * World layout: clusters on a golden-angle spiral, tasks on one ring per wave.
 * @param {any[]} projects
 * @returns {any[]}
 */
export function layoutMap(projects) {
    return projects.map((project, i) => {
        const n = Math.max(1, project.workers.length);
        const radius = 46 + 16 * Math.sqrt(n);
        const spiral = i === 0 ? 0 : 300 * Math.sqrt(i);
        const angle = i * 2.39996;
        const cx = spiral * Math.cos(angle);
        const cy = spiral * Math.sin(angle) * 0.7;
        const waves = Math.max(1, ...project.workers.map((worker) => worker.wave || 1));
        const nodes = [];
        for (let wave = 1; wave <= waves; wave += 1) {
            const ring = project.workers.filter((worker) => (worker.wave || 1) === wave);
            const r = waves === 1 ? radius * 0.55 : radius * (0.28 + (0.64 * (wave - 1)) / (waves - 1));
            ring.forEach((worker, j) => {
                const a = (j / ring.length) * Math.PI * 2 + wave * 0.7;
                nodes.push({ worker, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
            });
        }
        return { project, color: colorAt(i), cx, cy, radius, nodes };
    });
}

function el(name, attrs = {}) {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) {
        node.setAttribute(key, String(value));
    }
    return node;
}

function applyView() {
    els.world.setAttribute("transform", `translate(${view.x},${view.y}) scale(${view.k})`);
    drawMinimap();
}

function bounds() {
    if (!clusters.length) {
        return { x: -100, y: -100, w: 200, h: 200 };
    }
    const xs = clusters.flatMap((c) => [c.cx - c.radius - 60, c.cx + c.radius + 60]);
    const ys = clusters.flatMap((c) => [c.cy - c.radius - 40, c.cy + c.radius + 70]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function fit() {
    const { width, height } = els.stage.getBoundingClientRect();
    const b = bounds();
    view.k = Math.min(width / b.w, height / b.h, 2.4) * 0.9;
    view.x = width / 2 - (b.x + b.w / 2) * view.k;
    view.y = height / 2 - (b.y + b.h / 2) * view.k;
    applyView();
}

function zoomAt(factor, px, py) {
    const k = Math.min(8, Math.max(0.2, view.k * factor));
    view.x = px - ((px - view.x) * k) / view.k;
    view.y = py - ((py - view.y) * k) / view.k;
    view.k = k;
    applyView();
}

function drawMinimap() {
    const mini = els.minimap;
    mini.replaceChildren();
    const b = bounds();
    const scale = Math.min(150 / b.w, 96 / b.h);
    const ox = (150 - b.w * scale) / 2 - b.x * scale;
    const oy = (96 - b.h * scale) / 2 - b.y * scale;
    for (const c of clusters) {
        mini.append(el("circle", { cx: c.cx * scale + ox, cy: c.cy * scale + oy, r: Math.max(2.5, c.radius * scale), fill: c.color, opacity: 0.55 }));
    }
    const { width, height } = els.stage.getBoundingClientRect();
    mini.append(
        el("rect", {
            x: (-view.x / view.k) * scale + ox,
            y: (-view.y / view.k) * scale + oy,
            width: (width / view.k) * scale,
            height: (height / view.k) * scale,
            fill: "none",
            stroke: "#e9e7e1",
            "stroke-width": 1,
            opacity: 0.7,
        }),
    );
}

function matches(node) {
    if (!query) {
        return true;
    }
    const w = node.worker;
    return [w.id, w.task, w.model, w.provider, w.chat].some((value) => String(value || "").toLowerCase().includes(query));
}

function drawWorld() {
    const world = els.world;
    world.replaceChildren();
    for (let i = 1; i < clusters.length; i += 1) {
        const a = clusters[i - 1];
        const b = clusters[i];
        world.append(el("line", { x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy, stroke: "#3a4150", "stroke-width": 1, opacity: 0.6 }));
    }
    for (const c of clusters) {
        const glow = el("circle", { cx: c.cx, cy: c.cy, r: c.radius * 1.35, fill: c.color, opacity: 0.07 });
        const ring = el("circle", { cx: c.cx, cy: c.cy, r: c.radius, fill: "none", stroke: c.color, "stroke-opacity": 0.35, "stroke-dasharray": "2 4" });
        world.append(glow, ring);
        for (const r of new Set(c.nodes.map((node) => Math.round(Math.hypot(node.x - c.cx, node.y - c.cy))))) {
            world.append(el("circle", { cx: c.cx, cy: c.cy, r, fill: "none", stroke: c.color, "stroke-opacity": 0.12 }));
        }
        for (const node of c.nodes) {
            const fill = nodeColor(node.worker);
            // data-project and data-worker make the dot open the shared tooltip and details modal.
            const g = el("g", {
                class: `node${matches(node) ? "" : " is-dim"}`,
                "data-worker": node.worker.id,
                "data-project": c.project.name,
                role: "button",
                tabindex: 0,
                "aria-label": `${c.project.name} ${node.worker.id}: ${node.worker.task || ""}. Open details`,
            });
            if (node.worker.active) {
                g.append(el("circle", { class: "node-ring", cx: node.x, cy: node.y, r: 6, stroke: fill }));
            }
            g.append(
                el("circle", {
                    cx: node.x,
                    cy: node.y,
                    r: 6,
                    fill,
                    stroke: fill === "transparent" ? "#6f7684" : c.color,
                    "stroke-width": fill === "transparent" ? 1.2 : 1.6,
                    "stroke-dasharray": fill === "transparent" ? "2 2" : "none",
                }),
            );
            world.append(g);
        }
        const name = el("text", { x: c.cx, y: c.cy + c.radius + 26, "text-anchor": "middle", class: "cluster-name", fill: c.color });
        name.textContent = c.project.name;
        const counts = c.project.counts;
        const meta = el("text", { x: c.cx, y: c.cy + c.radius + 42, "text-anchor": "middle", class: "cluster-meta" });
        meta.textContent = `${counts.passed} passed · ${counts.active} at work · ${counts.fixing} fixing`;
        world.append(name, meta);
    }
}

function focusFirstMatch() {
    for (const c of clusters) {
        const node = c.nodes.find(matches);
        if (node) {
            const { width, height } = els.stage.getBoundingClientRect();
            view.k = Math.max(view.k, 1.6);
            view.x = width / 2 - node.x * view.k;
            view.y = height / 2 - node.y * view.k;
            applyView();
            return;
        }
    }
}

function bind() {
    const stage = els.stage;
    let drag = null;
    let dragged = false;
    stage.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button")) {
            return;
        }
        drag = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y, id: event.pointerId };
        dragged = false;
    });
    stage.addEventListener("pointermove", (event) => {
        if (!drag) {
            return;
        }
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        // Capture only once the pointer really moves, so a plain click still reaches the dot under it.
        if (!dragged && Math.hypot(dx, dy) < 4) {
            return;
        }
        if (!dragged) {
            dragged = true;
            stage.setPointerCapture(drag.id);
            stage.classList.add("is-dragging");
        }
        view.x = drag.vx + dx;
        view.y = drag.vy + dy;
        applyView();
    });
    // A drag that ends on a dot is not a click on it.
    stage.addEventListener(
        "click",
        (event) => {
            if (dragged) {
                event.preventDefault();
                event.stopPropagation();
                dragged = false;
            }
        },
        true,
    );
    const end = () => {
        drag = null;
        stage.classList.remove("is-dragging");
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
    stage.addEventListener(
        "wheel",
        (event) => {
            if (!event.ctrlKey && !event.metaKey) {
                return;
            }
            event.preventDefault();
            const rect = stage.getBoundingClientRect();
            zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - rect.left, event.clientY - rect.top);
        },
        { passive: false },
    );
    els.root.querySelector("[data-zoom=in]").addEventListener("click", () => {
        const rect = stage.getBoundingClientRect();
        zoomAt(1.25, rect.width / 2, rect.height / 2);
    });
    els.root.querySelector("[data-zoom=out]").addEventListener("click", () => {
        const rect = stage.getBoundingClientRect();
        zoomAt(0.8, rect.width / 2, rect.height / 2);
    });
    els.root.querySelector("[data-zoom=fit]").addEventListener("click", fit);
    els.root.querySelector(".map-hint button").addEventListener("click", (event) => event.target.closest(".map-hint").remove());
    els.search.addEventListener("input", () => {
        query = els.search.value.trim().toLowerCase();
        drawWorld();
    });
    els.search.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            focusFirstMatch();
        }
    });
    if (!keyBound) {
        keyBound = true;
        window.addEventListener("keydown", (event) => {
            if (event.key === "/" && document.activeElement?.tagName !== "INPUT" && els?.search.isConnected) {
                event.preventDefault();
                els.search.focus();
            }
        });
    }
}

/**
 * Creates the map inside `root` once.
 * @param {HTMLElement} root
 */
export function mountMap(root) {
    const legend = LEGEND.map(([fill, label, stroke]) => `<span><i style="background:${fill};${stroke ? `border:1px dashed ${stroke}` : ""}"></i>${esc(label)}</span>`).join("");
    root.innerHTML = `<div class="wrap">
        <div class="map-head">
            <div><h2 data-map-title>Mapping the fleet</h2><span class="updated"><span class="dot"></span>live</span></div>
            <label class="search"><span aria-hidden="true">&#9906;</span><input type="search" placeholder="Find a task, a worker, a model" aria-label="Find a task, a worker, or a model"><kbd>/</kbd></label>
        </div>
        <div class="map-stage">
            <svg aria-label="Task map"><g data-world></g></svg>
            <div class="map-hint">Drag to pan · Ctrl + scroll or pinch to zoom <button type="button" aria-label="Hide" style="background:none;border:0;color:inherit;cursor:pointer">&times;</button></div>
            <div class="map-legend">${legend}</div>
            <div class="map-tools"><svg class="minimap" viewBox="0 0 150 96" aria-hidden="true"></svg>
                <div class="zoom"><button type="button" data-zoom="in" aria-label="Zoom in">+</button><button type="button" data-zoom="out" aria-label="Zoom out">&minus;</button><button type="button" data-zoom="fit" aria-label="Fit">&#9974;</button></div>
            </div>
        </div>
        <div class="map-foot">Rings are waves; each dot is one worker task.</div>
    </div>`;
    els = {
        root,
        stage: root.querySelector(".map-stage"),
        world: root.querySelector("[data-world]"),
        minimap: root.querySelector(".minimap"),
        search: root.querySelector(".search input"),
        title: root.querySelector("[data-map-title]"),
    };
    view.fitted = false;
    bind();
}

/**
 * Redraws the map for a new snapshot and keeps the user's pan and zoom.
 * @param {any} snapshot
 */
export function updateMap(snapshot) {
    if (!els) {
        return;
    }
    clusters = layoutMap(snapshot.projects);
    const { totals } = snapshot;
    els.title.textContent = `${totals.workersTotal} tasks across ${totals.projects} project${totals.projects === 1 ? "" : "s"}. ${totals.workersActive} worker${totals.workersActive === 1 ? "" : "s"} on the open ones.`;
    drawWorld();
    if (!view.fitted) {
        view.fitted = true;
        fit();
    } else {
        applyView();
    }
}
