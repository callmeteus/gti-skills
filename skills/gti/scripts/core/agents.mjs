/**
 * MCP registrations in coding agent configs: find, update, and add entries.
 *
 * Supported files (user level): OpenCode opencode.json, Claude Code ~/.claude.json,
 * Cursor ~/.cursor/mcp.json, Kiro ~/.kiro/settings/mcp.json, Antigravity
 * ~/.gemini/antigravity/mcp_config.json, and Codex ~/.codex/config.toml.
 * Every write keeps a timestamped backup next to the file and replaces it atomically.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const AGENTS = {
    opencode: { label: "OpenCode", path: (home) => join(home, ".config", "opencode", "opencode.json"), kind: "opencode" },
    claude: { label: "Claude Code", path: (home) => join(home, ".claude.json"), kind: "claude" },
    cursor: { label: "Cursor", path: (home) => join(home, ".cursor", "mcp.json"), kind: "mcpServers" },
    kiro: { label: "Kiro", path: (home) => join(home, ".kiro", "settings", "mcp.json"), kind: "mcpServers" },
    antigravity: { label: "Antigravity", path: (home) => join(home, ".gemini", "antigravity", "mcp_config.json"), kind: "mcpServers" },
    codex: { label: "Codex", path: (home) => join(home, ".codex", "config.toml"), kind: "toml" },
};

export const MANUAL_AGENTS = ["cline", "kilo", "copilot", "muse"];

/** Agents whose config file exists in this home folder. */
export function existingAgents(home) {
    return Object.keys(AGENTS).filter((id) => existsSync(AGENTS[id].path(home)));
}

// ---------- JSON configs ----------

function jsonContainer(kind, data, create) {
    if (kind === "opencode") {
        // This OpenCode writes mcp.servers; the upstream format is mcp.<name>. Keep whichever the file uses.
        if (data.mcp?.servers && typeof data.mcp.servers === "object") return data.mcp.servers;
        if (data.mcp && typeof data.mcp === "object" && Object.keys(data.mcp).length > 0) return data.mcp;
        if (!create) return null;
        data.mcp = data.mcp ?? {};
        data.mcp.servers = {};
        return data.mcp.servers;
    }
    if (!data.mcpServers && create) data.mcpServers = {};
    return data.mcpServers ?? null;
}

function entryCommand(kind, entry) {
    if (kind === "opencode") return Array.isArray(entry?.command) ? entry.command : [];
    return [entry?.command, ...(Array.isArray(entry?.args) ? entry.args : [])].filter(Boolean);
}

function makeEntry(kind, previous, python, script) {
    if (kind === "opencode") return { ...previous, type: "local", command: [python, script], enabled: previous?.enabled ?? true };
    if (kind === "claude") return { type: "stdio", env: {}, ...previous, command: python, args: [script] };
    return { ...previous, command: python, args: [script] };
}

// ---------- Codex TOML ----------

function tomlSections(text) {
    const lines = text.split(/\r?\n/);
    const sections = [];
    lines.forEach((line, index) => {
        const match = line.match(/^\s*\[mcp_servers\.(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))\]\s*$/);
        if (match) sections.push({ name: match[1] ?? match[2] ?? match[3], start: index });
    });
    for (const section of sections) {
        let end = lines.length;
        for (let index = section.start + 1; index < lines.length; index++) {
            if (/^\s*\[/.test(lines[index])) {
                end = index;
                break;
            }
        }
        section.end = end;
    }
    return { lines, sections };
}

function tomlValue(raw) {
    raw = raw.trim();
    if (raw.startsWith("[")) return [...raw.matchAll(/'([^']*)'|"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1] ?? m[2].replace(/\\\\/g, "\\"));
    const match = raw.match(/^'([^']*)'|^"((?:[^"\\]|\\.)*)"/);
    return match ? match[1] ?? match[2].replace(/\\\\/g, "\\") : raw;
}

function tomlString(value) {
    return value.includes("'") ? JSON.stringify(value) : `'${value}'`;
}

