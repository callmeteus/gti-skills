#!/usr/bin/env node
/**
 * Maps every page of a running app for a full review: starts at one URL, follows the links
 * each rendered page shows (so client-side routes count), groups URLs into route patterns
 * ("/tasks/:id"), visits one sample per pattern, and writes the page list with what each page
 * holds (tabs, dialogs, forms, tables) so every state gets reviewed, not only the first screen.
 *
 * It never follows links that sign out or delete, never leaves the start origin, and never
 * submits a form. Pages behind a login use a Playwright storage state file (--storage-state).
 *
 * Synced into the Frontend Design Review and Unslop Interface skills from
 * packages/lintapple/agent/scripts. Edit it there, then run `node packages/cli build`.
 *
 * Usage:
 *   node crawl.mjs <url> [--max N] [--depth N] [--storage-state FILE] [--include REGEX]
 *                        [--exclude REGEX] [--keep-query] [--project DIR] [--out DIR] [--json]
 *
 * Output goes to ~/.gti/lintapple/<project>/pages.json and pages.md (GTI_HOME replaces
 * ~/.gti), never into the project.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadPlaywright } from "./probe.mjs";

/** Links never followed: they sign out, delete, or change data on a GET. */
export const UNSAFE = /(log-?out|sign-?out|sair|desconectar|delete|excluir|apagar|remove|remover|destroy|unsubscribe|cancel-?account|reset)/i;

