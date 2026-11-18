#!/usr/bin/env node
/**
 * Measures layout problems that need no data-ui-* markers: edges that almost line up,
 * blocks off the page's column lanes, wrapped rows that end short of their container,
 * one-side accent borders that curve around rounded corners or repeat inside each other,
 * rendered colors that match none of the page's color tokens (CSS custom properties),
 * instances of one component side by side whose size or inner parts do not match,
 * forms repeated inside every item of a list, and too many filled buttons competing on one view.
 *
 * lintapple measures alignment, gaps, and nested radii only on marked elements, and a
 * generated interface has no markers. This probe covers that gap. Its findings are
 * measurements with a position; the agent decides with the skill's rules whether each
 * one is a defect.
 *
 * Synced into the Frontend Design Review and Unslop Interface skills from
 * packages/lintapple/agent/scripts. Edit it there, then run `node packages/cli build`.
 *
 * Usage:
 *   node probe.mjs <url> [--project DIR] [--viewport WxH]... [--ready SELECTOR]
 *                        [--ignore SELECTOR] [--near PX] [--lane PX] [--json]
 *
 * Playwright is found in the project's node_modules, then in the gti-skills lintapple
 * package (lintapple.root next to this file). Nothing is written to the project.
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const DEFAULTS = {
    viewports: [{ width: 1440, height: 900 }],
    near: 12,
    lane: 64,
    ignore: [".leaflet-container", ".maplibregl-map", ".mapboxgl-map", ".gm-style", "[role=application]", "svg *"],
};

function packageRoot() {
    const pointer = join(here, "lintapple.root");
    if (!existsSync(pointer)) return null;
    const root = readFileSync(pointer, "utf8").trim();
    return root && existsSync(join(root, "package.json")) ? root : null;
}

/** Loads Playwright from the project, then from the gti-skills lintapple package. */
export async function loadPlaywright(project, root = packageRoot()) {
    for (const base of [project, root, join(here, "..", "..")].filter(Boolean)) {
        try {
            const require = createRequire(join(base, "package.json"));
            const module = await import(pathToFileURL(require.resolve("playwright")).href);
            return module.chromium ? module : module.default;
        } catch {
            // try the next location
        }
    }
    return null;
}

/**
 * Runs in the page. Collects visible boxes and returns raw findings.
 * Kept free of outside references so Playwright can serialize it.
 */
