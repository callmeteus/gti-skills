(() => {
    const TOKEN = window.__ARTDIRECTOR_TOKEN__;
    const headers = {
        "Authorization": `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
    };
    const FORMATS = [
        { id: "png", api: "png", ext: "png", label: "PNG" },
        { id: "jpg", api: "jpeg", ext: "jpg", label: "JPEG" },
        { id: "pdf", api: "pdf", ext: "pdf", label: "PDF" }
    ];

    // Lucide icons (ISC), inlined so the studio works offline. See NOTICE.md.
    const ICONS = {
        "check": '<path d="M20 6 9 17l-5-5"/>',
        "x": '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        "rotate-ccw": '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
        "refresh-cw": '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
        "message-square-plus": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v6"/><path d="M9 10h6"/>',
        "scan": '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
        "copy": '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
        "trash-2": '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
        "file-down": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>',
        "loader-circle": '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
        "mouse-pointer-2": '<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>',
        "archive": '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
        "circle-check": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'
    };

    function icon(name, extra) {
        return `<svg class="icon${extra ? ` ${extra}` : ""}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
    }

    // Interface strings. The agent sets the language from the user's prompt (`--lang`); the
    // browser language is the fallback, and the masthead switcher overrides both for this viewer.
    const STRINGS = {
        en: {
            studio: "Studio", gallery: "Gallery", preview: "Preview",
            noVariants: "No variants yet", noVariantsHint: "Ask the agent for a piece. Variants appear here as soon as they are registered.",
            rejected: "Rejected", restore: "Restore", undoAccept: "Undo accept", accept: "Accept", reject: "Reject",
            status_draft: "draft", status_selected: "draft", status_accepted: "accepted", status_rejected: "rejected",
            toastRejected: "Rejected {id}. Restore it from Rejected.", toastAccepted: "Accepted {id}.", toastRestored: "Restored {id}.",
            nothingToPreview: "Nothing to preview", nothingToPreviewHint: "Open a variant from the gallery.",
            clickToComment: "Click an element to comment on it", reload: "Reload", artworkPreview: "Artwork preview",
            comment: "Comment", wholeBoardHint: "Whole board. Click an element to target it.", target: "Target: {what}",
            notePlaceholder: "What should change?", addComment: "Add comment", wholeBoard: "Whole board",
            prompt: "Prompt", promptHint: "Paste it into your agent's chat.", copyPrompt: "Copy prompt", clear: "Clear",
            export: "Export", variants: "Variants", remove: "Remove", removeComment: "Remove comment {n}",
            pickFailed: "Element picking could not attach to this artwork.",
            promptCopied: "Prompt copied.", copyBlocked: "Copy blocked by the browser. The prompt is selected; press Ctrl+C.",
            exporting: "Exporting...", rendering: "Rendering {format}...", renderingFor: "Rendering {format}... {s}s",
            downloading: "Downloading {format}... {kb} KB", exported: "Exported {file} in {s}s.", exportFailed: "Export failed: {message}",
            promptHead: "Art Director: edit variant \"{id}\" ({w}x{h}).", promptFile: "File: {file}",
            promptWhole: "whole board", promptSelector: "{what}, selector `{selector}`",
            promptTail: "Change only what these comments ask and keep the rest of the piece. Save the file, run the render check once for this variant, then stop."
        },
        pt: {
            studio: "Estúdio", gallery: "Galeria", preview: "Prévia",
            noVariants: "Nenhuma variante ainda", noVariantsHint: "Peça uma arte ao agente. As variantes aparecem aqui assim que forem registradas.",
            rejected: "Recusadas", restore: "Recuperar", undoAccept: "Desfazer aceite", accept: "Aceitar", reject: "Recusar",
            status_draft: "rascunho", status_selected: "rascunho", status_accepted: "aceita", status_rejected: "recusada",
            toastRejected: "{id} recusada. Recupere em Recusadas.", toastAccepted: "{id} aceita.", toastRestored: "{id} recuperada.",
            nothingToPreview: "Nada para mostrar", nothingToPreviewHint: "Abra uma variante na galeria.",
            clickToComment: "Clique em um elemento para comentar", reload: "Recarregar", artworkPreview: "Prévia da arte",
            comment: "Comentário", wholeBoardHint: "Arte inteira. Clique em um elemento para mirar nele.", target: "Alvo: {what}",
            notePlaceholder: "O que deve mudar?", addComment: "Adicionar comentário", wholeBoard: "Arte inteira",
            prompt: "Prompt", promptHint: "Cole no chat do seu agente.", copyPrompt: "Copiar prompt", clear: "Limpar",
            export: "Exportar", variants: "Variantes", remove: "Remover", removeComment: "Remover comentário {n}",
            pickFailed: "Não foi possível ativar a seleção de elementos nesta arte.",
            promptCopied: "Prompt copiado.", copyBlocked: "O navegador bloqueou a cópia. O prompt está selecionado; pressione Ctrl+C.",
            exporting: "Exportando...", rendering: "Renderizando {format}...", renderingFor: "Renderizando {format}... {s}s",
            downloading: "Baixando {format}... {kb} KB", exported: "{file} exportado em {s}s.", exportFailed: "Falha ao exportar: {message}",
            promptHead: "Art Director: edite a variante \"{id}\" ({w}x{h}).", promptFile: "Arquivo: {file}",
            promptWhole: "arte inteira", promptSelector: "{what}, seletor `{selector}`",
            promptTail: "Mude só o que estes comentários pedem e mantenha o resto da peça. Salve o arquivo, rode o render check uma vez nesta variante e pare."
        },
        es: {
            studio: "Estudio", gallery: "Galería", preview: "Vista previa",
            noVariants: "Aún no hay variantes", noVariantsHint: "Pide una pieza al agente. Las variantes aparecen aquí en cuanto se registran.",
            rejected: "Rechazadas", restore: "Recuperar", undoAccept: "Deshacer aceptación", accept: "Aceptar", reject: "Rechazar",
            status_draft: "borrador", status_selected: "borrador", status_accepted: "aceptada", status_rejected: "rechazada",
            toastRejected: "{id} rechazada. Recupérala en Rechazadas.", toastAccepted: "{id} aceptada.", toastRestored: "{id} recuperada.",
            nothingToPreview: "Nada que mostrar", nothingToPreviewHint: "Abre una variante desde la galería.",
            clickToComment: "Haz clic en un elemento para comentarlo", reload: "Recargar", artworkPreview: "Vista previa de la pieza",
            comment: "Comentario", wholeBoardHint: "Pieza completa. Haz clic en un elemento para apuntarlo.", target: "Objetivo: {what}",
            notePlaceholder: "¿Qué debe cambiar?", addComment: "Añadir comentario", wholeBoard: "Pieza completa",
            prompt: "Prompt", promptHint: "Pégalo en el chat de tu agente.", copyPrompt: "Copiar prompt", clear: "Limpiar",
            export: "Exportar", variants: "Variantes", remove: "Quitar", removeComment: "Quitar comentario {n}",
            pickFailed: "No se pudo activar la selección de elementos en esta pieza.",
            promptCopied: "Prompt copiado.", copyBlocked: "El navegador bloqueó la copia. El prompt está seleccionado; pulsa Ctrl+C.",
            exporting: "Exportando...", rendering: "Renderizando {format}...", renderingFor: "Renderizando {format}... {s}s",
            downloading: "Descargando {format}... {kb} KB", exported: "{file} exportado en {s}s.", exportFailed: "Error al exportar: {message}",
            promptHead: "Art Director: edita la variante \"{id}\" ({w}x{h}).", promptFile: "Archivo: {file}",
            promptWhole: "pieza completa", promptSelector: "{what}, selector `{selector}`",
            promptTail: "Cambia solo lo que piden estos comentarios y conserva el resto de la pieza. Guarda el archivo, ejecuta el render check una vez para esta variante y detente."
        }
    };
    const LANGS = Object.keys(STRINGS);

    function normalizeLang(value) {
        const short = String(value || "").toLowerCase().slice(0, 2);
        return LANGS.includes(short) ? short : null;
    }

    function storedLang() {
        try {
            return normalizeLang(localStorage.getItem("artdirector:lang"));
        } catch {
            return null;
        }
    }

    function t(key, vars) {
        const table = STRINGS[state.lang] || STRINGS.en;
        const text = table[key] !== undefined ? table[key] : STRINGS.en[key];
        return String(text).replace(/\{(\w+)\}/g, (match, name) => (vars && vars[name] !== undefined ? String(vars[name]) : match));
    }

    const state = {
        lang: storedLang() || normalizeLang(navigator.language) || "en",
        mode: "gallery",
        snapshot: null,
        activeId: null,
        pick: null,
        canvasObserver: null,
        exporting: null
    };

    const main = document.getElementById("main");
    const rail = document.getElementById("rail");
    const stage = document.getElementById("stage");
    const inspect = document.getElementById("inspect");
    const toasts = document.getElementById("toasts");

    document.querySelectorAll("[data-mode]").forEach((button) => {
        button.addEventListener("click", () => setMode(button.getAttribute("data-mode")));
    });

    document.querySelectorAll("[data-lang]").forEach((button) => {
        button.addEventListener("click", () => {
            const lang = button.getAttribute("data-lang");

            try {
                localStorage.setItem("artdirector:lang", lang);
            } catch {
                // The choice still applies to this tab.
            }

            setLang(lang);
        });
    });

    window.addEventListener("message", onPick);

    function setLang(lang) {
        state.lang = normalizeLang(lang) || "en";
        document.documentElement.lang = state.lang === "pt" ? "pt-BR" : state.lang;
        document.querySelectorAll("[data-i18n]").forEach((node) => {
            node.textContent = t(node.getAttribute("data-i18n"));
        });
        document.querySelectorAll("[data-lang]").forEach((button) => {
            button.classList.toggle("is-on", button.getAttribute("data-lang") === state.lang);
        });
        render();
    }

    function setMode(mode) {
        state.mode = mode;
        document.querySelectorAll("[data-mode]").forEach((item) => {
            item.classList.toggle("is-on", item.getAttribute("data-mode") === mode);
        });
        render();
    }

    async function api(path, options) {
        const res = await fetch(path, {
            ...options,
            headers: {
                ...headers,
                ...(options && options.headers ? options.headers : {})
            }
        });
        const body = await res.json();

        if (!res.ok || body.ok === false) {
            throw new Error(body.summary || res.statusText);
        }

        return body;
    }

    async function refresh() {
        state.snapshot = await api("/v1/session");
        document.getElementById("project-name").textContent = state.snapshot.project.name;

        if (!variantById(state.activeId)) {
            state.activeId = state.snapshot.project.activeVariantId || (variants()[0] && variants()[0].id) || null;
        }

        setLang(storedLang() || normalizeLang(state.snapshot.project.language) || state.lang);
    }

    // New variants written by the agent show up without a reload. The open preview is left alone.
    async function watchVariants() {
        if (document.hidden || !state.snapshot) {
            return;
        }

        try {
            const snap = await api("/v1/session");
            const before = variants().map((item) => item.id).join("|");
            const after = (snap.variants || []).map((item) => item.id).join("|");
            state.snapshot = snap;

            if (before !== after) {
                if (state.mode === "gallery") {
                    render();
                } else {
                    paintVariantList();
                }
            }
        } catch {
            return;
        }
    }

    function variants() {
        return (state.snapshot && state.snapshot.variants) ? state.snapshot.variants : [];
    }

    function variantById(id) {
        return variants().find((item) => item.id === id);
    }

    function render() {
        if (!state.snapshot) {
            return;
        }

        clearCanvasObserver();
        stage.classList.remove("is-canvas");
        main.classList.toggle("is-wide", state.mode === "gallery");

        if (state.mode === "gallery") {
            renderGallery();
        } else {
            renderPreview();
        }
    }

    function renderGallery() {
        const list = variants().filter((item) => item.status !== "rejected");
        const rejected = variants().filter((item) => item.status === "rejected");
        rail.innerHTML = "";
        inspect.innerHTML = "";
        stage.innerHTML = (list.length
            ? `<div class="gallery">${list.map(variantCard).join("")}</div>`
            : `<div class="empty"><h2>${t("noVariants")}</h2><p>${t("noVariantsHint")}</p></div>`)
            + (rejected.length
                ? `<details class="rejected"><summary>${icon("archive")}${t("rejected")} (${rejected.length})</summary>
                    <div class="gallery">${rejected.map(variantCard).join("")}</div>
                </details>`
                : "");
        stage.querySelectorAll("[data-status]").forEach((button) => {
            button.onclick = (event) => {
                event.stopPropagation();
                void setStatus(button.getAttribute("data-id"), button.getAttribute("data-status"));
            };
        });
        stage.querySelectorAll("[data-variant]").forEach((card) => {
            card.onclick = () => openPreview(card.getAttribute("data-variant"));
            card.onkeydown = (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openPreview(card.getAttribute("data-variant"));
                }
            };
        });
        observeFits(stage);
    }

    function variantCard(variant) {
        const id = escape(variant.id);
        const actions = variant.status === "rejected"
            ? `<button type="button" data-id="${id}" data-status="draft">${icon("rotate-ccw")}${t("restore")}</button>`
            : variant.status === "accepted"
                ? `<button type="button" data-id="${id}" data-status="draft">${icon("rotate-ccw")}${t("undoAccept")}</button>
                   <button type="button" data-id="${id}" data-status="rejected">${icon("x")}${t("reject")}</button>`
                : `<button type="button" class="accept" data-id="${id}" data-status="accepted">${icon("check")}${t("accept")}</button>
                   <button type="button" data-id="${id}" data-status="rejected">${icon("x")}${t("reject")}</button>`;
        return `<article class="card is-${escape(variant.status)}" data-variant="${id}" tabindex="0">
            ${previewFrame(`/artwork/${encodeURIComponent(variant.id)}?token=${TOKEN}`, variant.title, variant.width, variant.height)}
            <header><strong>${escape(variant.title)}</strong><span class="badge">${variant.status === "accepted" ? icon("circle-check") : ""}${escape(t(`status_${variant.status}`))}</span></header>
            <footer>${escape(formatName(variant))} · ${variant.width}×${variant.height}</footer>
            <div class="card-actions">${actions}</div>
        </article>`;
    }

    async function setStatus(id, status) {
        try {
            await api("/v1/variants/status", {
                method: "POST",
                body: JSON.stringify({ id, status })
            });
            await refresh();
            toast(t(status === "rejected" ? "toastRejected" : status === "accepted" ? "toastAccepted" : "toastRestored", { id }));
        } catch (err) {
            toast(err.message, "error");
        }
    }

    function previewFrame(src, title, width, height) {
        return `<div class="preview" data-art-width="${Number(width) || 1}" data-art-height="${Number(height) || 1}">
            <div class="canvas-fit">
                <iframe src="${src}" title="${escape(title)}" loading="lazy"></iframe>
            </div>
        </div>`;
    }

    function sizeLabel(format) {
        return format.short || format.label || format.id || `${format.width}×${format.height}`;
    }

    function formatName(variant) {
        const formats = state.snapshot.formats || [];
        const match = formats.find((item) => item.id === variant.formatId)
            || formats.find((item) => item.width === variant.width && item.height === variant.height);
        return match ? sizeLabel(match) : (variant.direction || `${variant.width}×${variant.height}`);
    }

    async function openPreview(id) {
        state.activeId = id;
        state.pick = null;

        setMode("preview");
    }

    function renderPreview() {
        const variant = variantById(state.activeId);

        if (!variant) {
            rail.innerHTML = "";
            inspect.innerHTML = "";
            stage.innerHTML = `<div class="empty"><h2>${t("nothingToPreview")}</h2><p>${t("nothingToPreviewHint")}</p></div>`;
            return;
        }

        stage.classList.add("is-canvas");
        stage.innerHTML = `<div class="canvas-wrap">
                <div class="canvas-bar">
                    <span id="canvas-meta">${variant.width} × ${variant.height}</span>
                    <span class="muted">${icon("mouse-pointer-2")}${t("clickToComment")}</span>
                    <button type="button" class="link" id="reload">${icon("refresh-cw")}${t("reload")}</button>
                </div>
                <div class="canvas" data-art-width="${variant.width}" data-art-height="${variant.height}">
                    <div class="canvas-fit">
                        <iframe id="live-frame" src="/artwork/${encodeURIComponent(variant.id)}?token=${TOKEN}" title="${t("artworkPreview")}"></iframe>
                    </div>
                </div>
            </div>`;
        inspect.innerHTML = `
            <section class="block">
                <h2>${t("comment")}</h2>
                <p class="target" id="target">${t("wholeBoardHint")}</p>
                <textarea id="note" placeholder="${t("notePlaceholder")}"></textarea>
                <div class="row">
                    <button type="button" class="primary" id="add-note">${icon("message-square-plus")}${t("addComment")}</button>
                    <button type="button" id="clear-target">${icon("scan")}${t("wholeBoard")}</button>
                </div>
                <ol class="notes" id="notes"></ol>
            </section>
            <section class="block" id="prompt-block">
                <h2>${t("prompt")}</h2>
                <p class="muted">${t("promptHint")}</p>
                <pre class="prompt" id="prompt"></pre>
                <div class="row">
                    <button type="button" class="primary" id="copy-prompt">${icon("copy")}${t("copyPrompt")}</button>
                    <button type="button" id="clear-notes">${icon("trash-2")}${t("clear")}</button>
                </div>
            </section>
            <section class="block">
                <h2>${t("export")}</h2>
                <div class="row" id="export-row">${FORMATS.map((item) =>
                    `<button type="button" data-export="${item.id}">${icon("file-down")}${item.label}</button>`
                ).join("")}</div>
                <div class="progress" id="progress" hidden>
                    <div class="progress-track"><div class="progress-bar" id="progress-bar"></div></div>
                    <p id="progress-text"></p>
                </div>
            </section>`;
        paintVariantList();
        bindPreview(variant);
        paintNotes();
        paintExport();
        observeFits(stage);
    }

    function paintVariantList() {
        if (state.mode !== "preview") {
            return;
        }

        rail.innerHTML = `<h2>${t("variants")}</h2><div class="variant-list">${variants().filter((item) => item.status !== "rejected" || item.id === state.activeId).map((item) =>
            `<button type="button" class="${item.id === state.activeId ? "is-on" : ""}" data-open="${escape(item.id)}">
                <strong>${escape(item.title)}</strong>
                <span>${escape(formatName(item))} · ${item.width}×${item.height}</span>
            </button>`
        ).join("")}</div>`;
        rail.querySelectorAll("[data-open]").forEach((button) => {
            button.onclick = () => openPreview(button.getAttribute("data-open"));
        });
    }

    function bindPreview(variant) {
        const frame = document.getElementById("live-frame");
        frame.addEventListener("load", () => {
            try {
                const doc = frame.contentDocument;
                const script = doc.createElement("script");
                script.src = `/live.js?token=${TOKEN}`;
                script.onload = () => sendMarks();
                doc.documentElement.appendChild(script);
            } catch {
                toast(t("pickFailed"), "error");
            }
        });

        document.getElementById("reload").onclick = () => renderPreview();

        const note = document.getElementById("note");
        note.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                addNote();
            }
        });
        document.getElementById("add-note").onclick = addNote;
        document.getElementById("clear-target").onclick = () => {
            state.pick = null;
            paintTarget();
            postToFrame({ type: "artdirector-clear" });
        };
        document.getElementById("copy-prompt").onclick = copyPrompt;
        document.getElementById("clear-notes").onclick = () => {
            saveNotes(variant.id, []);
            paintNotes();
        };
        inspect.querySelectorAll("[data-export]").forEach((button) => {
            button.onclick = () => exportAs(button.getAttribute("data-export"));
        });
    }

    function onPick(event) {
        if (!event.data || event.data.type !== "artdirector-select") {
            return;
        }

        state.pick = event.data.selection;
        paintTarget();
        const note = document.getElementById("note");

        if (note) {
            note.focus();
        }
    }

    function paintTarget() {
        const node = document.getElementById("target");

        if (node) {
            node.textContent = state.pick ? t("target", { what: describe(state.pick) }) : t("wholeBoardHint");
            node.classList.toggle("is-set", Boolean(state.pick));
        }
    }

    function describe(selection) {
        const text = selection.text ? ` "${selection.text.slice(0, 40)}"` : "";
        return `${selection.tagName}${text}`;
    }

    // Comments live in this browser only. The prompt is the hand-off, so no harness needs a trigger.
    function notesKey(id) {
        return `artdirector:notes:${state.snapshot.project.name}:${id}`;
    }

    function loadNotes(id) {
        try {
            return JSON.parse(localStorage.getItem(notesKey(id)) || "[]");
        } catch {
            return state.memoryNotes && state.memoryNotes[id] ? state.memoryNotes[id] : [];
        }
    }

    function saveNotes(id, notes) {
        state.memoryNotes = { ...(state.memoryNotes || {}), [id]: notes };

        try {
            localStorage.setItem(notesKey(id), JSON.stringify(notes));
        } catch {
            // Storage can be blocked; the in-memory copy still works for this tab.
        }
    }

    function addNote() {
        const note = document.getElementById("note");
        const text = note.value.trim();

        if (!text) {
            note.focus();
            return;
        }

        const notes = loadNotes(state.activeId);
        notes.push({ text, selection: state.pick });
        saveNotes(state.activeId, notes);
        note.value = "";
        state.pick = null;
        paintTarget();
        postToFrame({ type: "artdirector-clear" });
        paintNotes();
    }

    function paintNotes() {
        const list = document.getElementById("notes");

        if (!list) {
            return;
        }

        const notes = loadNotes(state.activeId);
        list.innerHTML = notes.map((item, index) => `<li>
                <div><span class="where">${escape(item.selection ? describe(item.selection) : t("wholeBoard"))}</span>${escape(item.text)}</div>
                <button type="button" class="link" data-remove="${index}" aria-label="${t("removeComment", { n: index + 1 })}">${icon("trash-2")}${t("remove")}</button>
            </li>`).join("");
        list.querySelectorAll("[data-remove]").forEach((button) => {
            button.onclick = () => {
                const next = loadNotes(state.activeId);
                next.splice(Number(button.getAttribute("data-remove")), 1);
                saveNotes(state.activeId, next);
                paintNotes();
            };
        });
        document.getElementById("prompt-block").hidden = notes.length === 0;
        document.getElementById("prompt").textContent = buildPrompt(notes);
        sendMarks();
    }

    function sendMarks() {
        const marks = loadNotes(state.activeId)
            .map((item, index) => ({ n: index + 1, selector: item.selection ? item.selection.selector : null }))
            .filter((item) => item.selector);
        postToFrame({ type: "artdirector-marks", marks });
    }

    function postToFrame(message) {
        const frame = document.getElementById("live-frame");

        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage(message, "*");
        }
    }

    function buildPrompt(notes) {
        const variant = variantById(state.activeId);

        if (!variant || !notes.length) {
            return "";
        }

        const lines = [
            t("promptHead", { id: variant.id, w: variant.width, h: variant.height }),
            t("promptFile", { file: variant.htmlFile || variant.htmlPath }),
            ""
        ];

        notes.forEach((item, index) => {
            const where = item.selection
                ? t("promptSelector", { what: describe(item.selection), selector: item.selection.selector })
                : t("promptWhole");
            lines.push(`${index + 1}. [${where}]`);
            lines.push(`   ${item.text}`);
        });

        lines.push("");
        lines.push(t("promptTail"));
        return lines.join("\n");
    }

    async function copyPrompt() {
        const text = document.getElementById("prompt").textContent;

        try {
            await navigator.clipboard.writeText(text);
            toast(t("promptCopied"));
        } catch {
            const range = document.createRange();
            range.selectNodeContents(document.getElementById("prompt"));
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            toast(t("copyBlocked"), "error");
        }
    }

    function paintExport() {
        const busy = state.exporting;
        inspect.querySelectorAll("[data-export]").forEach((button) => {
            const format = FORMATS.find((item) => item.id === button.getAttribute("data-export"));
            const mine = busy && busy.format === format.id;
            button.disabled = Boolean(busy);
            button.classList.toggle("is-busy", Boolean(mine));
            button.innerHTML = mine ? `${icon("loader-circle", "spin")}${t("exporting")}` : `${icon("file-down")}${format.label}`;
        });
        const progress = document.getElementById("progress");

        if (!progress) {
            return;
        }

        progress.hidden = !busy;

        if (busy) {
            const bar = document.getElementById("progress-bar");
            bar.classList.toggle("is-indeterminate", busy.ratio === null);
            bar.style.width = busy.ratio === null ? "" : `${Math.round(busy.ratio * 100)}%`;
            document.getElementById("progress-text").textContent = busy.label;
        }
    }

    // The server renders first and then streams the file, so the bar is indeterminate while
    // rendering and shows real bytes once the download starts.
    async function exportAs(formatId) {
        const format = FORMATS.find((item) => item.id === formatId);
        const id = state.activeId;

        if (!format || !id || state.exporting) {
            return;
        }

        const started = Date.now();
        state.exporting = { format: format.id, ratio: null, label: t("rendering", { format: format.label }) };
        paintExport();
        const timer = window.setInterval(() => {
            if (state.exporting && state.exporting.ratio === null) {
                state.exporting.label = t("renderingFor", { format: format.label, s: Math.round((Date.now() - started) / 1000) });
                paintExport();
            }
        }, 500);

        try {
            const res = await fetch("/v1/export", {
                method: "POST",
                headers,
                body: JSON.stringify({ id, format: format.api })
            });

            if (!res.ok) {
                let message = res.statusText;

                try {
                    const body = await res.json();
                    message = body.summary || message;
                } catch {
                    // Keep the HTTP status text when the body is not JSON.
                }

                throw new Error(message);
            }

            const total = Number(res.headers.get("Content-Length")) || 0;
            const chunks = [];
            let received = 0;
            const reader = res.body.getReader();

            for (;;) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                chunks.push(value);
                received += value.length;
                state.exporting = {
                    format: format.id,
                    ratio: total ? received / total : null,
                    label: t("downloading", { format: format.label, kb: Math.round(received / 1024) })
                };
                paintExport();
            }

            const blob = new Blob(chunks, { type: res.headers.get("Content-Type") || "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${id}.${format.ext}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast(t("exported", { file: `${id}.${format.ext}`, s: ((Date.now() - started) / 1000).toFixed(1) }));
        } catch (err) {
            toast(t("exportFailed", { message: err.message }), "error");
        } finally {
            window.clearInterval(timer);
            state.exporting = null;
            paintExport();
        }
    }

    function clearCanvasObserver() {
        if (state.canvasObserver) {
            state.canvasObserver.disconnect();
            state.canvasObserver = null;
        }
    }

    function fitArtwork(box, frame, width, height) {
        const artW = Math.max(1, Number(width) || 1);
        const artH = Math.max(1, Number(height) || 1);
        const boxW = box.clientWidth;
        const boxH = box.clientHeight;

        if (boxW < 2 || boxH < 2) {
            return 1;
        }

        const scale = Math.min(boxW / artW, boxH / artH, 1);
        const fit = frame.parentElement;
        fit.style.width = `${artW * scale}px`;
        fit.style.height = `${artH * scale}px`;
        frame.style.width = `${artW}px`;
        frame.style.height = `${artH}px`;
        frame.style.transform = `scale(${scale})`;
        return scale;
    }

    function observeFits(root) {
        clearCanvasObserver();
        const boxes = [...root.querySelectorAll("[data-art-width]")];

        if (!boxes.length) {
            return;
        }

        const layout = () => {
            boxes.forEach((box) => {
                const frame = box.isConnected ? box.querySelector("iframe") : null;

                if (!frame) {
                    return;
                }

                const width = box.getAttribute("data-art-width");
                const height = box.getAttribute("data-art-height");
                const scale = fitArtwork(box, frame, width, height);
                const meta = document.getElementById("canvas-meta");

                if (meta && box.classList.contains("canvas")) {
                    meta.textContent = `${width} × ${height} · ${Math.round(scale * 100)}%`;
                }
            });
        };

        layout();
        requestAnimationFrame(layout);
        const observer = new ResizeObserver(layout);
        boxes.forEach((box) => observer.observe(box));
        state.canvasObserver = observer;
    }

    function toast(message, kind) {
        const node = document.createElement("button");
        node.type = "button";
        node.className = kind === "error" ? "toast is-error" : "toast";
        node.setAttribute("role", kind === "error" ? "alert" : "status");
        node.textContent = message;
        node.onclick = () => dismissToast(node);
        toasts.appendChild(node);
        window.setTimeout(() => dismissToast(node), kind === "error" ? 7000 : 3200);
    }

    function dismissToast(node) {
        if (!node || !node.isConnected) {
            return;
        }

        node.classList.add("is-out");
        window.setTimeout(() => node.remove(), 180);
    }

    function escape(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll("\"", "&quot;");
    }

    window.setInterval(() => {
        void watchVariants();
    }, 3000);

    refresh().catch((err) => {
        toast(err.message, "error");
    });
})();
