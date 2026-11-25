/**
 * App shell tells for the layout probe: a create action styled as one more item of the list it
 * adds to ("Novo perfil" under the profiles), the signed-in user shown as a name with a text
 * sign-out link instead of an avatar and an icon button, and icons drawn by hand (inline SVG or
 * image files) where an icon library would keep them consistent. The last one is a suggestion
 * for the report, never a change the skill makes on its own.
 *
 * `measureChrome` runs in the page through Playwright, so it keeps no outside references.
 * probe.mjs merges its findings into the probe report.
 *
 * Synced into the Frontend Design Review and Unslop Interface skills from
 * packages/lintapple/agent/scripts. Edit it there, then run `node packages/cli build`.
 */

/**
 * Measures app shell tells on the current page.
 *
 * @param {{ ignore?: string[] }} options selectors to skip, as in the layout probe
 * @returns {{ rule: string, items: object[], actual: string, expected: string, fix: string, suggestion?: boolean }[]}
 */
export function measureChrome(options = {}) {
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
    const add = (rule, elements, actual, expected, fix, extra = {}) => findings.push({ rule, items: elements.map(box), actual, expected, fix, ...extra });
    const label = (el) => (el.innerText || el.value || "").trim().replace(/\s+/g, " ");

    // A create action that looks like one more item: same tag, same width, and same height
    // as the items above it, at the end (or start) of a vertical list of three or more.
    const createVerb = /^\s*(\+\s*)?(novo|nova|criar|adicionar|new|create|add)\b/i;
    const reportedLists = new Set();
    for (const action of document.querySelectorAll("a, button, [role=button], li, [role=option], [role=menuitem]")) {
        if (skipped(action) || !shown(action) || !createVerb.test(label(action)) || label(action).length > 40) continue;
        const item = action.matches("li") || action.parentElement?.matches("li") ? action.closest("li") : action;
        const list = item.parentElement;
        if (!list || reportedLists.has(list)) continue;
        const siblings = [...list.children].filter((child) => child !== item && child.tagName === item.tagName && shown(child) && !createVerb.test(label(child)));
        if (siblings.length < 2) continue;
        const rect = item.getBoundingClientRect();
        const alike = siblings.filter((child) => {
            const other = child.getBoundingClientRect();
            return Math.abs(other.width - rect.width) <= 4 && Math.abs(other.height - rect.height) <= 6 && Math.abs(other.left - rect.left) <= 4;
        });
        const stacked = siblings.every((child) => Math.abs(child.getBoundingClientRect().left - rect.left) <= 4);
        const atEnd = [...list.children].filter(shown).at(-1) === item || [...list.children].filter(shown)[0] === item;
        if (alike.length >= 2 && stacked && atEnd) {
            reportedLists.add(list);
            add("create-as-item", [item, alike[0]], `"${label(action).slice(0, 32)}" is styled like the ${siblings.length} items of the list it adds to`, "a \"+\" icon button in the list's header row, with a tooltip and an accessible name", "Remove the create row from the list. Put a \"+\" icon button at the right of the list's label (\"Profiles  +\"), with `aria-label` and a tooltip that name the action (\"New profile\"). In an empty list, keep one text button in the empty state.");
        }
    }

    // The signed-in user as a text name and a text sign-out link, with no avatar.
    const signOut = /^(sair|sair da conta|desconectar|encerrar sessão|sign out|log ?out|logout)$/i;
    for (const exit of document.querySelectorAll("a, button, [role=button], [role=menuitem]")) {
        if (skipped(exit) || !shown(exit) || !signOut.test(label(exit))) continue;
        let area = exit.parentElement;
        for (let depth = 0; area && depth < 3 && area.children.length < 2; depth++) area = area.parentElement;
        if (!area) continue;
        const exitRect = exit.getBoundingClientRect();
        const avatar = [...document.querySelectorAll("img, [class*=avatar], [class*=Avatar], [data-avatar]")].some((el) => {
            if (!shown(el)) return false;
            const rect = el.getBoundingClientRect();
            return Math.abs(rect.top - exitRect.top) <= 120 && Math.abs(rect.left - exitRect.left) <= 320 && rect.width <= 64;
        });
        if (avatar) continue;
        const name = [...area.querySelectorAll("*")].find((el) => el !== exit && !exit.contains(el) && !el.contains(exit) && shown(el) && [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim().length >= 2 && node.textContent.trim().length <= 40) && Math.abs(el.getBoundingClientRect().top - exitRect.top) <= 80);
        add("user-as-text", name ? [name, exit] : [exit], `the user is shown as ${name ? `the name "${label(name).slice(0, 24)}" and ` : ""}a "${label(exit)}" text link, with no avatar`, "an avatar (photo or initials) that opens the account menu, and sign-out as an icon button with a tooltip", "Show the user as a round avatar: the picture from the identity provider (the OAuth or OIDC `picture` claim) when there is one, or the initials on a neutral circle. The avatar opens a small menu with the name, the email, and the account links. Sign-out is an icon button (a log-out icon) with a tooltip and `aria-label`, or the last item of that menu.");
        break;
    }

    // Icons drawn by hand: small inline SVGs or image files with no icon library behind them.
    const library = /(lucide|svg-inline--fa|\bfa-|\bfa\b|\bph\b|\bph-|phosphor|tabler-icon|heroicon|material-symbols|material-icons|\bmdi\b|\bmdi-|\bbi\b|\bbi-|iconify|remixicon|\bri-|feather|octicon|\bicon-\[)/i;
    const icons = [...document.querySelectorAll("svg, img")].filter((el) => {
        if (skipped(el) || !shown(el) || el.parentElement?.closest("svg")) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width > 32 || rect.height > 32 || rect.width < 8) return false;
        if (el.tagName === "IMG" && !/\.(svg|png|webp)(\?|$)/i.test(el.getAttribute("src") ?? "")) return false;
        return true;
    });
    const fromLibrary = (el) => library.test(`${el.getAttribute("class") ?? ""} ${el.parentElement?.getAttribute("class") ?? ""} ${el.getAttribute("data-icon") ?? ""} ${el.getAttribute("src") ?? ""}`) || el.querySelector("use[href*=lucide], use[href*=sprite]");
    const handmade = icons.filter((el) => !fromLibrary(el));
    const fonts = [...document.querySelectorAll("i, span")].some((el) => library.test(el.getAttribute("class") ?? "") && shown(el));
    if (handmade.length >= 3 && !icons.some(fromLibrary) && !fonts) {
        add("icon-source", handmade.slice(0, 3), `${handmade.length} small icons are inline SVG or image files with no icon library`, "a suggestion in the report: one icon library for every icon", "Suggest, do not apply: adopt one icon library so every icon shares a grid, stroke, and size, and new icons are one import away. For the web, Lucide, Phosphor, Tabler, Heroicons, Font Awesome, or Material Symbols (and Noto Emoji when the product shows emoji). Name the one that matches the current icons best and the files it would replace; the user decides.", { suggestion: true });
    }

    return findings;
}