function tomlEntries(text) {
    const { lines, sections } = tomlSections(text);
    return sections.map((section) => {
        let command = null;
        let args = [];
        for (let index = section.start + 1; index < section.end; index++) {
            const match = lines[index].match(/^\s*(command|args)\s*=\s*(.+)$/);
            if (match?.[1] === "command") command = tomlValue(match[2]);
            if (match?.[1] === "args") args = tomlValue(match[2]);
        }
        return { key: section.name, command: [command, ...args].filter(Boolean) };
    });
}

function tomlSet(text, key, python, script) {
    const { lines, sections } = tomlSections(text);
    const section = sections.find((s) => s.name === key);
    const commandLine = `command = ${tomlString(python)}`;
    const argsLine = `args = [${tomlString(script)}]`;
    if (!section) {
        const trimmed = text.replace(/\s*$/, "");
        return `${trimmed}${trimmed ? "\n\n" : ""}[mcp_servers.${/^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key)}]\n${commandLine}\n${argsLine}\n`;
    }
    const body = lines.slice(section.start + 1, section.end).filter((line) => !/^\s*(command|args)\s*=/.test(line));
    const updated = [...lines.slice(0, section.start + 1), commandLine, argsLine, ...body, ...lines.slice(section.end)];
    return updated.join("\n");
}

// ---------- shared API ----------

export function readConfig(agent, home) {
    const spec = AGENTS[agent];
    const file = spec.path(home);
    if (!existsSync(file)) return null;
    const text = readFileSync(file, "utf8");
    if (spec.kind === "toml") return { agent, file, kind: spec.kind, text };
    try {
        return { agent, file, kind: spec.kind, data: text.trim() ? JSON.parse(text) : {} };
    } catch {
        return { agent, file, kind: spec.kind, error: "the file is not plain JSON (comments?); edit it by hand" };
    }
}

/** Every MCP entry in the config, as { key, command: [program, ...args] }. */
export function listEntries(config) {
    if (!config || config.error) return [];
    if (config.kind === "toml") return tomlEntries(config.text);
    const container = jsonContainer(config.kind, config.data, false) ?? {};
    return Object.entries(container).map(([key, entry]) => ({ key, command: entryCommand(config.kind, entry) }));
}

/** Entries that belong to an MCP: same key as one of its aliases, or a path through its folder. */
export function matchEntries(config, mcp) {
    const aliases = mcp.aliases.map((a) => a.toLowerCase());
    const folder = new RegExp(`[\\\\/]${mcp.folder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\\\/]`, "i");
    return listEntries(config).filter((entry) => aliases.includes(entry.key.toLowerCase()) || entry.command.some((part) => folder.test(String(part))));
}

/** Sets an entry in memory. Returns true when something changed. */
export function setEntry(config, key, python, script) {
    if (config.kind === "toml") {
        const next = tomlSet(config.text, key, python, script);
        const changed = next !== config.text;
        config.text = next;
        return changed;
    }
    const container = jsonContainer(config.kind, config.data, true);
    const before = JSON.stringify(container[key] ?? null);
    container[key] = makeEntry(config.kind, container[key], python, script);
    return JSON.stringify(container[key]) !== before;
}

/** Writes the config back, keeping a timestamped backup of the previous file. */
export function writeConfig(config, stamp = new Date().toISOString().replace(/[:.]/g, "-")) {
    const text = config.kind === "toml" ? config.text : `${JSON.stringify(config.data, null, 2)}\n`;
    mkdirSync(dirname(config.file), { recursive: true });
    let backup = null;
    if (existsSync(config.file)) {
        backup = `${config.file}.gti-backup-${stamp}`;
        copyFileSync(config.file, backup);
    }
    const temp = `${config.file}.gti-tmp`;
    writeFileSync(temp, text);
    renameSync(temp, config.file);
    return backup;
}

/** Script path an entry runs, the last argument ending in .py. */
export function entryScript(entry) {
    return [...entry.command].reverse().find((part) => /\.py$/i.test(String(part))) ?? null;
}
