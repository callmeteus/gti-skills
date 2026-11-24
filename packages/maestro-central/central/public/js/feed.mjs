// Feed, review, and provider blocks shared by the overview and the live view.

import { esc, agoTag } from "./format.mjs";

const seen = new Set();

function isNew(id) {
    if (seen.has(id)) {
        return false;
    }
    seen.add(id);
    return true;
}

/**
 * Marks every current feed id as seen, so the first render does not flash.
 * @param {any[]} feed
 */
export function primeSeen(feed) {
    for (const item of feed) {
        seen.add(item.id);
    }
}

function who(item) {
    const to = item.to === "decision" ? "decision" : item.to || "run";
    return `${esc(item.project)} · ${esc(item.from || "maestro")} → ${esc(to)}`;
}

/**
 * Long-form messages for the live view.
 * @param {any[]} feed
 * @param {number} [limit]
 * @returns {string}
 */
export function messagesHtml(feed, limit = 40) {
    if (!feed.length) {
        return `<p class="empty">No messages yet. They appear here as Maestro briefs, reviews, and decides.</p>`;
    }
    return feed
        .slice(0, limit)
        .map((item) => {
            const chips = [];
            if (item.result && item.result !== "started") {
                chips.push(`<span class="chip verdict-${esc(item.result)}">${esc(item.result)}</span>`);
            }
            if (item.kind && item.kind !== "decision") {
                chips.push(`<span class="chip">${esc(item.kind)}</span>`);
            }
            for (const file of item.files || []) {
                chips.push(`<span class="chip">${esc(file)}</span>`);
            }
            return `<article class="msg${isNew(item.id) ? " flash" : ""}">
                <div class="msg-head"><span>${who(item)}</span><span class="when">${agoTag(item.ts)}</span></div>
                <blockquote>“${esc(item.text)}”</blockquote>
                ${item.reason ? `<p class="reason">${esc(item.reason)}</p>` : ""}
                ${chips.length ? `<div class="msg-chips">${chips.join("")}</div>` : ""}
            </article>`;
        })
        .join("");
}

/**
 * Compact cards for the overview "talking" panel.
 * @param {any[]} feed
 * @param {number} [limit]
 * @returns {string}
 */
export function talkHtml(feed, limit = 8) {
    if (!feed.length) {
        return `<p class="empty">Quiet for now.</p>`;
    }
    return feed
        .slice(0, limit)
        .map(
            (item) => `<div class="talk">
                <div class="talk-head"><span>${who(item)}</span><span>${agoTag(item.ts)}</span></div>
                <p>${esc(item.text)}</p>
            </div>`,
        )
        .join("");
}

/**
 * Reviews table.
 * @param {any[]} reviews
 * @returns {string}
 */
export function reviewsHtml(reviews) {
    if (!reviews.length) {
        return `<p class="sub">No reviews yet.</p>`;
    }
    const rows = reviews
        .slice(0, 16)
        .map(
            (item) => `<tr>
                <td>${esc(item.project)}</td>
                <td>${esc(item.to || "")}</td>
                <td>${esc(item.kind)}</td>
                <td class="verdict-${esc(item.result || "")}">${esc(item.result || "")}</td>
                <td class="tone-muted">${agoTag(item.ts)}</td>
            </tr>`,
        )
        .join("");
    return `<table class="rows"><thead><tr><th>Project</th><th>Worker</th><th>Step</th><th>Verdict</th><th>When</th></tr></thead><tbody>${rows}</tbody></table>`;
}
