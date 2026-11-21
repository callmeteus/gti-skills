#!/usr/bin/env node
/**
 * Before and after diff of a rendered page, property by property: "button "Save": radius
 * 6 -> 14, width 72 -> 120". Run it once before the changes with --name before, then again
 * after with --compare <before.json>. Each run also saves a full-page screenshot next to the
 * JSON, so the report can show both states.
 *
 * Elements are matched by tag, label (text, aria-label, alt, or placeholder), and order,
 * not by class names, so a refactor that renames every class still lines up.
 *
 * Synced into the Frontend Design Review and Unslop Interface skills from
 * packages/lintapple/agent/scripts. Edit it there, then run `node packages/cli build`.
 *
 * Usage:
 *   node snapshot.mjs <url> [--name before] [--compare FILE] [--out DIR] [--project DIR]
 *                           [--viewport WxH] [--ready SELECTOR] [--json]
 *
 * Output goes to ~/.gti/lintapple/<project>/snapshots (GTI_HOME replaces ~/.gti), never
 * into the project.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadPlaywright } from "./probe.mjs";

/** Properties compared between the two states, with the unit used in the summary. */
export const PROPERTIES = ["x", "y", "width", "height", "radius", "background", "color", "border", "fontSize", "fontWeight", "shadow", "text"];

/**
 * Runs in the page. Captures every labeled element and every painted surface.
 * Kept free of outside references so Playwright can serialize it.
 */
export function capturePage() {
    const round = (value) => Math.round(value);
    const label = (el) => {
        const own = [...el.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent).join(" ").replace(/\s+/g, " ").trim();
        return (own || el.getAttribute("aria-label") || el.getAttribute("alt") || el.getAttribute("placeholder") || (el.matches("button, a, [role=button]") ? el.innerText : "") || "").replace(/\s+/g, " ").trim().slice(0, 40);
    };
    const counts = new Map();
    const elements = [];
    for (const el of document.querySelectorAll("body *")) {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        const text = label(el);
        const painted = style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.borderTopStyle !== "none" && parseFloat(style.borderTopWidth) > 0 || style.boxShadow !== "none";
        const control = el.matches("button, a, input, select, textarea, img, svg, [role=button]");
        if (!text && !(painted && rect.width >= 40 && rect.height >= 24) && !control) continue;
        const name = text || (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40);
        const base = `${el.tagName.toLowerCase()} "${name}"`;
        const index = counts.get(base) ?? 0;
        counts.set(base, index + 1);
        elements.push({
            key: index ? `${base} #${index + 1}` : base,
            x: round(rect.left + scrollX),
            y: round(rect.top + scrollY),
            width: round(rect.width),
            height: round(rect.height),
            radius: round(parseFloat(style.borderTopLeftRadius) || 0),
            background: style.backgroundColor,
            color: style.color,
            border: parseFloat(style.borderTopWidth) && style.borderTopStyle !== "none" ? `${round(parseFloat(style.borderTopWidth))}px ${style.borderTopColor}` : "none",
            fontSize: round(parseFloat(style.fontSize) || 0),
            fontWeight: style.fontWeight,
            shadow: style.boxShadow === "none" ? "none" : "shadow",
            text,
        });
    }
    return { url: location.href, viewport: { width: innerWidth, height: innerHeight }, elements };
}

/**
 * Compares two captures. Position changes of 2px or less are ignored.
 *
 * @returns {{ changed: {key: string, changes: {property: string, before: *, after: *}[]}[], added: string[], removed: string[] }}
 */
export function compare(before, after) {
    const old = new Map(before.elements.map((element) => [element.key, element]));
    const now = new Map(after.elements.map((element) => [element.key, element]));
    const changed = [];
    for (const [key, element] of now) {
        const previous = old.get(key);
        if (!previous) continue;
        const changes = PROPERTIES.filter((property) => {
            if (["x", "y", "width", "height"].includes(property)) return Math.abs(previous[property] - element[property]) > 2;
            return previous[property] !== element[property];
        }).map((property) => ({ property, before: previous[property], after: element[property] }));
        if (changes.length) changed.push({ key, changes });
    }
    return {
        changed,
        added: [...now.keys()].filter((key) => !old.has(key)),
        removed: [...old.keys()].filter((key) => !now.has(key)),
    };
}

