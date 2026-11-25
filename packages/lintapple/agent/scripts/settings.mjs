/**
 * Settings and form page tells for the layout probe: boxed sections stacked in one column that
 * each take the width of their own content, so their right edges zigzag down the page; a
 * language picker built as a row of buttons instead of a select; and a choice whose option has
 * its own settings in a separate section further down ("Device: [Stream Deck Mobile]" above a
 * "Stream Deck Mobile" card), which splits one task across two places.
 *
 * `measureSettings` runs in the page through Playwright, so it keeps no outside references.
 * probe.mjs merges its findings into the probe report.
 *
 * Synced into the Frontend Design Review and Unslop Interface skills from
 * packages/lintapple/agent/scripts. Edit it there, then run `node packages/cli build`.
 */

/**
 * Measures settings page tells on the current page.
 *
 * @param {{ ignore?: string[] }} options selectors to skip, as in the layout probe
 * @returns {{ rule: string, items: object[], actual: string, expected: string, fix: string }[]}
 */
export function measureSettings(options = {}) {
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
    const label = (el) => (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ");
    const norm = (text) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
    const transparent = (color) => !color || color === "transparent" || /rgba\([^)]*,\s*0\)$/.test(color);
    const surface = (el) => {
        const style = getComputedStyle(el);
        const border = ["Top", "Right", "Bottom", "Left"].some((side) => parseFloat(style[`border${side}Width`]) > 0 && !transparent(style[`border${side}Color`]));
        const fill = !transparent(style.backgroundColor) && style.backgroundColor !== getComputedStyle(el.parentElement ?? document.body).backgroundColor;
        return border || fill || style.boxShadow !== "none";
    };

    // Boxed sections stacked in one column with a shared left edge but different widths.
    const reportedStacks = new Set();
    for (const parent of document.querySelectorAll("body, body *")) {
        if (skipped(parent) || reportedStacks.has(parent)) continue;
        const blocks = [...parent.children].filter((child) => {
            if (!shown(child) || !surface(child)) return false;
            const style = getComputedStyle(child);
            if (style.position === "absolute" || style.position === "fixed") return false;
            const rect = child.getBoundingClientRect();
            return rect.width >= 160 && rect.height >= 48 && child.children.length > 0;
        });
        if (blocks.length < 3) continue;
        const rects = blocks.map((block) => block.getBoundingClientRect());
        const left = Math.min(...rects.map((rect) => rect.left));
        const column = blocks.filter((_, index) => Math.abs(rects[index].left - left) <= 2);
        if (column.length < 3) continue;
        const columnRects = column.map((block) => block.getBoundingClientRect()).sort((a, b) => a.top - b.top);
        const stacked = columnRects.every((rect, index) => index === 0 || rect.top >= columnRects[index - 1].bottom - 1);
        if (!stacked) continue;
        const widths = column.map((block) => block.getBoundingClientRect().width);
        const spread = Math.max(...widths) - Math.min(...widths);
        if (spread <= 24) continue;
        reportedStacks.add(parent);
        const narrowest = column[widths.indexOf(Math.min(...widths))];
        const widest = column[widths.indexOf(Math.max(...widths))];
        add("ragged-stack", [narrowest, widest], `${column.length} boxed sections stacked in one column with widths ${widths.map(round).join(", ")}: each takes the width of its content, so the right edges zigzag`, "every section in the column the same width, on the page's grid", "Give the column one width and let every section fill it: a single-column grid (`display: grid` on the parent, sections at `width: 100%`) with a `max-width` that fits the longest row (about 640 to 760px for a settings page). Lay each section's rows on that grid too: label and help text on the left, the control on the right edge. Never let a section shrink to its content.");
    }

    // A language picker built as buttons: two or more toggle buttons or radios labeled with languages.
    const languages = /^(english|ingles|portugues|portugues \(brasil\)|portugues \(portugal\)|portugues brasileiro|espanol|spanish|espanhol|francais|french|frances|deutsch|german|alemao|italiano|italian|nederlands|polski|russkij|русский|日本語|中文|简体中文|繁體中文|한국어|turkce|svenska|norsk|dansk|suomi|cestina|ελληνικά|العربية|עברית|हिन्दी|en|pt|pt-br|es|fr|de|it|ja|zh|ko)$/;
    const reportedPickers = new Set();
    for (const control of document.querySelectorAll("button, [role=button], [role=radio], [role=tab], label, a")) {
        if (skipped(control) || !shown(control) || !languages.test(norm(label(control)))) continue;
        const group = control.parentElement;
        if (!group || reportedPickers.has(group)) continue;
        const options = [...group.querySelectorAll("button, [role=button], [role=radio], [role=tab], label, a")].filter((el) => shown(el) && languages.test(norm(label(el))));
        if (options.length < 2 || group.querySelector("select, [role=combobox], [role=listbox]")) continue;
        reportedPickers.add(group);
        add("language-as-buttons", options.slice(0, 3), `the language is picked from ${options.length} buttons (${options.map(label).join(", ")})`, "one labeled select that lists every language by its own name", "Replace the buttons with one select labeled \"Language\" (in the UI's language), listing each language by its own name (\"English\", \"Português (Brasil)\"). A language list grows, and a row of buttons does not; a select also takes one row in a settings grid.");
    }

    // A choice whose option has its own settings section somewhere else on the page.
    const headings = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6, legend, [role=heading]")].filter((el) => shown(el) && !skipped(el));
    const choiceOptions = [];
    for (const el of document.querySelectorAll("[role=radio], [role=tab], [aria-pressed], [aria-selected], input[type=radio]")) {
        if (skipped(el) || !shown(el)) continue;
        const text = el.matches("input") ? label(el.closest("label") ?? el.parentElement ?? el) : label(el);
        if (text && text.length <= 48) choiceOptions.push({ el, text });
    }
    for (const select of document.querySelectorAll("select")) {
        if (skipped(select) || !shown(select)) continue;
        for (const option of select.options) if (option.text.trim()) choiceOptions.push({ el: select, text: option.text.trim() });
    }
    const reportedChoices = new Set();
    for (const { el, text } of choiceOptions) {
        const group = el.matches("select") ? el : el.closest("[role=radiogroup], [role=tablist], fieldset") ?? el.parentElement;
        if (!group || reportedChoices.has(group)) continue;
        const own = group.closest("section, fieldset, article, form, [role=group], [role=region]") ?? group.parentElement;
        const heading = headings.find((h) => norm(label(h)) === norm(text) && !own?.contains(h) && !h.contains(el) && !el.contains(h));
        if (!heading) continue;
        reportedChoices.add(group);
        add("option-apart-from-settings", [el, heading], `the option "${text}" is chosen in one place and set up in a separate "${label(heading)}" section`, "one component: the choice, and under it the setup of the chosen option", "Merge them. Show the choice once, and under it only the settings of the chosen option, in the same box. When choosing and setting up take more than one screen (pick a device, pair it, test it), make it a short wizard: one step per screen, a step indicator, Back and Next, and a summary of the current setup with a \"Change\" button when it is done.");
    }

    return findings;
}
