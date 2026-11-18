#!/usr/bin/env node
/**
 * Finds colors in UI source code that do not come from a token: hex, rgb(), hsl(), oklch(),
 * and other color literals, Tailwind palette classes (bg-red-500), and arbitrary values
 * (bg-[#7c3aed]). It also lists the color tokens the project defines and the semantic roles
 * that are missing from them.
 *
 * Token definitions are allowed: a CSS custom property line (`--primary: #2563eb;`) and the
 * files given with --allow (by default the Tailwind config and files whose name contains
 * "token" or "theme").
 *
 * Synced into the Frontend Design Review and Unslop Interface skills from
 * packages/lintapple/agent/scripts. Edit it there, then run `node packages/cli build`.
 *
 * Usage:
 *   node tokens.mjs [DIR] [--allow TEXT]... [--json]
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROLES = {
    primary: ["primary", "brand", "accent"],
    secondary: ["secondary"],
    info: ["info"],
    warning: ["warning", "warn", "caution"],
    danger: ["danger", "error", "destructive", "critical"],
    success: ["success", "positive"],
    muted: ["muted", "subtle"],
    surface: ["surface", "background", "bg", "card", "panel"],
    text: ["text", "foreground", "fg", "ink"],
    border: ["border", "outline", "divider", "stroke"],
};

const SOURCE = new Set([".css", ".scss", ".sass", ".less", ".pcss", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro", ".html", ".erb", ".blade.php", ".php"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", ".next", ".nuxt", ".svelte-kit", ".astro", "coverage", "vendor", ".turbo", ".cache", "public"]);
const DEFAULT_ALLOW = ["tailwind.config", "token", "theme"];
const PALETTE = "slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const UTILITY = "bg|text|border(?:-[trblxyse])?|ring|ring-offset|fill|stroke|from|via|to|outline|decoration|divide|placeholder|caret|accent|shadow";

const patterns = [
    { kind: "palette-class", regex: new RegExp(`(?<![\\w-])(?:[a-z0-9-]+:)*(?:${UTILITY})-(?:${PALETTE})-(?:50|[1-9]00|950)(?:\\/\\d+)?(?![\\w-])`, "g") },
    { kind: "palette-class", regex: new RegExp(`(?<![\\w-])(?:[a-z0-9-]+:)*(?:${UTILITY})-(?:black|white)(?:\\/\\d+)?(?![\\w-])`, "g") },
    { kind: "arbitrary-color", regex: new RegExp(`(?<![\\w-])(?:[a-z0-9-]+:)*(?:${UTILITY})-\\[(?:#|rgb|hsl|oklch|oklab|lab|lch|color\\()[^\\]]*\\]`, "g") },
    { kind: "raw-color", regex: /(?<![\w&-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g },
    { kind: "raw-color", regex: /(?<![\w-])(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(\s*[\d.]/g },
];

/** Lists source files under a folder, skipping build output and dependencies. */
export function listFiles(root) {
    const files = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            if (SKIP_DIRS.has(name) || name.startsWith(".")) continue;
            const path = join(dir, name);
            const info = statSync(path);
            if (info.isDirectory()) walk(path);
            else if (SOURCE.has(extname(name)) && !name.endsWith(".min.js") && !name.endsWith(".d.ts") && !/\.(test|spec|stories)\./.test(name)) files.push(path);
        }
    };
    walk(root);
    return files;
}

/** Scans one file's text. Returns findings and the color tokens it defines. */
export function scanText(text, allowed = false) {
    const findings = [];
    const tokens = [];
    const lines = text.split(/\r?\n/);
    lines.forEach((raw, index) => {
        for (const definition of raw.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) {
            if (/#|rgb|hsl|oklch|oklab|lab\(|lch\(|var\(--/.test(definition[2])) tokens.push(definition[1]);
        }
        const line = raw.replace(/--[\w-]+\s*:\s*[^;}]+;?/g, (text) => " ".repeat(text.length));
        if (allowed || /^\s*(\/\/|\*|\/\*)/.test(line) || /\burl\(/.test(line)) return;
        for (const { kind, regex } of patterns) {
            for (const match of line.matchAll(regex)) {
                if (kind === "raw-color" && /^#\d+$/.test(match[0]) && !/color|background|border|fill|stroke|shadow|#\d{6}/.test(line)) continue;
                findings.push({ kind, line: index + 1, column: match.index + 1, value: match[0].trim() });
            }
        }
    });
    return { findings, tokens };
}

/** Which semantic roles have no token among the defined names. */
export function missingRoles(tokens) {
    const names = tokens.map((name) => name.toLowerCase());
    return Object.entries(ROLES).filter(([, words]) => !names.some((name) => words.some((word) => name.includes(word)))).map(([role]) => role);
}

export function scan(root, allow = DEFAULT_ALLOW) {
    const results = [];
    const tokens = new Set();
    for (const file of listFiles(root)) {
        const rel = relative(root, file).split("\\").join("/");
        const allowed = allow.some((text) => rel.toLowerCase().includes(text.toLowerCase()));
        const { findings, tokens: defined } = scanText(readFileSync(file, "utf8"), allowed);
        defined.forEach((name) => tokens.add(name));
        if (findings.length) results.push({ file: rel, findings });
    }
    return { root, tokens: [...tokens].sort(), missing: missingRoles([...tokens]), files: results };
}

export function summarize(report) {
    const total = report.files.reduce((sum, file) => sum + file.findings.length, 0);
    const lines = [`Scanned ${report.root}: ${total} color(s) outside tokens in ${report.files.length} file(s)`];
    lines.push(`Color tokens defined: ${report.tokens.length ? report.tokens.join(", ") : "none"}`);
    if (report.missing.length) lines.push(`Semantic roles with no token: ${report.missing.join(", ")}`);
    for (const file of report.files) {
        lines.push("", file.file);
        for (const finding of file.findings.slice(0, 20)) lines.push(`  ${finding.line}:${finding.column} [${finding.kind}] ${finding.value}`);
        if (file.findings.length > 20) lines.push(`  ... ${file.findings.length - 20} more; use --json for all`);
    }
    if (total) lines.push("", "fix: replace each color with the semantic token that says what it means (primary, secondary, info, warning, danger, success, muted, surface, text, border). A color with no meaning becomes a neutral token. Add a missing role to the token file first, never inline.");
    return lines.join("\n");
}

export function main(argv) {
    const options = { allow: [...DEFAULT_ALLOW], json: false };
    for (let index = 0; index < argv.length; index++) {
        const value = argv[index];
        if (value === "--allow") {
            if (index + 1 >= argv.length) {
                console.error("Error: --allow needs a value");
                return 2;
            }
            options.allow.push(argv[++index]);
        } else if (value === "--json") options.json = true;
        else if (value.startsWith("--")) {
            console.error(`Error: unknown option ${value}`);
            return 2;
        } else options.root = value;
    }
    const root = resolve(options.root ?? process.cwd());
    const report = scan(root, options.allow);
    console.log(options.json ? JSON.stringify(report, null, 2) : summarize(report));
    return report.files.length || report.missing.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = main(process.argv.slice(2));
}
