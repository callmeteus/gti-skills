/**
 * Detail page tells for the layout probe: status actions (complete, cancel, archive) left as
 * separate buttons, controls stacked under the page title instead of on its right, notes that
 * explain how the page refreshes, the same value repeated in several cards, and values cut
 * with an ellipsis and no way to read them in full, empty states written in different
 * patterns, and text fields whose allowed values are listed under them instead of a select.
 *
 * `measureDetail` runs in the page through Playwright, so it keeps no outside references.
 * probe.mjs merges its findings into the probe report.
 *
 * Synced into the Frontend Design Review and Unslop Interface skills from
 * packages/lintapple/agent/scripts. Edit it there, then run `node packages/cli build`.
 */

/**
 * Measures detail page tells on the current page.
 *
 * @param {{ ignore?: string[] }} options selectors to skip, as in the layout probe
 * @returns {{ rule: string, items: object[], actual: string, expected: string, fix: string }[]}
 */
export function measureDetail(options = {}) {
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
    const label = (el) => (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ");

    const title = [...document.querySelectorAll("h1")].find((el) => shown(el) && !skipped(el));
    if (title) {
        const titleRect = title.getBoundingClientRect();
        const band = (el) => {
            const rect = el.getBoundingClientRect();
            return rect.top >= titleRect.top - 64 && rect.top <= titleRect.bottom + 72 && !title.contains(el);
        };
        const controls = [...document.querySelectorAll("button, a[role=button], [role=button], [role=status], .badge, [class*=badge], [class*=status], [class*=pill]")]
            .filter((el) => shown(el) && !skipped(el) && band(el) && !el.closest("nav") && label(el).length <= 32)
            .filter((el, index, list) => !list.some((other) => other !== el && other.contains(el)));

        // Two or more actions that change the item's status, each as its own button.
        const statusVerb = /^(concluir|finalizar|cancelar|arquivar|excluir|apagar|aprovar|rejeitar|reabrir|pausar|retomar|encerrar|complete|finish|cancel|archive|delete|approve|reject|reopen|pause|resume|close)\b/i;
        const statusActions = controls.filter((el) => el.matches("button, a[role=button], [role=button]") && statusVerb.test(label(el)));
        if (statusActions.length >= 2) {
            add("status-actions-apart", statusActions.slice(0, 4), `${statusActions.length} buttons that change the item's status sit side by side under the title (${statusActions.map(label).join(", ")})`, "one \"Actions\" menu at the right of the title, with the destructive action last and set apart", "Put the status actions in one \"Actions\" (\"Ações\") menu button at the right end of the title row. Order them by use, put the destructive one (Cancel, Delete) last with a divider and danger color, and confirm or offer undo after it. Keep a separate button only for the one next step most people take.");
        }

        // Controls stacked under the title while the title line has room on its right.
        const range = document.createRange();
        range.selectNodeContents(title);
        const textRight = range.getBoundingClientRect().right;
        let container = title.parentElement;
        while (container && container !== document.body && container.getBoundingClientRect().width < 0.6 * innerWidth) container = container.parentElement;
        const containerRight = (container ?? document.body).getBoundingClientRect().right;
        const below = controls.filter((el) => el.getBoundingClientRect().top >= titleRect.bottom - 2 && el.getBoundingClientRect().left < titleRect.left + 0.5 * (containerRight - titleRect.left));
        if (below.length >= 2 && containerRight - textRight >= 240) {
            add("header-controls-below-title", below.slice(0, 4), `${below.length} status or action controls sit in a row under the title, while ${Math.round(containerRight - textRight)}px to the right of the title is empty`, "the title on the left and its status, refresh, and actions on the right of the same row", "Make the page header one row: back link above, title on the left, and on the right the live status, a refresh icon button, and the \"Actions\" menu, centered on the title's line. The item ID and other metadata go under the title in small muted text. On a narrow screen the right group wraps under the title.");
        }
    }

    // A note that explains how the page refreshes, set as page text instead of a tooltip.
    const refreshNote = /(atualiza(ção|cao|-se)? automática|atualizad[oa] automaticamente|a cada \d+\s*(s|seg|segundos|minutos?)\b|auto-?refresh|refresh(es|ed)? (automatically|every)|updates? (automatically|every \d+)|every \d+\s*(s|sec|seconds|minutes?)\b)/i;
    const notes = [...document.querySelectorAll("p, span, small, div, footer")].filter((el) => {
        const text = ownText(el);
        return text && text.length <= 160 && refreshNote.test(text) && !skipped(el) && shown(el) && !el.closest("[role=tooltip], button, a");
    });
    if (notes.length) add("behavior-footnote", notes.slice(0, 2), `a note explains how the page refreshes ("${ownText(notes[0]).slice(0, 60)}")`, "the refresh behavior in the tooltip of the live indicator", "Remove the note from the page. Put it in the tooltip of the \"Live\" indicator (\"Updates on every change and every 5 seconds\"), and show the last update time there too.");

    // The same value shown in two or more cards of one page.
    const cardOf = (el) => {
        for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
            const style = getComputedStyle(node);
            const painted = style.borderTopStyle !== "none" && parseFloat(style.borderTopWidth) > 0 || style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.boxShadow !== "none";
            if (painted && node.getBoundingClientRect().width < 0.9 * innerWidth) return node;
        }
        return null;
    };
    const signature = (el) => `${el.tagName}.${[...el.classList].sort().join(".")}`;
    // The block that holds the value, so a link inside a paragraph and a plain paragraph match.
    const blockOf = (el, card) => {
        let node = el;
        while (node !== card && node.parentElement && getComputedStyle(node).display.startsWith("inline")) node = node.parentElement;
        return signature(node);
    };
    const seen = new Map();
    for (const el of document.querySelectorAll("body *")) {
        const text = ownText(el);
        if (!text || text.length < 8 || text.length > 60 || /^[\d\s.,:/%-]+$/.test(text) || skipped(el) || !shown(el)) continue;
        if (el.closest("nav, header, footer, tr, li, option, select, h1, h2, h3, h4, button, label, [role=tooltip]")) continue;
        const card = cardOf(el);
        if (!card) continue;
        const key = text.toLowerCase().replace(/[….]+$/, "");
        const entry = seen.get(key) ?? { text, cards: new Set(), elements: [], paths: new Set() };
        if (!entry.cards.has(card)) {
            entry.cards.add(card);
            entry.elements.push(el);
            entry.paths.add(blockOf(el, card));
        }
        seen.set(key, entry);
    }
    // A value in the same kind of block inside cards of one repeated component is a per-item
    // fact in a list (the repeated-item-text rule covers that), not one fact shown twice.
    const repeatedCard = (card) => [...card.parentElement.children].some((child) => child !== card && signature(child) === signature(card));
    const listField = (entry) => {
        const cards = [...entry.cards];
        return entry.paths.size === 1 && cards.every((card) => signature(card) === signature(cards[0]) && repeatedCard(card));
    };
    const repeated = [...seen.values()].filter((entry) => entry.cards.size >= 2 && !listField(entry));
    if (repeated.length) add("repeated-value", repeated.slice(0, 3).flatMap((entry) => entry.elements.slice(0, 2)), `${repeated.length} value(s) appear in more than one card (${repeated.slice(0, 3).map((entry) => `"${entry.text.slice(0, 32)}" ${entry.cards.size}x`).join(", ")})`, "each fact in one place, in the card that owns it", "Show each value once, in the card where it belongs, and remove the other copies. When two cards hold the same facts (an Execution card and an Integrations card both naming the agent and runner), merge them into one card.");

    // Stacked panels that are views of one output (result, updates, log, history), two or more
    // of them still empty or waiting: they read better as tabs.
    const waiting = /(aguardando|nenhum|nenhuma|ainda não|sem (dados|resultados?|atualiza)|waiting|no .{1,30} yet|nothing (yet|to show)|not (started|available) yet)/i;
    const panels = [...document.querySelectorAll("section, article, div")].filter((el) => {
        if (skipped(el) || !shown(el) || !el.querySelector(":scope > h2, :scope > h3, :scope > header h2, :scope > header h3, :scope > div > h2, :scope > div > h3")) return false;
        const style = getComputedStyle(el);
        return style.borderTopStyle !== "none" && parseFloat(style.borderTopWidth) > 0 || style.backgroundColor !== "rgba(0, 0, 0, 0)";
    });
    const reported = new Set();
    for (const panel of panels) {
        if (reported.has(panel)) continue;
        const run = [panel];
        for (let next = panel.nextElementSibling; next && panels.includes(next); next = next.nextElementSibling) run.push(next);
        const idle = run.filter((el) => waiting.test(el.innerText));
        if (run.length >= 2 && idle.length >= 2) {
            run.forEach((el) => reported.add(el));
            add("stacked-output-panels", idle.slice(0, 3), `${idle.length} stacked panels are empty or waiting (${idle.map((el) => (el.querySelector("h2, h3")?.innerText ?? "").trim()).join(", ")})`, "one tabbed panel, with each view as a tab and a count on the tab", "Turn the panels into tabs of one panel (\"Updates 0\", \"Result\"), open the tab that has content, and show one empty or waiting state in it. Tabs keep the page short and stop several empty boxes from filling the screen.");
        }
    }

    // Values cut with an ellipsis and no title or tooltip to read them.
    const cut = [...document.querySelectorAll("body *")].filter((el) => {
        if (skipped(el) || !shown(el) || !ownText(el)) return false;
        const style = getComputedStyle(el);
        if (style.textOverflow !== "ellipsis" || el.scrollWidth <= el.clientWidth + 1) return false;
        return !el.closest("[title], [aria-label], [data-tooltip], [data-tip]");
    });
    if (cut.length) add("truncated-without-tooltip", cut.slice(0, 4), `${cut.length} value(s) are cut with an ellipsis and cannot be read in full`, "values that fit, wrap, or show the full text on hover and focus", "Give the value room (a wider column, the value under its label instead of beside it) or let it wrap. When it must be cut, such as a long ID, cut the middle (\"288f2f…41b3\"), show the full text in a tooltip, and add a copy button.");

    // Empty states on one page written in different patterns: "Sem resultado registrado." next
    // to "Nenhuma atualização publicada pelo agente ainda." should both read "Nenhum ...".
    const openings = [
        ["nenhum", /^nenhum[as]?\b/i],
        ["sem", /^sem\b/i],
        ["não há", /^(não|nao) (há|ha|existe|existem)\b/i],
        ["ainda não", /^ainda (não|nao)\b/i],
        ["vazio", /^(vazio|vazia|lista vazia)\b/i],
        ["no", /^no\b/i],
        ["nothing", /^nothing\b/i],
        ["there is no", /^there (is|are) no\b/i],
        ["not ... yet", /^(not|none) .*yet\b/i],
        ["empty", /^empty\b/i],
    ];
    const empties = [...document.querySelectorAll("p, span, div, li, td, small")].map((el) => {
        if ((ignore && el.closest(ignore)) || !shown(el) || el.closest("button, a, label, option, select, [role=tooltip], nav")) return null;
        const text = ownText(el);
        if (!text || text.length > 90) return null;
        const opening = openings.find(([, pattern]) => pattern.test(text));
        return opening ? { el, text, opening: opening[0], words: text.split(/\s+/).length, period: /\.$/.test(text) } : null;
    }).filter(Boolean);
    if (empties.length >= 2) {
        const kinds = new Set(empties.map((entry) => entry.opening));
        const periods = new Set(empties.map((entry) => entry.period));
        const lengths = empties.map((entry) => entry.words);
        const problems = [];
        if (kinds.size > 1) problems.push(`${kinds.size} openings (${[...kinds].map((kind) => `"${kind}"`).join(", ")})`);
        if (periods.size > 1) problems.push("some end with a period and some do not");
        if (Math.max(...lengths) - Math.min(...lengths) >= 3) problems.push(`lengths from ${Math.min(...lengths)} to ${Math.max(...lengths)} words`);
        if (problems.length) add("inconsistent-empty-copy", empties.slice(0, 4).map((entry) => entry.el), `${empties.length} empty states are written differently: ${problems.join("; ")} (${empties.slice(0, 3).map((entry) => `"${entry.text.slice(0, 40)}"`).join(", ")})`, "one pattern for every empty state, such as \"Nenhum resultado\" and \"Nenhuma atualização\"", "Write every empty state with the same pattern: \"No <things>\" (\"Nenhum resultado\", \"Nenhuma atualização\"), the same punctuation, and no narration of who would have done it (\"publicada pelo agente\"). Add a second line only to say what to do next. Use the same pattern across the product, and the same for loading (\"Carregando…\") and error text.");
    }

    // A free text field for a value from a fixed list, with the list written as help text
    // ("play_pause · next · previous"), and raw identifiers shown to the user.
    const fields = [...document.querySelectorAll("input:not([type]), input[type=text], input[type=search], textarea")].filter((field) => shown(field) && !(ignore && field.closest(ignore)));
    const enums = [];
    for (const field of fields) {
        const near = [];
        for (let node = field.nextElementSibling, steps = 0; node && steps < 2; node = node.nextElementSibling, steps++) near.push(node);
        const described = field.getAttribute("aria-describedby");
        if (described) for (const id of described.split(/\s+/)) if (document.getElementById(id)) near.push(document.getElementById(id));
        const parentNext = field.parentElement?.nextElementSibling;
        if (parentNext) near.push(parentNext);
        for (const hint of near) {
            const text = (hint.innerText ?? "").trim();
            if (!text || text.length > 200 || hint.querySelector("input, select, textarea, button")) continue;
            const values = text.split(/\s*(?:·|\||,|\/|•|;)\s*/).map((value) => value.trim()).filter(Boolean);
            const identifiers = values.filter((value) => /^[a-z0-9]+([_.-][a-z0-9]+)*$/i.test(value) && value.length <= 32);
            if (values.length >= 3 && identifiers.length === values.length && values.some((value) => /[_.-]/.test(value) || /^[a-z]/.test(value))) {
                enums.push({ field, hint, values });
                break;
            }
        }
    }
    if (enums.length) add("enum-as-text", enums.slice(0, 3).flatMap((entry) => [entry.field, entry.hint]), `${enums.length} text field(s) take a value from a fixed list written under them (${enums.slice(0, 2).map((entry) => entry.values.slice(0, 4).join(" · ")).join("; ")})`, "a select (or radio buttons for up to four values) with readable labels", "Replace the text field with a select whose options are the allowed values with readable labels (\"Tocar ou pausar\", \"Próxima faixa\", \"Volume +\"), keeping the identifiers as option values only. Use radio buttons or a segmented control for two to four values. Remove the list of values from the help text, and never show snake_case identifiers to the user.");

    return findings;
}
