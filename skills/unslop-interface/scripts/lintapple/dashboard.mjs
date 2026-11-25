/**
 * Dashboard and generic-page tells for the layout probe: KPI cards with a number and no
 * comparison, more headline KPIs than a reader can hold, SVG charts with no axis values or
 * labels, links and buttons that end in an arrow, and headings with one accented word.
 *
 * `measureDashboard` runs in the page through Playwright, so it keeps no outside references.
 * probe.mjs merges its findings into the probe report.
 *
 * Synced into the Frontend Design Review and Unslop Interface skills from
 * packages/lintapple/agent/scripts. Edit it there, then run `node packages/cli build`.
 */

/**
 * Measures dashboard tells on the current page.
 *
 * @param {{ ignore?: string[] }} options selectors to skip, as in the layout probe
 * @returns {{ rule: string, items: object[], actual: string, expected: string, fix: string }[]}
 */
export function measureDashboard(options = {}) {
    const ignore = (options.ignore ?? []).join(", ");
    const findings = [];
    const round = (value) => Math.round(value * 2) / 2;
    const shown = (el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && !el.closest("[aria-hidden=true], [hidden]");
    };
    const skipped = (el) => Boolean(ignore && el.closest(ignore));
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
        const text = (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 32);
        return text ? `${parts.join(" > ")} "${text}"` : parts.join(" > ");
    };
    const box = (el) => {
        const rect = el.getBoundingClientRect();
        return { selector: describe(el), x: round(rect.left), y: round(rect.top), right: round(rect.right), bottom: round(rect.bottom) };
    };
    const add = (rule, elements, actual, expected, fix) => findings.push({ rule, items: elements.map(box), actual, expected, fix });
    const ownText = (el) => [...el.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent).join(" ").replace(/\s+/g, " ").trim();
    const signature = (el) => `${el.tagName}.${[...el.classList].sort().join(".")}`;

    // KPI cards: a large number (24px or more) inside one of three or more sibling cards.
    const numberPattern = /^[+-]?\s*(R\$|US\$|\$|€|£|¥)?\s*\d[\d.,\s]*\s*(%|k|K|mil|M|mi|B|bi|x|pts?)?$/;
    const values = [...document.querySelectorAll("body *")].filter((el) => {
        const text = ownText(el);
        return text && text.length <= 16 && numberPattern.test(text) && !skipped(el) && shown(el) && parseFloat(getComputedStyle(el).fontSize) >= 24;
    });
    const cardOf = (value) => {
        for (let node = value.parentElement, depth = 0; node && node !== document.body && depth < 5; node = node.parentElement, depth++) {
            const twins = [...(node.parentElement?.children ?? [])].filter((child) => child !== node && signature(child) === signature(node) && shown(child));
            if (twins.length >= 2) return node;
        }
        return null;
    };
    const cards = new Map();
    for (const value of values) {
        const card = cardOf(value);
        if (card && !cards.has(card)) cards.set(card, value);
    }
    const context = /([▲▼↑↓]|[+−-]\s?\d|\d\s?%|\bvs\.?(?=\s|$)|versus|\bmeta\b|target|goal|objetivo|anterior|previous|prior|last (week|month|quarter|year|period)|semana passada|mês passado|ano passado|ontem|yesterday)/i;
    const bare = [...cards].filter(([card, value]) => {
        if (card.querySelector("svg, canvas, progress, meter, [role=progressbar], [role=meter]")) return false;
        const rest = card.innerText.replace(ownText(value), " ");
        return !context.test(rest);
    }).map(([card]) => card);
    if (bare.length) add("kpi-without-context", bare.slice(0, 4), `${bare.length} of ${cards.size} KPI card(s) show a number with no comparison, target, or trend`, "each KPI with its period and a comparison: a delta against the previous period, a target, or a sparkline", "Add the comparison that makes the number readable: \"+8% vs last month\", \"72 of 100 target\", or a small trend line, with the period in the label (\"Revenue, November\"). Color the delta by meaning for that metric (churn going up is bad), with a sign or arrow so color is not the only cue. Remove a KPI that has no comparison and no decision behind it.");
    const headline = [...cards.keys()].filter((card) => card.getBoundingClientRect().top < innerHeight);
    if (headline.length > 7) add("too-many-kpis", headline.slice(0, 4), `${headline.length} KPI cards in the first viewport`, "four to six headline KPIs, with the rest one click away", "Keep the four to six numbers the reader decides on, chosen from the dashboard's one question. Move the others into a detail view, a tab, or a table below the charts. A row of ten equal cards has no headline.");

    // SVG charts with no values: a drawing of 240 by 120 or more with three or more marks,
    // no text inside it, and no number next to it where axis labels would sit.
    const charts = [...document.querySelectorAll("svg")].filter((svg) => {
        if (skipped(svg) || !shown(svg) || svg.parentElement?.closest("svg")) return false;
        const rect = svg.getBoundingClientRect();
        if (rect.width < 240 || rect.height < 120) return false;
        if (svg.querySelectorAll("rect, path, circle, line, polyline, polygon").length < 3) return false;
        if ([...svg.querySelectorAll("text, foreignObject")].some((text) => text.textContent.trim())) return false;
        const near = [...document.querySelectorAll("body *")].some((el) => {
            if (svg.contains(el) || el.contains(svg) || !/\d/.test(ownText(el))) return false;
            const other = el.getBoundingClientRect();
            return other.right >= rect.left - 48 && other.left <= rect.right + 8 && other.bottom >= rect.top - 8 && other.top <= rect.bottom + 32;
        });
        return !near;
    });
    if (charts.length) add("chart-without-labels", charts.slice(0, 3), `${charts.length} chart(s) drawn with no axis values, units, or labels`, "a chart with value and time labels, units, and a key when it has more than one series", "Label the value axis with a few round ticks and units (\"0\", \"80k\", \"160k\") and the time axis with short dates (\"Sep\", \"Oct\"), or label the bars or points directly. Add a legend or direct labels for more than one series, and a tooltip with the exact value. When the shape alone is the point (a sparkline in a KPI card), keep it small and put the number next to it.");

    // Links and buttons whose text ends in an arrow, a generated-page habit.
    const arrows = [...document.querySelectorAll("a, button, [role=button]")].filter((el) => !skipped(el) && shown(el) && /(→|->|⟶|➜)\s*$/.test(el.innerText.trim()));
    if (arrows.length >= 2) add("arrow-suffix", arrows.slice(0, 4), `${arrows.length} links or buttons end with an arrow`, "labels that name the action, with an arrow only on a link that leaves the product", "Remove the arrow from button and link text. Name the action instead (\"View invoices\"). Keep a small external icon only on links that open another site.");

    // Headings with one accented word or phrase: a child in another color, italic, or gradient text.
    const accented = [...document.querySelectorAll("h1, h2, [role=heading][aria-level='1'], [role=heading][aria-level='2']")].filter((heading) => {
        if (skipped(heading) || !shown(heading)) return false;
        const style = getComputedStyle(heading);
        const total = heading.innerText.trim().length;
        return [...heading.querySelectorAll("span, em, strong, i, b, mark")].some((part) => {
            const text = part.innerText.trim();
            if (!text || text.length >= total * 0.7) return false;
            const own = getComputedStyle(part);
            return own.color !== style.color || own.fontStyle !== style.fontStyle || own.backgroundClip === "text" || own.webkitBackgroundClip === "text";
        });
    });
    if (accented.length) add("accent-word", accented.slice(0, 4), `${accented.length} heading(s) accent one word or phrase with another color, italic, or gradient`, "headings set in one color and style", "Set the whole heading in one color and one style. Let size and weight carry the hierarchy, and put emphasis in the words, not in a colored or italic word.");

    return findings;
}
