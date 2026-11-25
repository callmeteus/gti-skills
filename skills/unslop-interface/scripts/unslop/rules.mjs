// Source rules for the unslop inventory. Each finding names the pass that fixes it.
// The rules read templates and UI strings; they find candidates for the agent to
// confirm on the screen, not verdicts.

export const PASSES = [
    { n: 1, id: "spacing", name: "Spacing" },
    { n: 2, id: "radius", name: "Corner radius" },
    { n: 3, id: "color", name: "Color and effects" },
    { n: 4, id: "icons", name: "Icons and alignment" },
    { n: 5, id: "copy", name: "Typography and copy" },
    { n: 6, id: "data", name: "Data display" },
    { n: 7, id: "structure", name: "Actions and structure" },
    { n: 8, id: "states", name: "States and feel" },
];

export const UI_EXTENSIONS = [".vue", ".svelte", ".tsx", ".jsx", ".html", ".astro", ".rs", ".slint"];
// Translation and string files: scanned with the copy rules only, and only inside a locale folder.
export const STRING_EXTENSIONS = [".json", ".ftl", ".po", ".yaml", ".yml", ".toml", ".properties"];
export const STRING_DIR = /(^|[\/])(locales?|i18n|l10n|lang|langs|translations|messages)[\/]/;
// A Rust file is UI only when it draws with a UI toolkit; the rest of a Rust repository is not scanned.
const NATIVE_UI = /\b(egui|eframe|iced|slint|gpui|dioxus|leptos|makepad|floem|xilem|druid)::|\bui\.(label|button|heading|horizontal|vertical|group|add)\(|slint::slint!/;

export function isNativeUiSource(text) {
    return NATIVE_UI.test(text);
}

export function isStringFile(file) {
    return STRING_EXTENSIONS.some((ext) => file.endsWith(ext)) && STRING_DIR.test(file);
}

const ENUM_FIELDS = "status|state|visibility|role|kind|type|transport|provider|scope|author_type|subject_type|severity|priority";
const ID_FIELDS = "id|uuid|[a-z]+_id|[a-z]+Id|[a-z]+_by|sha|commit_sha|hash";
const DESTRUCTIVE = /^(apagar|excluir|remover|desconectar|revogar|delete|remove|disconnect|revoke|destroy|drop)\b/i;
const REFRESH = /^(atualizar|recarregar|refresh|reload)$/i;
const LIVE_DATA = /useCollabEvents|useEvents|EventSource|WebSocket|setInterval|onSnapshot|subscribe\(|poll/;

const LANGUAGE_MESSAGE = "Language picked from buttons: use one labeled select (a ComboBox in egui, a pick_list in iced, a ComboBox in Slint) listing each language by its own name";

// Line rules: [id, pass, regex, message]. A regex runs on one line of the template or UI source.
const LINE_RULES = [
    ["decorative-gradient", 3, /\bbg-gradient-to-|\b(linear|radial|conic)-gradient\(/, "Gradient: keep it only when it carries meaning"],
    ["tracked-caps", 5, /\buppercase\b[^"'`]*\btracking-|\btracking-[^"'`]*\buppercase\b|text-transform:\s*uppercase/, "All caps with wide tracking: use sentence case"],
    ["three-dots", 5, /[\p{L}]\.\.\.(?=["'`<\s]|$)/u, "Three dots: use the ellipsis character"],
    ["exclamation", 5, /[\p{L}]!+(?=["'`<]|\s*<)/u, "Exclamation mark in UI copy"],
    ["emoji-in-ui", 4, /\p{Extended_Pictographic}/u, "Emoji in the interface: use the icon set, unless the taste file keeps it"],
    ["transition-all", 8, /\btransition-all\b|transition:\s*all\b/, "transition: all: animate only transform and opacity"],
    ["dash-placeholder", 6, /((\|\||\?\?)\s*|unwrap_or\(\s*)["'`](—|–|-|N\/A|n\/a)["'`]/, "A dash for an empty value: leave the row out on detail views"],
    ["id-fallback", 6, new RegExp(`\\.(name|title|label)\\s*(\\|\\||\\?\\?)\\s*[\\w.?]+\\.(${ID_FIELDS})\\b`), "Falls back to a raw ID when the name is missing: show the name or nothing"],
    ["raw-id-shown", 6, new RegExp(`\\{\\{\\s*[\\w.?]+\\.(${ID_FIELDS})\\s*\\}\\}`), "Raw ID rendered as text: show the name, keep the ID in a tooltip or copy action"],
    ["raw-enum-shown", 5, new RegExp(`\\{\\{\\s*[\\w.?]+\\.(${ENUM_FIELDS})\\s*\\}\\}`), "Raw enum value rendered as text (\"private\", \"offline\"): map it to a label in the UI language"],
    ["raw-json-shown", 6, /\{\{\s*JSON\.stringify\(/, "Raw JSON rendered as content: show the fields as label and value pairs"],
    ["narrating-caption", 5, /\b(sub|hint|subtitle|caption|description|helper|help)\s*:\s*["'`][\p{Lu}][^"'`]*\s[^"'`]*\s[^"'`]*["'`]/u, "Caption sentence in UI data: cut it when it only narrates the label next to it"],
    ["truncated-path", 7, /^(?!.*\btitle=).*(\btruncate\b.*\b(path|worktree|url|dir|repo|sha|commit|code-chip|font-mono)\b|\b(path|worktree|url|dir|repo|code-chip|font-mono)\b.*\btruncate\b)/, "Path, URL, or code value cut off with no full value on hover: wrap it or show the full value"],
    ["roadmap-copy", 5, /^(?!\s*(\/\/|\/\*|\*|#|<!--|--)).*(["'`>=]|:\s)[^"'`<]*\b(coming soon|em breve|marco posterior|pr[oó]xim[oa] (marco|vers[aã]o|release)|(later|future|next) (milestone|release|version)|milestones?|roadmap|not (yet )?(implemented|supported|available)|n[aã]o (est[aá] )?implementad[oa]|ainda n[aã]o (est[aá] )?(dispon[ií]vel|implementad[oa]|suportad[oa])|chega(m|r[aã]o)? (em|n[ao]) (um |uma |o |a )?(marco|vers[aã]o|release))\b/i, "Developer or roadmap copy in the UI (milestones, \"coming in a later release\"): say what the user can do now, and hide what does not work yet"],
    ["language-as-buttons", 7, /<(button|Button|UiButton|ToggleGroupItem|SegmentedControl|Tab|Chip)\b[^\n]*\b(locale|lang|language|idioma)\b|\b(Button|ToggleButton)\s*\{[^\n]*\b(English|Portugu[eê]s|Espa[nñ]ol)\b/i, LANGUAGE_MESSAGE],
    ["image-url-field", 7, /(avatar|foto|photo|image|imagem|logo)[^<>]{0,40}\b(url|URL)\b|\b(url|URL)\b[^<>]{0,40}(avatar|foto|photo|image|imagem|logo)/, "Image chosen by URL: offer an upload"],
];

function lineOf(text, index) {
    return text.slice(0, index).split("\n").length;
}

// The part of the file that renders: the <template> block of a Vue file, the whole file otherwise.
export function templateRange(file, text) {
    if (file.endsWith(".vue")) {
        const start = text.indexOf("<template");
        const end = text.lastIndexOf("</template>");
        if (start >= 0 && end > start) return [start, end];
    }
    return [0, text.length];
}

function elements(text, tags) {
    const out = [];
    const re = new RegExp(`<(${tags})\\b([^>]*)>([\\s\\S]*?)</\\1>`, "g");
    let m;
    while ((m = re.exec(text))) out.push({ tag: m[1], attrs: m[2], body: m[3], index: m.index });
    return out;
}

function visibleText(body) {
    return body
        .replace(/<template[^>]*>[\s\S]*?<\/template>/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\{\{[\s\S]*?\}\}/g, (m) => {
            const lit = m.match(/["'`]([^"'`]+)["'`]/);
            return lit ? ` ${lit[1]} ` : " ";
        })
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeExpr(expr) {
    return expr.replace(/\?\./g, ".").replace(/\.value\b/g, "").replace(/\s+/g, "");
}

export function scanText(file, text, context = {}) {
    const findings = [];
    const add = (rule, pass, line, message, excerpt = "") =>
        findings.push({ file, line, rule, pass, message, excerpt: excerpt.trim().slice(0, 140) });

    if (isStringFile(file)) {
        text.split("\n").forEach((raw, i) => {
            for (const [id, pass, re, message] of LINE_RULES) {
                if (pass === 5 && re.test(raw)) add(id, pass, i + 1, message, raw);
            }
        });
        return findings;
    }

    const [tStart, tEnd] = templateRange(file, text);
    const lines = text.split("\n");
    lines.forEach((raw, i) => {
        for (const [id, pass, re, message] of LINE_RULES) {
            if (re.test(raw)) add(id, pass, i + 1, message, raw);
        }
        if (/^\s*\{?\s*\w+\s*:\s*\{\s*label:[^}]*\btone:[^}]*\b(hint|description|sub)\s*:\s*["'`][^"'`]{12,}/.test(raw)) {
            findings.splice(findings.findIndex((f) => f.line === i + 1 && f.rule === "narrating-caption"), 1);
        }
    });

    if (file.endsWith(".rs")) {
        // egui frames and iced containers take the width of their content unless told otherwise,
        // so stacked sections end at different right edges.
        const frames = [...text.matchAll(/\bui\.group\(|\bFrame::(group|none|new|default|canvas)\(|\bcontainer\(/g)];
        const loose = frames.filter((f) => !/set_(min_|max_)?width|available_width|available_size|desired_width|exact_width|\.width\(|Length::Fill|\bFill\b|top_down_justified|Grid::new|columns\(/.test(text.slice(f.index, f.index + 600)));
        // Language options drawn as selectable buttons, outside a ComboBox or pick list.
        const langOption = /\b(selectable_value|selectable_label|radio_value|toggle_value|radio)\s*\([^\n]*(\b(Lang|Language|Locale|Idioma)::|"(English|Portugu[eê]s[^"]*|Espa[nñ]ol|Fran[cç]ais|Deutsch)")/g;
        const options = [...text.matchAll(langOption)].filter((m) => !/ComboBox|show_ui|pick_list|menu_button|PickList/.test(text.slice(Math.max(0, m.index - 500), m.index)));
        if (options.length >= 2) add("language-as-buttons", 7, lineOf(text, options[0].index), LANGUAGE_MESSAGE, options[0][0]);
        // An option of a choice that is also the title of another section: the choice and its setup are apart.
        const optionLabels = [...text.matchAll(/\b(selectable_value|selectable_label|radio_value|radio)\s*\([^\n]*"([^"]+)"\s*\)/g)].map((m) => ({ label: m[2], index: m.index }));
        const titles = [...text.matchAll(/\b(heading|strong|RichText::new)\(\s*"([^"]+)"\s*\)(\.strong\(\)|\.heading\(\))?/g)].filter((m) => m[1] !== "RichText::new" || m[3]).map((m) => ({ label: m[2], index: m.index }));
        for (const option of optionLabels) {
            const title = titles.find((t) => t.label.toLowerCase() === option.label.toLowerCase());
            if (!title) continue;
            add("option-apart-from-settings", 7, lineOf(text, title.index), `"${option.label}" is an option on line ${lineOf(text, option.index)} and the title of its own section here: put the setup of the chosen option under the choice, in one component (a wizard when it takes steps)`, option.label);
            break;
        }
        if (loose.length >= 2) {
            add("shrink-wrapped-frame", 1, lineOf(text, loose[0].index), `${loose.length} frames or containers sized to their content: stacked sections end at different widths; give every section the column width`, loose.map((f) => f[0]).join(" "));
        }
    }

    const template = text.slice(tStart, tEnd);
    const offset = (index) => lineOf(text, tStart + index);

    // Status maps whose entries carry a label and a sentence: the sentence restates the badge.
    const statusMap = /\{\s*label:\s*["'`][^"'`]+["'`],\s*tone:[^}]*\b(hint|description|sub)\s*:\s*["'`][^"'`]{12,}["'`]/g;
    let m;
    while ((m = statusMap.exec(text))) {
        add("status-restated", 5, lineOf(text, m.index), "Status label with a sentence that restates it: keep the badge only", m[0]);
    }

    // The same value rendered more than once in one screen.
    const counts = new Map();
    const exprRe = /\{\{\s*([\w.?]+)\s*\}\}/g;
    while ((m = exprRe.exec(template))) {
        const key = normalizeExpr(m[1]);
        if (!key.includes(".") || /^(row|item|rec|r|x|entry|step|cap|field|option|opt)\./.test(key)) continue;
        const entry = counts.get(key) ?? { n: 0, index: m.index };
        entry.n += 1;
        counts.set(key, entry);
    }
    for (const [key, { n, index }] of counts) {
        if (n >= 2) add("value-repeated", 7, offset(index), `\`${key}\` is rendered ${n} times on this screen: say each fact once`, key);
    }

    // Several equal cards in one grid row.
    const cardCount = (template.match(/<section[^>]*class="[^"]*\b(panel-card|card)\b/g) || []).length;
    const grid = template.match(/class="[^"]*\bgrid\b[^"]*\b(lg:|md:|sm:)?grid-cols-3\b/);
    if (grid && cardCount >= 3) {
        add("equal-card-grid", 7, offset(grid.index), "A three column grid of cards: on a detail page, one list of details usually reads better", grid[0]);
    }

    // Copy buttons on many values.
    const copies = (template.match(/@click="copy\(|onClick=\{\(\)\s*=>\s*copy\(|<Copy\b/g) || []).length;
    if (copies >= 4) add("copy-everywhere", 7, offset(template.search(/copy\(|<Copy\b/)), `${copies} copy controls on one screen: keep them for values people paste elsewhere`);

    // Count badges with no guard show "0".
    const countBadge = /<(UiBadge|Badge|span)\b(?![^>]*\bv-if=)[^>]*>\s*\{\{\s*[\w.?]+\.(length|count|total)\s*\}\}\s*<\/\1>/g;
    while ((m = countBadge.exec(template))) {
        add("empty-count-badge", 7, offset(m.index), "Count badge with no guard: an empty section shows \"0\"; show one line instead", m[0]);
    }

    // Native checkbox when the project has its own checkbox component.
    if (context.hasCheckboxComponent && !/checkbox/i.test(file.split("/").pop())) {
        const re = /<input\b[^>]*type="checkbox"/g;
        while ((m = re.exec(template))) add("native-checkbox", 7, offset(m.index), "Native checkbox: use the project's checkbox component", m[0]);
    }

    const asyncFns = new Set([...text.matchAll(/async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*async\b/g)].map((x) => x[1] || x[2]));
    const liveData = LIVE_DATA.test(text);
    for (const el of elements(template, "UiButton|Button|button|a|RouterLink")) {
        const label = visibleText(el.body);
        const line = offset(el.index);
        const attrs = el.attrs;
        if (DESTRUCTIVE.test(label) && !/danger|destructive|error|red-/.test(attrs + el.body)) {
            add("destructive-not-danger", 7, line, `"${label}" is not styled as a destructive action`, label);
        }
        if (REFRESH.test(label) && liveData) {
            add("refresh-on-live-page", 7, line, `"${label}" on a page that already updates itself: remove it`, label);
        }
        const click = attrs.match(/@click="(\w+)|onClick=\{(\w+)/);
        const fn = click && (click[1] || click[2]);
        if (fn && asyncFns.has(fn) && !/^(copy|toggle|open|close)/i.test(fn) && !/:disabled|:loading|disabled=\{|loading=\{|aria-busy/.test(attrs) && !/…|\.\.\.|Spinner|animate-spin/.test(el.body)) {
            add("async-no-loading", 8, line, `"${label || fn}" runs ${fn}() with no busy state: disable it and show progress while it runs`, label);
        }
        const disabled = attrs.match(/:disabled="([^"]+)"/);
        if (disabled && !/ing\b|loading|busy|pending|saving|submitting|running/i.test(disabled[1]) && !/\btitle=|:title=|aria-describedby|tooltip/i.test(attrs)) {
            add("disabled-no-reason", 7, line, `"${label}" can be disabled (${disabled[1]}) with no reason shown: say why or hide it`, label);
        }
    }
    return findings;
}

// Visible strings and rendered values of one screen, for the inventory sheet.
const STRING_LINE = [
    /^\s*[\w.-]+\s*=\s*(.+?)\s*$/, // ftl, properties
    /^\s*"?[\w.-]+"?\s*:\s*"(.+)",?\s*$/, // json
    /^\s*[\w.-]+:\s*["']?(.+?)["']?\s*$/, // yaml
    /^\s*[\w.-]+\s*=\s*"(.+)"\s*$/, // toml
    /^msgstr\s+"(.+)"\s*$/, // po
];

function nativeStrings(file, text) {
    const entries = [];
    const skip = /^\s*(\/\/|\*|use\s|#\[|#!\[|mod\s|extern\s)|include_(bytes|str)!|env!|log::|tracing::|println!|eprintln!|debug!|info!|warn!|error!|\.expect\(|panic!|anyhow!|bail!|import\s/;
    text.split("\n").forEach((raw, i) => {
        if (skip.test(raw)) return;
        for (const m of raw.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
            const value = m[1].trim();
            if (/\p{L}/u.test(value) && (/\s/.test(value) || /^[\p{Lu}]/u.test(value) || /[^\x00-\x7f]/.test(value))) entries.push({ kind: "text", value, line: i + 1 });
        }
    });
    return entries;
}

function fileStrings(text) {
    const entries = [];
    text.split("\n").forEach((raw, i) => {
        if (/^\s*(#|\/\/|[{}\[\]],?\s*$)/.test(raw)) return;
        for (const re of STRING_LINE) {
            const m = raw.match(re);
            if (m && /\p{L}/u.test(m[1])) {
                entries.push({ kind: "text", value: m[1].trim(), line: i + 1 });
                return;
            }
        }
    });
    return entries;
}

function withRepeats(entries) {
    const key = (e) => `${e.kind === "value" ? "v" : "t"}:${e.value.toLowerCase()}`;
    const seen = new Map();
    for (const e of entries) seen.set(key(e), (seen.get(key(e)) ?? 0) + 1);
    return entries.sort((a, b) => a.line - b.line).map((e) => ({ ...e, repeats: seen.get(key(e)) }));
}

export function extractStrings(file, text) {
    if (isStringFile(file)) return withRepeats(fileStrings(text));
    if (file.endsWith(".rs") || file.endsWith(".slint")) return withRepeats(nativeStrings(file, text));
    const [tStart, tEnd] = templateRange(file, text);
    const template = text.slice(tStart, tEnd);
    const entries = [];
    const textRe = />([^<>{}]*[\p{L}][^<>{}]*)</gu;
    let m;
    while ((m = textRe.exec(template))) {
        const value = m[1].replace(/\s+/g, " ").trim();
        if (value) entries.push({ kind: "text", value, line: lineOf(text, tStart + m.index) });
    }
    const exprRe = /\{\{\s*([\s\S]*?)\s*\}\}/g;
    while ((m = exprRe.exec(template))) {
        entries.push({ kind: "value", value: normalizeExpr(m[1]), line: lineOf(text, tStart + m.index) });
    }
    const attrRe = /(?<![:@-])\b(placeholder|title|label|aria-label|hint|description)="([^"{}]*[\p{L}][^"{}]*)"/gu;
    while ((m = attrRe.exec(template))) {
        entries.push({ kind: m[1], value: m[2].trim(), line: lineOf(text, tStart + m.index) });
    }
    const scriptLit = /\b(label|title|hint|sub|description|caption|subtitle|message)\s*:\s*["'`]([^"'`$]*[\p{L}][^"'`$]*)["'`]/gu;
    const script = tStart > 0 ? text.slice(0, tStart) : text;
    while ((m = scriptLit.exec(script))) {
        entries.push({ kind: `script ${m[1]}`, value: m[2].trim(), line: lineOf(text, m.index) });
    }
    return withRepeats(entries);
}

// Rounds and named passes from the user's words.
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, um: 1, uma: 1, dois: 2, duas: 2, "três": 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 };
const PASS_WORDS = {
    spacing: ["spacing", "espaçamento", "espacamento", "espacio"],
    radius: ["radius", "raio", "raios", "corner", "cantos"],
    color: ["color", "colour", "cor", "cores"],
    icons: ["icon", "icons", "ícone", "ícones", "icone", "icones", "alignment", "alinhamento"],
    copy: ["typography", "copy", "tipografia", "texto", "textos"],
    data: ["data display", "chart", "charts", "gráfico", "gráficos", "dados"],
    structure: ["actions", "structure", "ações", "acoes", "estrutura"],
    states: ["states", "feel", "estados"],
};

export function readRequest(request = "") {
    const text = request.toLowerCase();
    let rounds = null;
    const m = text.match(/(\d+|[a-zçê]+)\s+(passes|pass|passagens|passagem|passadas|passada|rounds|rodadas|rodada|vezes|times|pasadas)\b/);
    if (m) rounds = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1]] ?? null;
    const named = PASSES.filter((p) => PASS_WORDS[p.id].some((w) => new RegExp(`\\b${w}\\b`, "u").test(text))).map((p) => p.id);
    const only = /\b(only|just|só|somente|apenas|solo)\b/.test(text);
    return { rounds, passes: only && named.length ? named : PASSES.map((p) => p.id) };
}