/** Short text summary of a comparison. */
export function summarize(diff, limit = 40) {
    const lines = [`${diff.changed.length} element(s) changed, ${diff.added.length} added, ${diff.removed.length} removed`];
    for (const item of diff.changed.slice(0, limit)) {
        lines.push(`- ${item.key}: ${item.changes.map((change) => `${change.property} ${change.before} -> ${change.after}`).join("; ")}`);
    }
    if (diff.changed.length > limit) lines.push(`  ... ${diff.changed.length - limit} more; use --json for all`);
    if (diff.removed.length) lines.push(`removed: ${diff.removed.slice(0, 15).join(", ")}${diff.removed.length > 15 ? ", ..." : ""}`);
    if (diff.added.length) lines.push(`added: ${diff.added.slice(0, 15).join(", ")}${diff.added.length > 15 ? ", ..." : ""}`);
    return lines.join("\n");
}

function parseArgs(argv) {
    const options = { name: "before" };
    for (let index = 0; index < argv.length; index++) {
        const value = argv[index];
        const next = () => {
            if (index + 1 >= argv.length) throw new Error(`${value} needs a value`);
            return argv[++index];
        };
        if (value === "--name") options.name = next();
        else if (value === "--compare") options.compare = next();
        else if (value === "--out") options.out = next();
        else if (value === "--project") options.project = next();
        else if (value === "--ready") options.ready = next();
        else if (value === "--json") options.json = true;
        else if (value === "--viewport") {
            const match = next().match(/^(\d+)x(\d+)$/);
            if (!match) throw new Error("--viewport takes WIDTHxHEIGHT, for example 1440x900");
            options.viewport = { width: Number(match[1]), height: Number(match[2]) };
        } else if (value.startsWith("--")) throw new Error(`unknown option ${value}`);
        else if (!options.url) options.url = value;
        else throw new Error(`unexpected argument ${value}`);
    }
    if (options.compare && options.name === "before") options.name = "after";
    return options;
}

function defaultOut(project) {
    const home = process.env.GTI_HOME?.trim() ? resolve(process.env.GTI_HOME.trim()) : join(homedir(), ".gti");
    return join(home, "lintapple", basename(resolve(project)) || "project", "snapshots");
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
        console.error("Usage: snapshot.mjs <url> [--name before] [--compare FILE] [--out DIR] [--project DIR] [--viewport WxH] [--ready SELECTOR] [--json]");
        return 2;
    }
    const project = resolve(options.project ?? process.cwd());
    const playwright = await loadPlaywright(project);
    if (!playwright) {
        console.error("Playwright was not found in the project or in the gti-skills lintapple package. Build that package (npm ci there) or install playwright in the project, then run again.");
        return 2;
    }
    const out = resolve((options.out ?? defaultOut(project)).replace(/^~(?=[\\/]|$)/, homedir()));
    mkdirSync(out, { recursive: true });
    let browser;
    try {
        browser = await playwright.chromium.launch();
    } catch (error) {
        console.error(String(error.message ?? error));
        console.error("Chromium for Playwright is missing. Install it once with: npx playwright install chromium");
        return 2;
    }
    let capture;
    try {
        const page = await browser.newPage({ viewport: options.viewport ?? { width: 1440, height: 900 } });
        const response = await page.goto(options.url, { waitUntil: "load" });
        if ((response?.status() ?? 0) >= 400) {
            console.error(`The page answered HTTP ${response.status()}. It shows an error page, not the interface, so it was not captured.`);
            return 2;
        }
        if (options.ready) await page.waitForSelector(options.ready);
        await page.evaluate(() => document.fonts?.ready);
        capture = await page.evaluate(capturePage);
        await page.screenshot({ path: join(out, `${options.name}.png`), fullPage: true });
        await page.close();
    } catch (error) {
        console.error(`The snapshot did not finish: ${error.message ?? error}`);
        return 2;
    } finally {
        await browser.close();
    }
    const file = join(out, `${options.name}.json`);
    writeFileSync(file, `${JSON.stringify(capture, null, 2)}\n`);
    if (!options.compare) {
        console.log(`Captured ${capture.elements.length} element(s): ${file}\nScreenshot: ${join(out, `${options.name}.png`)}`);
        return 0;
    }
    const previousFile = resolve(options.compare.replace(/^~(?=[\\/]|$)/, homedir()));
    if (!existsSync(previousFile)) {
        console.error(`No snapshot at ${previousFile}. Run the first capture with --name before.`);
        return 2;
    }
    const diff = compare(JSON.parse(readFileSync(previousFile, "utf8")), capture);
    console.log(options.json ? JSON.stringify(diff, null, 2) : summarize(diff));
    console.log(`\nScreenshots: ${previousFile.replace(/\.json$/, ".png")} and ${join(out, `${options.name}.png`)}`);
    return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = await main(process.argv.slice(2));
}
