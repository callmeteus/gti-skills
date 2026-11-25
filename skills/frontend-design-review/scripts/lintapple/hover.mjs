/**
 * Desktop hover tells for the layout probe: clickable elements (buttons, links, elements with
 * a button role or a click handler) that change nothing on hover, and clickable elements that
 * keep the arrow cursor. On a desktop pointer, an action with no hover change reads as dead.
 *
 * Hover styles are found in the page's style sheets: a rule whose selector holds `:hover`
 * counts for an element when the part of the selector that is hovered matches the element or
 * something inside it. Style sheets from another origin cannot be read; the result says so.
 * The check runs only at a desktop width (1024px or more).
 *
 * `measureHover` runs in the page through Playwright, so it keeps no outside references.
 * probe.mjs merges its findings into the probe report.
 *
 * Synced into the Frontend Design Review and Unslop Interface skills from
 * packages/lintapple/agent/scripts. Edit it there, then run `node packages/cli build`.
 */

/**
 * Measures hover and cursor tells on the current page.
 *
 * @param {{ ignore?: string[] }} options selectors to skip, as in the layout probe
 * @returns {{ rule: string, items: object[], actual: string, expected: string, fix: string }[]}
 */
export function measureHover(options = {}) {
    if (innerWidth < 1024) return [];
    const ignore = (options.ignore ?? []).join(", ");
    const findings = [];
    const round = (value) => Math.round(value * 2) / 2;
    const shown = (el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && !el.closest("[aria-hidden=true], [hidden]");
    };
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

    // The hovered part of every :hover selector: ".card:hover .title" gives ".card".
    const hovered = [];
    let unreadable = 0;
    const collect = (rules) => {
        for (const rule of rules) {
            if (rule.selectorText && rule.selectorText.includes(":hover")) {
                for (const selector of rule.selectorText.split(",")) {
                    const at = selector.indexOf(":hover");
                    if (at < 0) continue;
                    const before = selector.slice(0, at);
                    const start = Math.max(before.lastIndexOf(" "), before.lastIndexOf(">"), before.lastIndexOf("+"), before.lastIndexOf("~"));
                    const subject = `${before.slice(start + 1)}${selector.slice(at + 6).split(/[\s>+~]/)[0]}`.replace(/:hover/g, "").trim() || "*";
                    const parts = selector.replace(/:hover/g, "").trim().split(/\s*[\s>+~]\s*/);
                    hovered.push({ subject, target: parts.at(-1) || "*" });
                }
            }
            if (rule.cssRules) collect(rule.cssRules);
        }
    };
    for (const sheet of document.styleSheets) {
        try {
            collect(sheet.cssRules);
        } catch {
            unreadable++;
        }
    }
    // Hovering an element also hovers its ancestors, so ".row:hover .tile" changes a hovered tile.
    const matches = (el, { subject, target }) => {
        try {
            if (el.matches(subject) || el.querySelector(subject)) return true;
            return Boolean(el.parentElement?.closest(subject)) && subject !== "*" && !/^(html|body)$/i.test(subject) && (el.matches(target) || Boolean(el.querySelector(target)));
        } catch {
            return false;
        }
    };

    const clickable = [...document.querySelectorAll("a[href], button, [role=button], [role=link], [role=tab], [role=menuitem], [role=option], [onclick], summary, input[type=submit], input[type=button], input[type=reset], select, label[for]")]
        .filter((el) => shown(el) && !(ignore && el.closest(ignore)) && !el.disabled && el.getAttribute("aria-disabled") !== "true")
        .filter((el, index, list) => !list.some((other) => other !== el && other.contains(el)));

    const noHover = clickable.filter((el) => !hovered.some((rule) => matches(el, rule)));
    if (noHover.length && !unreadable) {
        add("no-hover-state", noHover.slice(0, 4), `${noHover.length} of ${clickable.length} clickable element(s) change nothing on hover`, "a visible hover change on every clickable element on desktop", "Give each clickable element a hover state from the design system: a background tint, a border or outline, a shadow or small elevation, an underline for text links, or a soft glow on a dark surface. Put it in the shared component, inside `@media (hover: hover)` so touch screens do not keep it, with a short `transition` on the changed properties only. Hover is never the only cue: the element already looks clickable at rest.");
    } else if (noHover.length && unreadable) {
        add("no-hover-state", noHover.slice(0, 4), `${noHover.length} clickable element(s) have no hover rule in the readable style sheets (${unreadable} style sheet(s) from another origin could not be read; confirm by hovering)`, "a visible hover change on every clickable element on desktop", "Hover each listed element. If nothing changes, add a hover state in the shared component (background tint, border, shadow, elevation, underline, or glow), inside `@media (hover: hover)`.");
    }

    const arrow = clickable.filter((el) => {
        if (el.matches("select, label[for]")) return false;
        const cursor = getComputedStyle(el).cursor;
        return cursor !== "pointer" && cursor !== "grab" && cursor !== "move";
    });
    if (arrow.length) add("no-pointer-cursor", arrow.slice(0, 4), `${arrow.length} clickable element(s) keep the arrow cursor (${[...new Set(arrow.slice(0, 4).map((el) => getComputedStyle(el).cursor))].join(", ")})`, "`cursor: pointer` on every clickable element, `not-allowed` on disabled ones", "Set `cursor: pointer` once in the base styles for buttons, `[role=button]`, tabs, menu items, and clickable cards, and `cursor: not-allowed` for `:disabled` and `[aria-disabled=true]`. Do not set it element by element.");

    return findings;
}
