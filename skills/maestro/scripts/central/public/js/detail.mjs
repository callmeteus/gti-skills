// Worker tooltip on hover and worker details in a modal on click, shared by the fleet and the map.
// Any element with data-project and data-worker becomes interactive through event delegation.

import { esc, agoTag, modelLabel } from "./format.mjs";
import { pendingModalHtml } from "./pending.mjs";
import { hostById } from "./cluster.mjs";

let snapshot = null;
let pointer = null;
let openKey = null;
// Result of the last copy in the open modal, kept across live re-renders.
let copyNote = "";

function tipEl() {
    return document.getElementById("tooltip");
}

function findWorker(projectName, id) {
    const project = snapshot?.projects.find((item) => item.name === projectName);
    const worker = project?.workers.find((item) => item.id === id);
    return worker ? { project, worker } : null;
}

function targetAt(node) {
    return node?.closest?.("[data-worker][data-project]") || null;
}

function hostLine(worker) {
    const host = hostById(snapshot, worker.host);
    if (!host || !snapshot.cluster?.multi) {
        return "";
    }
    return `${host.label}${host.self ? " (this machine)" : host.via ? ` via ${host.via}` : ""}`;
}

function tipHtml(project, worker) {
    const rounds = worker.rounds ? ` · ${worker.rounds} fix round${worker.rounds === 1 ? "" : "s"}` : "";
    return `<b>${esc(project.name)} · ${esc(worker.id)}</b>${esc(worker.task || "")}
        <span class="tip-row">${esc(modelLabel(worker))}${worker.tier ? ` · ${esc(worker.tier)}` : ""}</span>
        <span class="tip-row">${esc(worker.state?.label || worker.status || "")}${worker.verdict ? ` · ${esc(worker.verdict)}` : ""}${esc(rounds)}</span>
        ${hostLine(worker) ? `<span class="tip-row">on ${esc(hostLine(worker))}</span>` : ""}
        ${worker.chat ? `<span class="tip-row">chat ${esc(worker.chat)}</span>` : ""}
        <span class="tip-hint">Click for details</span>`;
}

function placeTip(x, y) {
    const tip = tipEl();
    const width = tip.offsetWidth || 280;
    const height = tip.offsetHeight || 100;
    const left = x + 16 + width > window.innerWidth ? x - width - 12 : x + 16;
    const top = y + 16 + height > window.innerHeight ? y - height - 12 : y + 16;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${Math.max(8, top)}px`;
}

function showTipFor(target, x, y) {
    const found = findWorker(target.dataset.project, target.dataset.worker);
    const tip = tipEl();
    if (!found) {
        tip.hidden = true;
        return;
    }
    tip.innerHTML = tipHtml(found.project, found.worker);
    tip.hidden = false;
    placeTip(x, y);
}

function hideTip() {
    tipEl().hidden = true;
}

function row(label, value) {
    if (value === null || value === undefined || value === "") {
        return "";
    }
    return `<div class="kv"><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
}

