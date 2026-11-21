import * as antigravity from "./antigravity.mjs";
import * as claude from "./claude.mjs";
import * as codex from "./codex.mjs";
import * as copilot from "./copilot.mjs";
import * as cursor from "./cursor.mjs";
import * as kiro from "./kiro.mjs";

/** Adapters for the agents that expose a command hook with JSON on stdin. */
export const adapters = { claude, codex, cursor, copilot, kiro, antigravity };

/**
 * Looks up an adapter by agent id.
 *
 * @param {string} id Agent id
 * @returns {object|null} Adapter or null
 */
export function getAdapter(id) {
    return adapters[id] ?? null;
}