/** Path segments that hold an ID, a number, a hash, or a UUID, replaced by ":id" in a pattern. */
const ID_SEGMENT = /^(\d+|[0-9a-f]{8,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[\w-]*\d[\w-]*-[\w-]+)(\.\w+)?$/i;

/**
 * Turns a URL into its route pattern: "/tasks/ac027a63-8a27-42aa-8c9b-b010b97e1276" becomes
 * "/tasks/:id". The query string is kept only when keepQuery is set.
 *
 * @param {string} href absolute URL
 * @param {{ keepQuery?: boolean }} [options]
 * @returns {string}
 */
export function routePattern(href, options = {}) {
    const url = new URL(href);
    const path = url.pathname.split("/").map((segment) => (segment && ID_SEGMENT.test(decodeURIComponent(segment)) ? ":id" : segment)).join("/");
    return `${path}${options.keepQuery && url.search ? url.search : ""}`;
}

/**
 * Resolves a link and returns the URL to visit, or null when it leaves the scope, is unsafe,
 * or is not a page.
 *
 * @param {string} href the link's href
 * @param {string} base the page that holds the link
 * @param {{ scope: string, keepQuery?: boolean, include?: RegExp, exclude?: RegExp, text?: string }} options
 * @returns {string | null}
 */
export function nextUrl(href, base, options) {
    if (!href || /^(mailto|tel|javascript|data):/i.test(href)) return null;
    let url;
    try {
        url = new URL(href, base);
    } catch {
        return null;
    }
    url.hash = "";
    if (!options.keepQuery) url.search = "";
    const value = url.href;
    if (!value.startsWith(options.scope)) return null;
    if (/\.(png|jpe?g|gif|svg|webp|avif|ico|pdf|zip|gz|csv|xlsx?|docx?|mp4|webm|mp3|woff2?|ttf|css|js|json|xml|txt)$/i.test(url.pathname)) return null;
    if (UNSAFE.test(url.pathname) || UNSAFE.test(options.text ?? "")) return null;
    if (options.include && !options.include.test(value)) return null;
    if (options.exclude && options.exclude.test(value)) return null;
    return value;
}

/** Runs in the page: links and the states the page can show. */
function readPage() {
    const shown = (el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    return {
        title: document.title,
        heading: document.querySelector("h1")?.innerText.trim().replace(/\s+/g, " ").slice(0, 80) ?? "",
        links: [...document.querySelectorAll("a[href], area[href]")].map((a) => ({ href: a.getAttribute("href"), text: (a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 60) })),
        states: {
            tabs: [...document.querySelectorAll("[role=tab]")].filter(shown).length,
            dialogs: [...document.querySelectorAll("[aria-haspopup=dialog], [data-bs-toggle=modal], [data-toggle=modal], button[aria-controls]")].filter(shown).length,
            menus: [...document.querySelectorAll("[aria-haspopup=menu], [aria-haspopup=true], details > summary")].filter(shown).length,
            forms: [...document.querySelectorAll("form")].filter(shown).length,
            tables: [...document.querySelectorAll("table, [role=grid], [role=table]")].filter(shown).length,
        },
    };
}

/**
 * Crawls from a start URL with an open Playwright browser.
 *
 * @param {object} browser Playwright browser
 * @param {string} start the first URL
 * @param {{ max?: number, depth?: number, storageState?: string, include?: RegExp, exclude?: RegExp, keepQuery?: boolean, viewport?: object }} [options]
 * @returns {Promise<{ start: string, pages: object[], skipped: object }>}
 */
export async function crawl(browser, start, options = {}) {
    const max = options.max ?? 200;
    const depth = options.depth ?? 6;
    const first = new URL(start);
    const scope = first.protocol === "file:" ? first.href.slice(0, first.href.lastIndexOf("/") + 1) : `${first.origin}/`;
    const context = await browser.newContext({ viewport: options.viewport ?? { width: 1440, height: 900 }, ...(options.storageState ? { storageState: options.storageState } : {}) });
    const patterns = new Map();
    const queue = [{ url: nextUrl(start, start, { scope, keepQuery: options.keepQuery }) ?? start, depth: 0, from: null }];
    const skipped = { unsafe: 0, outside: 0, beyondMax: 0 };
    try {
        while (queue.length) {
            const item = queue.shift();
            const pattern = routePattern(item.url, options);
            const known = patterns.get(pattern);
            if (known) {
                if (!known.samples.includes(item.url)) known.samples.push(item.url);
                continue;
            }
            if (patterns.size >= max) {
                skipped.beyondMax++;
                continue;
            }
            const entry = { pattern, url: item.url, from: item.from, depth: item.depth, samples: [item.url], status: 0, title: "", heading: "", states: {}, links: 0 };
            patterns.set(pattern, entry);
            const page = await context.newPage();
            try {
                const response = await page.goto(item.url, { waitUntil: "load" });
                entry.status = response?.status() ?? 0;
                await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
                const found = await page.evaluate(readPage);
                entry.title = found.title;
                entry.heading = found.heading;
                entry.states = found.states;
                entry.links = found.links.length;
                entry.finalUrl = page.url();
                if (item.depth >= depth) continue;
                for (const link of found.links) {
                    const resolved = nextUrl(link.href, page.url(), { scope, keepQuery: options.keepQuery, include: options.include, exclude: options.exclude, text: link.text });
                    if (!resolved) {
                        try {
                            const raw = new URL(link.href, page.url());
                            if (!/^(https?|file):$/.test(raw.protocol)) continue;
                            if (!raw.href.startsWith(scope)) skipped.outside++;
                            else if (UNSAFE.test(raw.pathname) || UNSAFE.test(link.text)) skipped.unsafe++;
                        } catch {
                            // not a URL; nothing to count
                        }
                        continue;
                    }
                    queue.push({ url: resolved, depth: item.depth + 1, from: pattern });
                }
            } catch (error) {
                entry.error = String(error.message ?? error).split("\n")[0];
            } finally {
                await page.close();
            }
        }
    } finally {
        await context.close();
    }
    return { start, pages: [...patterns.values()], skipped };
}

/** Markdown page list: one row per route pattern, with the states to review on it. */
export function toMarkdown(result) {
    const lines = [`# Pages of ${result.start}`, "", `${result.pages.length} route pattern(s). Review every row in full mode, including each state listed.`, "", "| Pattern | Sample | Status | Heading | Samples | States to review |", "|---------|--------|--------|---------|---------|------------------|"];
    for (const page of result.pages) {
        const states = Object.entries(page.states ?? {}).filter(([, count]) => count > 0).map(([name, count]) => `${count} ${name}`).join(", ") || "none";
        lines.push(`| \`${page.pattern}\` | ${page.url} | ${page.error ? `error: ${page.error}` : page.status} | ${(page.heading || page.title || "").replace(/\|/g, "/")} | ${page.samples.length} | ${states} |`);
    }
    lines.push("", `Not followed: ${result.skipped.unsafe} sign-out or delete link(s), ${result.skipped.outside} link(s) outside the app, ${result.skipped.beyondMax} page(s) beyond --max.`);
    return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
    const options = {};
    for (let index = 0; index < argv.length; index++) {
        const value = argv[index];
        const next = () => {
            if (index + 1 >= argv.length) throw new Error(`${value} needs a value`);
            return argv[++index];
        };
        if (value === "--max") options.max = Number(next());
        else if (value === "--depth") options.depth = Number(next());
        else if (value === "--storage-state") options.storageState = resolve(next());
        else if (value === "--include") options.include = new RegExp(next());
        else if (value === "--exclude") options.exclude = new RegExp(next());
        else if (value === "--keep-query") options.keepQuery = true;
        else if (value === "--project") options.project = next();
        else if (value === "--out") options.out = next();
        else if (value === "--json") options.json = true;
        else if (value.startsWith("--")) throw new Error(`unknown option ${value}`);
        else if (!options.url) options.url = value;
        else throw new Error(`unexpected argument ${value}`);
    }
    return options;
}

function defaultOut(project) {
    const home = process.env.GTI_HOME?.trim() ? resolve(process.env.GTI_HOME.trim()) : join(homedir(), ".gti");
    return join(home, "lintapple", basename(resolve(project)) || "project");
}

export async function main(argv) {
    let options;
    try {
        options = parseArgs(argv);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        return 2;
    }
    if (!options.url) {
        console.error("Usage: crawl.mjs <url> [--max N] [--depth N] [--storage-state FILE] [--include REGEX] [--exclude REGEX] [--keep-query] [--project DIR] [--out DIR] [--json]");
        return 2;
    }
    const project = resolve(options.project ?? process.cwd());
    const playwright = await loadPlaywright(project);
    if (!playwright) {
        console.error("Playwright was not found in the project or in the gti-skills lintapple package. Build that package (npm ci there) or install playwright in the project, then run again.");
        return 2;
    }
    let browser;
    try {
        browser = await playwright.chromium.launch();
    } catch (error) {
        console.error(String(error.message ?? error));
        console.error("Chromium for Playwright is missing. Install it once with: npx playwright install chromium");
        return 2;
    }
    let result;
    try {
        result = await crawl(browser, options.url, options);
    } finally {
        await browser.close();
    }
    const out = resolve((options.out ?? defaultOut(project)).replace(/^~(?=[\\/]|$)/, homedir()));
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "pages.json"), `${JSON.stringify(result, null, 2)}\n`);
    writeFileSync(join(out, "pages.md"), toMarkdown(result));
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else console.log(`${toMarkdown(result)}\nWritten: ${join(out, "pages.md")} and pages.json`);
    return result.pages.length ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = await main(process.argv.slice(2));
}
