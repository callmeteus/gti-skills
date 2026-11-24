// Details of one item Maestro is waiting on: the run around it, recent decisions, and how to answer.
// The central is read only, so the answer goes to the chat that runs Maestro; the buttons copy one.

import { esc, agoTag } from "./format.mjs";

function list(items) {
    return `<ul class="plain-list">${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function kv(label, value) {
    return value ? `<div class="kv"><dt>${esc(label)}</dt><dd>${value}</dd></div>` : "";
}

/**
 * Replies the user can paste into the Maestro chat.
 * @param {string} project
 * @param {string | null} runId
 * @param {string} item
 * @returns {{ approve: string, decline: string }}
 */
export function pendingReplies(project, runId, item) {
    const where = runId ? `${project}, ${runId}` : project;
    return {
        approve: `Approved: ${item} (${where}). Go ahead.`,
        decline: `Declined: ${item} (${where}). Do not do it; leave it pending and tell me what is left.`,
    };
}

/**
 * Modal body for one pending item, or null when it is gone from the ledger.
 * @param {any} snapshot
 * @param {string} projectName
 * @param {string} item
 * @returns {string | null}
 */
export function pendingModalHtml(snapshot, projectName, item) {
    const project = snapshot.projects.find((entry) => entry.name === projectName);
    const run = project?.run;
    if (!run || !run.pending.includes(item)) {
        return null;
    }
    const replies = pendingReplies(project.name, run.id, item);
    const decisions = snapshot.feed.filter((entry) => entry.project === project.name && entry.kind === "decision").slice(0, 5);
    const others = run.pending.filter((entry) => entry !== item);
    return `<header class="modal-head">
            <div>
                <div class="eyebrow">${esc(project.name)}${run.id ? ` · ${esc(run.id)}` : ""}${run.phase ? ` · ${esc(run.phase)}` : ""}</div>
                <h2>${esc(item)}</h2>
                <span class="state tone-amber"><span class="dot"></span>waiting on you</span>
            </div>
            <button type="button" class="modal-close" data-close aria-label="Close">&times;</button>
        </header>
        <h3>How to answer</h3>
        <p class="sub">This page only shows the run. Answer in the chat where Maestro is running: approve, decline, or change the plan. Maestro does not take this step until you do.</p>
        <div class="reply-actions">
            <button type="button" class="btn" data-copy="${esc(replies.approve)}">Copy approval</button>
            <button type="button" class="btn ghost" data-copy="${esc(replies.decline)}">Copy refusal</button>
            <span class="copy-status" aria-live="polite"></span>
        </div>
        <h3>The run</h3>
        <dl class="kvs">
            ${kv("Goal", esc(run.goal || ""))}
            ${kv("Kind", esc([run.kind, run.class].filter(Boolean).join(", ")))}
            ${kv("Phase", esc(run.phase || ""))}
            ${kv("Runtime", esc(run.harness?.adapter || ""))}
            ${kv("Workers", esc(`${project.counts.passed} passed, ${project.counts.active} at work, of ${project.counts.total}`))}
        </dl>
        ${run.done.length ? `<h3>Done when</h3>${list(run.done)}` : ""}
        ${run.notVerified.length ? `<h3>Not verified yet</h3>${list(run.notVerified)}` : ""}
        ${others.length ? `<h3>Also waiting in this run</h3>${list(others)}` : ""}
        <h3>Recent decisions</h3>
        ${
            decisions.length
                ? `<ol class="timeline">${decisions
                      .map((entry) => `<li><span class="when">${agoTag(entry.ts)}</span><p>${esc(entry.text)}${entry.reason ? `. ${esc(entry.reason)}.` : ""}</p></li>`)
                      .join("")}</ol>`
                : `<p class="sub">No decisions recorded for this run yet.</p>`
        }`;
}
