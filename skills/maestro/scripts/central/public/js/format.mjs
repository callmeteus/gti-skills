// Small formatting helpers shared by every view.

/**
 * The Maestro mark: a baton and the arc of a conducting gesture, drawn in currentColor.
 * The amber dot is the beat the gesture lands on.
 */
export const MAESTRO_MARK = `<svg class="mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <path d="M13 44 C 18 24, 34 14, 52 17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity="0.5"/>
    <path d="M18.2 47.6 L 46.7 14.7 Q 47.2 14.3 47.4 14.9 L 21 49.9 Z" fill="currentColor"/>
    <circle cx="19.6" cy="48.8" r="4.4" fill="currentColor"/>
    <circle cx="52" cy="17" r="2.4" fill="#f0b24a"/>
</svg>`;

const PALETTE = ["#c58a2c", "#4f84cf", "#8b6bb8", "#c4513f", "#4c978a", "#8a8a3c", "#b0668f", "#5b7f9e"];

/**
 * Escapes text for HTML.
 * @param {unknown} value
 * @returns {string}
 */
export function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * "34 s ago", "5 min ago", "2 h ago", or a date.
 * @param {string | null} ts
 * @param {number} [now]
 * @returns {string}
 */
export function ago(ts, now = Date.now()) {
    if (!ts) {
        return "";
    }
    const seconds = Math.max(0, Math.round((now - new Date(ts).getTime()) / 1000));
    if (seconds < 60) {
        return `${seconds} s ago`;
    }
    if (seconds < 3600) {
        return `${Math.floor(seconds / 60)} min ago`;
    }
    if (seconds < 86400) {
        return `${Math.floor(seconds / 3600)} h ago`;
    }
    return new Date(ts).toLocaleDateString();
}

/**
 * Short form of a path for headers: the home folder becomes `~`, and a long path keeps its first
 * folder and its last two parts around an ellipsis. Show the full path in a title next to it.
 * @param {string} path
 * @param {string} [home]
 * @param {number} [max]
 * @returns {string}
 */
export function shortPath(path, home, max = 42) {
    let value = String(path || "");
    if (home && value.toLowerCase().startsWith(home.toLowerCase())) {
        value = `~${value.slice(home.length)}`;
    }
    if (value.length <= max) {
        return value;
    }
    const sep = value.includes("\\") ? "\\" : "/";
    const parts = value.split(sep).filter(Boolean);
    if (parts.length <= 3) {
        return value;
    }
    return [parts[0], "…", ...parts.slice(-2)].join(sep);
}

/**
 * Formats a count with thousands separators.
 * @param {number} value
 * @returns {string}
 */
export function num(value) {
    return Number(value || 0).toLocaleString("en-US");
}

/**
 * Stable color for a project, by its position.
 * @param {number} index
 * @returns {string}
 */
export function colorAt(index) {
    return PALETTE[index % PALETTE.length];
}

/**
 * Model label without the provider when it is long.
 * @param {{ provider?: string, model?: string }} worker
 * @returns {string}
 */
export function modelLabel(worker) {
    if (!worker?.model) {
        return worker?.provider || "";
    }
    return worker.provider ? `${worker.provider}/${worker.model}` : worker.model;
}

/**
 * HTML for an "updated N s ago" label that the app refreshes every second.
 * @param {string | null} ts
 * @returns {string}
 */
export function agoTag(ts) {
    return `<span data-ago="${esc(ts || "")}">${esc(ago(ts))}</span>`;
}

/**
 * A short line for a worker seat: what it is doing now.
 * @param {any} worker
 * @returns {string}
 */
export function seatLine(worker) {
    const state = worker.state?.label || worker.status || "idle";
    if (worker.active && worker.task) {
        return `${state}: ${worker.task}`;
    }
    return state;
}