export function measurePage(options) {
    const ignore = options.ignore.join(", ");
    const round = (value) => Math.round(value * 2) / 2;
    const describe = (el) => {
        const parts = [];
        let node = el;
        for (let depth = 0; node && node.nodeType === 1 && depth < 3; depth++) {
            let part = node.tagName.toLowerCase();
            if (node.id) {
                parts.unshift(`${part}#${node.id}`);
                break;
            }
            const classes = [...node.classList].filter((name) => !/^(css|sc|jsx|svelte|astro)-/.test(name)).slice(0, 2);
            if (classes.length) part += `.${classes.join(".")}`;
            parts.unshift(part);
            node = node.parentElement;
        }
        const text = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 32);
        return text ? `${parts.join(" > ")} "${text}"` : parts.join(" > ");
    };
    const visible = (el, style, rect) => {
        if (rect.width < 1 || rect.height < 1) return false;
        if (style.visibility === "hidden" || style.display === "contents" || Number(style.opacity) === 0) return false;
        if (rect.right < 0 || rect.bottom < 0) return false;
        return !el.closest("[aria-hidden=true], [hidden]");
    };
    const alpha = (color) => {
        if (!color || color === "transparent") return 0;
        const match = color.match(/rgba?\(([^)]+)\)/);
        if (!match) return 1;
        const parts = match[1].split(/[ ,/]+/).filter(Boolean);
        return parts.length > 3 ? Number(parts[3]) : 1;
    };
    const sides = ["Top", "Right", "Bottom", "Left"];
    const borders = (style) => sides.map((side) => ({
        side: side.toLowerCase(),
        width: style[`border${side}Style`] === "none" ? 0 : parseFloat(style[`border${side}Width`]) || 0,
        color: style[`border${side}Color`],
    })).map((border) => ({ ...border, width: alpha(border.color) > 0 ? border.width : 0 }));
    const controls = new Set(["INPUT", "BUTTON", "SELECT", "TEXTAREA", "IMG", "VIDEO", "CANVAS", "IFRAME"]);

    const boxes = [];
    for (const el of document.querySelectorAll("body *")) {
        if (ignore && (el.matches(ignore) || el.closest(ignore))) continue;
        const style = getComputedStyle(el);
        if (style.display === "none") continue;
        const rect = el.getBoundingClientRect();
        if (!visible(el, style, rect)) continue;
        const floating = style.position === "absolute" || style.position === "fixed";
        const edges = borders(style);
        const painted = edges.some((border) => border.width > 0) || alpha(style.backgroundColor) > 0 || style.boxShadow !== "none" || controls.has(el.tagName);
        const ownText = [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
        const block = !style.display.startsWith("inline") || controls.has(el.tagName);
        boxes.push({ el, style, rect, floating, edges, surface: painted && block, text: ownText && block });
    }

    const findings = [];
    const add = (rule, items, actual, expected, fix) => findings.push({ rule, items: items.map((box) => ({ selector: describe(box.el), x: round(box.rect.left), y: round(box.rect.top), right: round(box.rect.right), bottom: round(box.rect.bottom) })), actual, expected, fix });
    const nested = (a, b) => a.el.contains(b.el) || b.el.contains(a.el);
    const overlapY = (a, b) => Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > 0;
    const overlapX = (a, b) => Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > 0;
    const textLeft = (box) => {
        if (box.surface || !box.text) return box.rect.left;
        const range = document.createRange();
        range.selectNodeContents(box.el);
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
        return rects.length ? Math.min(...rects.map((rect) => rect.left)) : box.rect.left;
    };

    // Edges that almost line up: two boxes, neither inside the other, stacked in one column
    // (left or right edges) or side by side in one row (top edges), a few pixels apart.
    const anchored = boxes.filter((box) => !box.floating && (box.surface || box.text) && box.rect.width >= 16);
    const seen = new Set();
    for (let i = 0; i < anchored.length; i++) {
        for (let j = i + 1; j < anchored.length; j++) {
            const a = anchored[i];
            const b = anchored[j];
            if (nested(a, b)) continue;
            const checks = [];
            if (!overlapY(a, b)) {
                checks.push(["left", textLeft(a), textLeft(b)]);
                if (a.surface && b.surface) checks.push(["right", a.rect.right, b.rect.right]);
            } else if (!overlapX(a, b) && a.surface && b.surface) {
                checks.push(["top", a.rect.top, b.rect.top]);
            }
            for (const [edge, first, second] of checks) {
                const distance = Math.abs(first - second);
                if (distance <= 1 || distance > options.near) continue;
                const key = `${edge}:${round(Math.min(first, second))}:${round(Math.max(first, second))}`;
                if (seen.has(key)) continue;
                seen.add(key);
                add("near-miss-edge", [a, b], `${edge} edges ${round(distance)}px apart (${round(first)} and ${round(second)})`, `the same ${edge} edge, or a clear offset from the spacing scale`, `Put both on one edge: give them the same container, padding, or grid column. If the offset is meant, make it a step on the spacing scale.`);
            }
        }
    }

    // Blocks off the column lanes: a wide surface whose left or right edge matches no lane
    // shared by two other surfaces in the same container, yet sits close to one. Items of a
    // wrapping row are left to the ragged-wrap check.
    const surfaces = new Set(boxes.filter((box) => box.surface).map((box) => box.el));
    const container = (el) => {
        for (let node = el.parentElement; node; node = node.parentElement) if (surfaces.has(node)) return node;
        return null;
    };
    const wrapItem = (el) => {
        const parent = el.parentElement && getComputedStyle(el.parentElement);
        return Boolean(parent && parent.display.includes("flex") && parent.flexWrap.startsWith("wrap"));
    };
    const blocks = boxes.filter((box) => !box.floating && box.surface && box.rect.width >= 120 && !box.style.display.startsWith("inline") && !wrapItem(box.el));
    const contexts = new Map();
    for (const box of blocks) {
        const key = container(box.el);
        contexts.set(key, [...(contexts.get(key) ?? []), box]);
    }
    for (const [edge, wide] of [...contexts.values()].flatMap((group) => [["left", group], ["right", group]])) {
        const counts = new Map();
        for (const box of wide) {
            const value = round(box.rect[edge]);
            counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        const lanes = [...counts.entries()].filter(([, count]) => count >= 2).map(([value]) => value);
        for (const box of wide) {
            const value = round(box.rect[edge]);
            if (counts.get(value) > 1) continue;
            const close = lanes.filter((lane) => Math.abs(lane - value) > options.near && Math.abs(lane - value) <= options.lane);
            if (!close.length) continue;
            const lane = close.sort((x, y) => Math.abs(x - value) - Math.abs(y - value))[0];
            const partners = wide.filter((other) => round(other.rect[edge]) === lane && !nested(other, box)).slice(0, 2);
            if (!partners.length) continue;
            add("off-lane", [box, ...partners], `${edge} edge at ${value}px, ${round(Math.abs(lane - value))}px from the lane at ${lane}px`, `the ${edge} edge on a lane other blocks use`, `Put the block in the page grid: align its ${edge} edge with the column at ${lane}px, or span the column it sits in.`);
        }
    }

    // Wrapped rows that end short of the container: a flex row that wraps, whose first line
    // stops a little before the container's inner edge.
    for (const box of boxes) {
        if (!box.style.display.includes("flex") || !box.style.flexWrap.startsWith("wrap") || box.style.flexDirection.startsWith("column")) continue;
        const items = [...box.el.children].map((el) => ({ el, rect: el.getBoundingClientRect() })).filter((item) => item.rect.width > 0 && item.rect.height > 0);
        if (items.length < 3) continue;
        const firstTop = Math.min(...items.map((item) => item.rect.top));
        const first = items.filter((item) => Math.abs(item.rect.top - firstTop) < 2);
        const rest = items.filter((item) => item.rect.top - firstTop >= 2);
        if (!rest.length) continue;
        const inner = box.rect.right - (parseFloat(box.style.paddingRight) || 0) - (parseFloat(box.style.borderRightWidth) || 0);
        const end = Math.max(...first.map((item) => item.rect.right));
        const gap = parseFloat(box.style.columnGap) || 0;
        const leftover = inner - end;
        if (leftover <= gap + 2) continue;
        add("ragged-wrap", [box], `first line ends ${round(leftover)}px before the container edge, ${rest.length} item(s) wrap to more lines`, "a row that fills its width, scrolls, or ends clearly short by design", "Keep the row on one line with horizontal scroll, move the less used items behind a More control, or lay the items on an even grid. Do not leave a ragged edge next to full-width blocks.");
    }

    // One-side accent borders on rounded boxes, and accents repeated inside accents.
    const accents = [];
    for (const box of boxes) {
        const drawn = box.edges.filter((border) => border.width > 0);
        const widest = drawn.sort((x, y) => y.width - x.width)[0];
        if (!widest || widest.width < 2) continue;
        const others = box.edges.filter((border) => border.side !== widest.side);
        const lone = others.every((border) => border.width === 0 || (border.width < widest.width && border.color !== widest.color));
        if (!lone) continue;
        const corners = { top: ["TopLeft", "TopRight"], right: ["TopRight", "BottomRight"], bottom: ["BottomLeft", "BottomRight"], left: ["TopLeft", "BottomLeft"] }[widest.side];
        const radius = Math.max(...corners.map((corner) => parseFloat(box.style[`border${corner}Radius`]) || 0));
        accents.push(box);
        if (radius >= 2) {
            add("curved-accent", [box], `${widest.width}px ${widest.side} accent border on ${radius}px rounded corners`, "a straight accent, or no accent", "A one-side border on a rounded box bends around the corners into a crescent. Square the corners on that side, draw the accent as an inset bar inside the padding, or remove it.");
        }
    }
    for (const box of accents) {
        const parent = accents.find((other) => other !== box && other.el.contains(box.el));
        if (parent) add("nested-accent", [parent, box], "an accent border inside a box that already has one", "one accent level", "Keep the accent on one level only, usually the outer group, and show the inner items with spacing or a plain border.");
    }

    // Instances of one component side by side: siblings with the same tag and classes, in one
    // row, must have the same size, and their matching parts must sit at the same height.
    const stateClass = /(^|-)(active|selected|open|current|disabled|checked|expanded)$|^(is|has)-/;
    const signature = (el) => `${el.tagName}.${[...el.classList].filter((name) => !/^(css|sc|jsx|svelte|astro)-/.test(name) && !stateClass.test(name)).sort().join(".")}`;
    const shown = (el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const parts = (root) => {
        const map = new Map();
        const order = [];
        const walk = (el, path) => {
            const counts = new Map();
            for (const child of el.children) {
                if (!shown(child)) continue;
                const sig = signature(child);
                const index = counts.get(sig) ?? 0;
                counts.set(sig, index + 1);
                const key = `${path}/${sig}[${index}]`;
                const rect = child.getBoundingClientRect();
                map.set(key, { el: child, top: rect.top - root.getBoundingClientRect().top, height: rect.height });
                order.push(key);
                walk(child, key);
            }
        };
        walk(root, "");
        return { map, order };
    };
    const visited = new Set();
    for (const parent of document.querySelectorAll("body, body *")) {
        if (ignore && (parent.matches(ignore) || parent.closest(ignore))) continue;
        const groups = new Map();
        for (const child of parent.children) {
            if (!shown(child)) continue;
            const style = getComputedStyle(child);
            if (style.position === "absolute" || style.position === "fixed") continue;
            const rect = child.getBoundingClientRect();
            if (rect.width < 120 || rect.height < 60 || !child.children.length) continue;
            const sig = signature(child);
            groups.set(sig, [...(groups.get(sig) ?? []), { el: child, rect }]);
        }
        for (const members of groups.values()) {
            if (members.length < 2) continue;
            const withFields = members.filter((member) => [...member.el.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select")].some(shown));
            if (withFields.length >= 2 && !visited.has(withFields[0].el.parentElement)) {
                visited.add(withFields[0].el.parentElement);
                const fields = withFields[0].el.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select").length;
                add("repeated-form", withFields.slice(0, 3).map((member) => ({ el: member.el, rect: member.rect })), `${withFields.length} items of one list each carry a form (${fields} field(s) in the first)`, "list items that show a summary and one action", "Show the facts to compare and one action per item. Open the form in a modal, sheet, or the item's detail page, for the item the user picked. Put advanced options (auto-bid, recurring, schedule) inside that form behind a toggle, not as a second form.");
            }
            const rows = [];
            for (const member of members) {
                const row = rows.find((items) => Math.min(items[0].rect.bottom, member.rect.bottom) - Math.max(items[0].rect.top, member.rect.top) > 0);
                if (row) row.push(member);
                else rows.push([member]);
            }
            for (const row of rows.filter((items) => items.length >= 2)) {
                if (visited.has(row[0].el)) continue;
                visited.add(row[0].el);
                const asBoxes = row.map((member) => ({ el: member.el, rect: member.rect }));
                const widths = row.map((member) => member.rect.width);
                const heights = row.map((member) => member.rect.height);
                const spread = (values) => Math.max(...values) - Math.min(...values);
                if (spread(widths) > 2 || spread(heights) > 2) {
                    const what = [spread(widths) > 2 ? `widths ${widths.map(round).join(", ")}` : "", spread(heights) > 2 ? `heights ${heights.map(round).join(", ")}` : ""].filter(Boolean).join("; ");
                    add("uneven-siblings", asBoxes.slice(0, 3), `${row.length} instances of one component in a row with ${what}`, "the same width and height for every instance in the row", "Give the instances equal tracks: a grid with equal columns and `align-items: stretch`, or the same fixed size. Let content fit inside the instance instead of resizing it.");
                }
                const first = parts(row[0].el);
                for (const other of row.slice(1)) {
                    const second = parts(other.el);
                    const key = first.order.find((name) => second.map.has(name) && Math.abs(first.map.get(name).top - second.map.get(name).top) > 2);
                    if (!key) continue;
                    const a = first.map.get(key);
                    const b = second.map.get(key);
                    const before = first.order.slice(0, first.order.indexOf(key)).reverse().find((name) => second.map.has(name) && Math.abs(first.map.get(name).height - second.map.get(name).height) > 2);
                    const cause = before ? `; the part before it, ${describe(first.map.get(before).el)}, is ${round(first.map.get(before).height)}px tall in one and ${round(second.map.get(before).height)}px in the other` : "";
                    add("misaligned-parts", [{ el: a.el, rect: a.el.getBoundingClientRect() }, { el: b.el, rect: b.el.getBoundingClientRect() }], `the same part sits ${round(a.top)}px from the top in one instance and ${round(b.top)}px in the other${cause}`, "matching parts of instances in a row at the same height", "Line the parts up across the row: use CSS subgrid (`grid-template-rows: subgrid` on each instance, spanning the parent's rows), give variable parts a fixed or minimum height, keep chip and tag rows to one line (`flex-wrap: nowrap` with a +N overflow), and push the footer down with `margin-top: auto`.");
                    break;
                }
            }
        }
    }

    // Filled buttons competing on one view: buttons and button-like links with a saturated
    // background, visible in the first viewport. More than two reads as no primary at all.
    const saturated = (color) => {
        const match = color && color.match(/rgba?\(([^)]+)\)/);
        if (!match) return false;
        const [r, g, b, a = 1] = match[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        if (a < 0.5) return false;
        const max = Math.max(r, g, b) / 255;
        const min = Math.min(r, g, b) / 255;
        const light = (max + min) / 2;
        const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
        return sat >= 0.35 && light > 0.15 && light < 0.85;
    };
    const filled = boxes.filter((box) => box.el.matches("button, [role=button], a, input[type=submit], input[type=button]") && saturated(box.style.backgroundColor) && box.rect.top < innerHeight && box.rect.bottom > 0);
    if (filled.length > 2) {
        add("competing-primaries", filled.slice(0, 4), `${filled.length} filled, saturated buttons in the first viewport`, "one primary action per view, two at most", "Keep one filled primary for the main task of the view. Make repeated item actions secondary (outline or plain), and move the rest into the item's detail, a modal, or an overflow menu.");
    }

    // Colors that match no token: every color custom property the page defines is resolved to
    // rgb, and each painted text, background, and border color must equal one of them.
    // Opacity is ignored, so a token used with transparency still counts as the token.
    const notes = [];
    const probeEl = document.createElement("span");
    document.body.appendChild(probeEl);
    const toRgb = (value) => {
        probeEl.style.color = "";
        probeEl.style.color = value;
        if (!probeEl.style.color) return null;
        const match = getComputedStyle(probeEl).color.match(/rgba?\(([^)]+)\)/);
        if (!match) return null;
        return match[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map((part) => Math.round(Number(part))).join(",");
    };
    const rgbOf = (color) => {
        const match = color && color.match(/rgba?\(([^)]+)\)/);
        if (!match) return null;
        const parts = match[1].split(/[ ,/]+/).filter(Boolean);
        if (parts.length > 3 && Number(parts[3]) === 0) return null;
        return parts.slice(0, 3).map((part) => Math.round(Number(part))).join(",");
    };
    const names = new Set();
    const collect = (rules) => {
        for (const rule of rules) {
            if (rule.style) for (const name of rule.style) if (name.startsWith("--")) names.add(name);
            if (rule.cssRules) collect(rule.cssRules);
        }
    };
    for (const sheet of document.styleSheets) {
        try {
            collect(sheet.cssRules);
        } catch {
            notes.push(`A style sheet from ${sheet.href} could not be read (cross-origin); its tokens are not known.`);
        }
    }
    const rootStyle = getComputedStyle(document.documentElement);
    const tokens = new Map();
    for (const name of names) {
        const value = rootStyle.getPropertyValue(name).trim();
        const rgb = value && toRgb(value);
        if (rgb && !tokens.has(rgb)) tokens.set(rgb, name);
    }
    probeEl.remove();
    if (!tokens.size) {
        notes.push("No color tokens (CSS custom properties with color values) were found, so off-token-color was not checked. Define the semantic tokens first.");
    } else {
        const misses = new Map();
        for (const box of boxes) {
            const used = [];
            if (box.text) used.push(["text", box.style.color]);
            if (alpha(box.style.backgroundColor) > 0) used.push(["background", box.style.backgroundColor]);
            for (const border of box.edges) if (border.width > 0) used.push([`border-${border.side}`, border.color]);
            for (const [property, color] of used) {
                const rgb = rgbOf(color);
                if (!rgb || tokens.has(rgb)) continue;
                const entry = misses.get(rgb) ?? { properties: new Set(), boxes: [] };
                entry.properties.add(property.startsWith("border") ? "border" : property);
                if (!entry.boxes.includes(box)) entry.boxes.push(box);
                misses.set(rgb, entry);
            }
        }
        for (const [rgb, entry] of misses) {
            add("off-token-color", entry.boxes.slice(0, 3), `rgb(${rgb}) as ${[...entry.properties].join(", ")} on ${entry.boxes.length} element(s), matching none of ${tokens.size} color tokens`, "a color from a semantic token (primary, secondary, info, warning, danger, success, muted, surface, text, border)", "Replace the raw color with the semantic token that says what it means. If no token fits, the color has no meaning: use a neutral token, or add the token to the design system first.");
        }
    }

    return { url: location.href, viewport: { width: innerWidth, height: innerHeight }, findings, notes, tokens: tokens.size };
}

/** Groups findings by rule and formats them for the agent. */
export function summarize(results) {
    const lines = [];
    for (const result of results) {
        lines.push(`Probed ${result.url} at ${result.viewport.width}x${result.viewport.height}: ${result.findings.length} finding(s), ${result.tokens ?? 0} color token(s) known`);
        for (const note of result.notes ?? []) lines.push(`note: ${note}`);
        const rules = [...new Set(result.findings.map((finding) => finding.rule))];
        for (const rule of rules) {
            const group = result.findings.filter((finding) => finding.rule === rule);
            lines.push("", `[${rule}] ${group.length}`);
            for (const finding of group.slice(0, 12)) {
                lines.push(`- ${finding.actual}`);
                for (const item of finding.items) lines.push(`    ${item.selector} @ x ${item.x}, y ${item.y}, right ${item.right}`);
                lines.push(`    fix: ${finding.fix}`);
            }
            if (group.length > 12) lines.push(`  ... ${group.length - 12} more; use --json for all`);
        }
        lines.push("");
    }
    return lines.join("\n").trimEnd();
}

function parseArgs(argv) {
    const options = { viewports: [], ignore: [...DEFAULTS.ignore], near: DEFAULTS.near, lane: DEFAULTS.lane };
    for (let index = 0; index < argv.length; index++) {
        const value = argv[index];
        const next = () => {
            if (index + 1 >= argv.length) throw new Error(`${value} needs a value`);
            return argv[++index];
        };
        if (value === "--project") options.project = next();
        else if (value === "--ready") options.ready = next();
        else if (value === "--ignore") options.ignore.push(next());
        else if (value === "--near") options.near = Number(next());
        else if (value === "--lane") options.lane = Number(next());
        else if (value === "--json") options.json = true;
        else if (value === "--viewport") {
            const match = next().match(/^(\d+)x(\d+)$/);
            if (!match) throw new Error("--viewport takes WIDTHxHEIGHT, for example 1440x900");
            options.viewports.push({ width: Number(match[1]), height: Number(match[2]) });
        } else if (value.startsWith("--")) throw new Error(`unknown option ${value}`);
        else if (!options.url) options.url = value;
        else throw new Error(`unexpected argument ${value}`);
    }
    if (!options.viewports.length) options.viewports = DEFAULTS.viewports;
    return options;
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
        console.error("Usage: probe.mjs <url> [--project DIR] [--viewport WxH]... [--ready SELECTOR] [--ignore SELECTOR] [--near PX] [--lane PX] [--json]");
        return 2;
    }
    const playwright = await loadPlaywright(resolve(options.project ?? process.cwd()));
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
    const results = [];
    try {
        for (const viewport of options.viewports) {
            const page = await browser.newPage({ viewport });
            await page.goto(options.url, { waitUntil: "load" });
            if (options.ready) await page.waitForSelector(options.ready);
            await page.evaluate(() => document.fonts?.ready);
            results.push(await page.evaluate(measurePage, { near: options.near, lane: options.lane, ignore: options.ignore }));
            await page.close();
        }
    } catch (error) {
        console.error(`The probe did not finish: ${error.message ?? error}`);
        return 2;
    } finally {
        await browser.close();
    }
    console.log(options.json ? JSON.stringify(results, null, 2) : summarize(results));
    return results.some((result) => result.findings.length) ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = await main(process.argv.slice(2));
}