function attemptsHtml(attempts) {
    if (!Array.isArray(attempts) || !attempts.length) {
        return "";
    }
    const rows = attempts
        .map(
            (attempt) => `<tr><td>${esc(modelLabel(attempt))}</td><td>${esc(attempt.adapter || "")}</td><td>${esc(attempt.result || "")}</td><td>${attempt.cooldownUntil ? esc(new Date(attempt.cooldownUntil).toLocaleTimeString()) : ""}</td></tr>`,
        )
        .join("");
    return `<h3>Attempts</h3><table class="rows"><thead><tr><th>Model</th><th>Runtime</th><th>Result</th><th>Cooldown</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function historyHtml(project, worker) {
    const events = snapshot.feed.filter((item) => item.project === project.name && item.to === worker.id);
    if (!events.length) {
        return `<h3>History</h3><p class="sub">No events recorded for this worker yet.</p>`;
    }
    const items = events
        .slice(0, 30)
        .map(
            (item) => `<li><span class="when">${agoTag(item.ts)}</span><span class="what">${esc(item.kind)}</span>${item.result && item.result !== "started" ? `<span class="chip verdict-${esc(item.result)}">${esc(item.result)}</span>` : ""}<p>${esc(item.text)}</p></li>`,
        )
        .join("");
    return `<h3>History</h3><ol class="timeline">${items}</ol>`;
}

function modalHtml(project, worker) {
    const files = Array.isArray(worker.files) && worker.files.length ? worker.files.map((file) => `<span class="chip">${esc(file)}</span>`).join(" ") : "";
    return `<header class="modal-head">
            <div>
                <div class="eyebrow">${esc(project.name)}${project.run?.id ? ` · ${esc(project.run.id)}` : ""} · wave ${esc(worker.wave || 1)}</div>
                <h2>${esc(worker.id)}: ${esc(worker.task || "untitled task")}</h2>
                <span class="state tone-${esc(worker.state?.tone || "muted")}"><span class="dot"></span>${esc(worker.state?.label || worker.status || "")}</span>
            </div>
            <button type="button" class="modal-close" data-close aria-label="Close">&times;</button>
        </header>
        <dl class="kvs">
            ${row("Model", esc(modelLabel(worker)))}
            ${row("Tier", esc(worker.tier || ""))}
            ${row("Type", esc(worker.type || ""))}
            ${row("Status", esc(worker.status || ""))}
            ${row("Verdict", worker.verdict ? `<span class="verdict-${esc(worker.verdict)}">${esc(worker.verdict)}</span>` : "")}
            ${row("Fix rounds", worker.rounds !== undefined ? esc(String(worker.rounds)) : "")}
            ${row("Machine", esc(hostLine(worker) || (hostById(snapshot, worker.host)?.label ?? "")))}
            ${row("Runtime", esc(worker.adapter || ""))}
            ${row("Orchestrator", esc(worker.orchestrator || ""))}
            ${row("Chat", worker.chat ? `<code>${esc(worker.chat)}</code>` : "")}
            ${row("Resumable", worker.resumable === undefined ? "" : worker.resumable ? "yes" : "no")}
            ${row("Why this model", esc(worker.routing || ""))}
            ${row("Notes", esc(worker.notes || ""))}
            ${row("Files", files)}
        </dl>
        ${attemptsHtml(worker.attempts)}
        ${historyHtml(project, worker)}`;
}

function dialogEl() {
    let dialog = document.getElementById("worker-dialog");
    if (!dialog) {
        dialog = document.createElement("dialog");
        dialog.id = "worker-dialog";
        dialog.className = "modal";
        dialog.addEventListener("click", (event) => {
            // A click on the backdrop lands on the dialog itself; the content sits in an inner box.
            if (event.target === dialog || event.target.closest("[data-close]")) {
                dialog.close();
            }
        });
        dialog.addEventListener("close", () => {
            openKey = null;
        });
        document.body.append(dialog);
    }
    return dialog;
}

function renderModal() {
    if (!openKey) {
        return;
    }
    const dialog = dialogEl();
    const scroll = dialog.querySelector(".modal-body")?.scrollTop || 0;
    let body;
    if (openKey.kind === "pending") {
        body = pendingModalHtml(snapshot, openKey.project, openKey.item);
    } else {
        const found = findWorker(openKey.project, openKey.id);
        body = found ? modalHtml(found.project, found.worker) : null;
    }
    dialog.innerHTML = body
        ? `<div class="modal-body">${body}</div>`
        : `<div class="modal-body"><p class="empty">This is no longer in the ledger: it was answered or the run moved on.</p><button type="button" class="btn" data-close>Close</button></div>`;
    dialog.querySelector(".modal-body").scrollTop = scroll;
    const status = dialog.querySelector(".copy-status");
    if (status) {
        status.textContent = copyNote;
    }
}

/**
 * Opens the details of one worker.
 * @param {string} project
 * @param {string} id
 */
export function openWorker(project, id) {
    show({ kind: "worker", project, id });
}

/**
 * Opens one item Maestro is waiting on.
 * @param {string} project
 * @param {string} item
 */
export function openPending(project, item) {
    show({ kind: "pending", project, item });
}

function show(key) {
    hideTip();
    openKey = key;
    copyNote = "";
    renderModal();
    const dialog = dialogEl();
    if (!dialog.open) {
        dialog.showModal();
    }
}

async function copyReply(button) {
    const status = button.parentElement.querySelector(".copy-status");
    try {
        await navigator.clipboard.writeText(button.dataset.copy);
        copyNote = "Copied. Paste it in the Maestro chat.";
    } catch {
        // No clipboard access (an insecure context or a denied permission): show the text to copy by hand.
        copyNote = `Copy this into the Maestro chat: ${button.dataset.copy}`;
    }
    status.textContent = copyNote;
}

function openFrom(node) {
    const pending = node?.closest?.("[data-pending-project]");
    if (pending) {
        openPending(pending.dataset.pendingProject, pending.dataset.pendingItem);
        return true;
    }
    const target = targetAt(node);
    if (target) {
        openWorker(target.dataset.project, target.dataset.worker);
        return true;
    }
    return false;
}

/**
 * Gives the helpers the newest snapshot, refreshes an open modal, and keeps the tooltip on the element
 * under the pointer after a re-render replaced it.
 * @param {any} next
 */
export function setDetailSnapshot(next) {
    snapshot = next;
    renderModal();
    if (pointer && !tipEl().hidden) {
        const target = targetAt(document.elementFromPoint(pointer.x, pointer.y));
        if (target) {
            showTipFor(target, pointer.x, pointer.y);
        } else {
            hideTip();
        }
    }
}

/**
 * Binds hover and click once, on the document.
 */
export function bindDetails() {
    document.addEventListener("pointermove", (event) => {
        pointer = { x: event.clientX, y: event.clientY };
        const target = targetAt(event.target);
        if (target) {
            showTipFor(target, event.clientX, event.clientY);
        } else if (!tipEl().hidden) {
            hideTip();
        }
    });
    document.addEventListener("pointerleave", hideTip);
    document.addEventListener("click", (event) => {
        const copy = event.target.closest?.("[data-copy]");
        if (copy) {
            copyReply(copy);
            return;
        }
        if (!event.defaultPrevented && !event.target.closest?.("dialog")) {
            openFrom(event.target);
        }
    });
    document.addEventListener("keydown", (event) => {
        const focused = document.activeElement;
        const opener = focused?.closest?.("[data-pending-project], [data-worker][data-project]");
        if (opener && opener === focused && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openFrom(focused);
        }
    });
}
