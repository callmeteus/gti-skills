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
        "circle-check": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
        "pin": '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
        "image-plus": '<path d="M16 5h6"/><path d="M19 2v6"/><path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><circle cx="9" cy="9" r="2"/>',
        "palette": '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
        "sticky-note": '<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>',
        "chevron-right": '<path d="m9 18 6-6-6-6"/>',
        "ban": '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
        "pencil": '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
        "repeat": '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
        "layers": '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>'
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
            promptTail: "Change only what these comments ask and keep the rest of the piece. Save the file, run the render check once for this variant, then stop.",
            promptArt: "Art: {title} (pass --request {id} to the CLI).",
            moodboard: "Mood board", current: "Current", variantCount: "{n} variants", variantOne: "1 variant", noArtVariants: "No variants in this art yet.",
            pin: "Pin", unpin: "Unpin", toastPinned: "Pinned {id} to the mood board.", toastUnpinned: "Removed {id} from the mood board.",
            moodDrop: "Add images: click, drop, or paste", moodCaption: "Caption (optional)", moodAddColor: "Add color",
            moodNotePlaceholder: "A reference, a word, a feeling", moodAddNote: "Add note",
            moodHint: "Shared by every art in this chat. The agent reads it before each new piece.",
            moodEmpty: "The mood board is empty", moodEmptyHint: "Add images, colors, and notes, or pin variants from the gallery.",
            moodMissing: "This variant no longer exists.", moodByAgent: "agent", moodByYou: "you",
            moodTooBig: "{name} is over 15 MB.", moodNotImage: "{name} is not an image.", moodAdded: "Added to the mood board.",
            guidelines: "Guidelines", ruleDo: "Do", ruleDont: "Don't", ruleText: "One rule, for example: keep the logo at the top",
            ruleWhy: "Why (optional)", ruleAdd: "Add rule", ruleScopeWorkspace: "This workspace", ruleScopeUser: "Everywhere",
            rulesHint: "The agent learns these from your feedback and follows them in every new piece. Workspace rules apply only to {workspace}; Everywhere rules apply to all your work.",
            rulesEmpty: "No guidelines yet", rulesEmptyHint: "Write a rule here, or tell the agent what you like and dislike. It saves what it learns.",
            ruleLearned: "learned", ruleByYou: "you", ruleHits: "confirmed {n}x", ruleEdit: "Edit", ruleSave: "Save", ruleCancel: "Cancel",
            ruleFlip: "Flip", ruleAdded: "Rule added.", ruleConfirmed: "That rule already existed; confirmed it again.", ruleFlipped: "Rule flipped.",
            rulesDont: "Don'ts", rulesDo: "Dos", ruleRemoved: "Rule removed."
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
            promptTail: "Mude só o que estes comentários pedem e mantenha o resto da peça. Salve o arquivo, rode o render check uma vez nesta variante e pare.",
            promptArt: "Arte: {title} (passe --request {id} para a CLI).",
            moodboard: "Mood board", current: "Atual", variantCount: "{n} variantes", variantOne: "1 variante", noArtVariants: "Nenhuma variante nesta arte ainda.",
            pin: "Fixar", unpin: "Desafixar", toastPinned: "{id} fixada no mood board.", toastUnpinned: "{id} removida do mood board.",
            moodDrop: "Adicionar imagens: clique, solte ou cole", moodCaption: "Legenda (opcional)", moodAddColor: "Adicionar cor",
            moodNotePlaceholder: "Uma referência, uma palavra, uma sensação", moodAddNote: "Adicionar nota",
            moodHint: "Compartilhado por todas as artes deste chat. O agente lê antes de cada peça nova.",
            moodEmpty: "O mood board está vazio", moodEmptyHint: "Adicione imagens, cores e notas, ou fixe variantes pela galeria.",
            moodMissing: "Esta variante não existe mais.", moodByAgent: "agente", moodByYou: "você",
            moodTooBig: "{name} passa de 15 MB.", moodNotImage: "{name} não é uma imagem.", moodAdded: "Adicionado ao mood board.",
            guidelines: "Diretrizes", ruleDo: "Fazer", ruleDont: "Evitar", ruleText: "Uma regra, por exemplo: manter o logo no topo",
            ruleWhy: "Por quê (opcional)", ruleAdd: "Adicionar regra", ruleScopeWorkspace: "Este workspace", ruleScopeUser: "Em tudo",
            rulesHint: "O agente aprende estas regras com o seu feedback e segue em cada peça nova. Regras do workspace valem só para {workspace}; regras \"Em tudo\" valem para todo o seu trabalho.",
            rulesEmpty: "Nenhuma diretriz ainda", rulesEmptyHint: "Escreva uma regra aqui, ou diga ao agente do que você gosta e do que não gosta. Ele salva o que aprende.",
            ruleLearned: "aprendida", ruleByYou: "você", ruleHits: "confirmada {n}x", ruleEdit: "Editar", ruleSave: "Salvar", ruleCancel: "Cancelar",
            ruleFlip: "Inverter", ruleAdded: "Regra adicionada.", ruleConfirmed: "Essa regra já existia; foi confirmada de novo.", ruleFlipped: "Regra invertida.",
            rulesDont: "Evitar", rulesDo: "Fazer", ruleRemoved: "Regra removida."
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
            promptTail: "Cambia solo lo que piden estos comentarios y conserva el resto de la pieza. Guarda el archivo, ejecuta el render check una vez para esta variante y detente.",
            promptArt: "Pieza: {title} (pasa --request {id} a la CLI).",
            moodboard: "Mood board", current: "Actual", variantCount: "{n} variantes", variantOne: "1 variante", noArtVariants: "Aún no hay variantes en esta pieza.",
            pin: "Fijar", unpin: "Quitar", toastPinned: "{id} fijada en el mood board.", toastUnpinned: "{id} quitada del mood board.",
            moodDrop: "Añadir imágenes: haz clic, suelta o pega", moodCaption: "Leyenda (opcional)", moodAddColor: "Añadir color",
            moodNotePlaceholder: "Una referencia, una palabra, una sensación", moodAddNote: "Añadir nota",
            moodHint: "Compartido por todas las piezas de este chat. El agente lo lee antes de cada pieza nueva.",
            moodEmpty: "El mood board está vacío", moodEmptyHint: "Añade imágenes, colores y notas, o fija variantes desde la galería.",
            moodMissing: "Esta variante ya no existe.", moodByAgent: "agente", moodByYou: "tú",
            moodTooBig: "{name} supera 15 MB.", moodNotImage: "{name} no es una imagen.", moodAdded: "Añadido al mood board.",
            guidelines: "Pautas", ruleDo: "Hacer", ruleDont: "Evitar", ruleText: "Una regla, por ejemplo: mantener el logo arriba",
            ruleWhy: "Por qué (opcional)", ruleAdd: "Añadir regla", ruleScopeWorkspace: "Este workspace", ruleScopeUser: "En todo",
            rulesHint: "El agente aprende estas reglas de tus comentarios y las sigue en cada pieza nueva. Las reglas del workspace valen solo para {workspace}; las de \"En todo\" valen para todo tu trabajo.",
            rulesEmpty: "Aún no hay pautas", rulesEmptyHint: "Escribe una regla aquí, o dile al agente qué te gusta y qué no. Guarda lo que aprende.",
            ruleLearned: "aprendida", ruleByYou: "tú", ruleHits: "confirmada {n}x", ruleEdit: "Editar", ruleSave: "Guardar", ruleCancel: "Cancelar",
            ruleFlip: "Invertir", ruleAdded: "Regla añadida.", ruleConfirmed: "Esa regla ya existía; se confirmó de nuevo.", ruleFlipped: "Regla invertida.",
            rulesDont: "Evitar", rulesDo: "Hacer", ruleRemoved: "Regla eliminada."
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
        arts: [],
        mood: [],
        rules: [],
        rulesWorkspace: "",
        editingRule: null,
        ruleKind: "dont",
        artOpen: {},
        active: null,
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
    document.addEventListener("paste", onPaste);

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
        const [snapshot, history, mood, guides] = await Promise.all([
            api("/v1/session"),
            api("/v1/history"),
            api("/v1/moodboard"),
            api("/v1/guidelines")
        ]);
        state.snapshot = snapshot;
        state.arts = history.arts || [];
        state.mood = mood.items || [];
        state.rules = guides.rules || [];
        state.rulesWorkspace = guides.workspace || "";
        document.getElementById("project-name").textContent = state.snapshot.project.name;

        if (!variantByKey(state.active)) {
            const current = state.arts.find((art) => art.current) || state.arts[0];
            const first = current ? withArt(current).find((item) => item.id === state.snapshot.project.activeVariantId) || withArt(current)[0] : null;
            state.active = first ? keyOf(first) : null;
        }

        setLang(storedLang() || normalizeLang(state.snapshot.project.language) || state.lang);
    }

    // New arts and variants written by the agent show up without a reload. The open preview is left alone.
    async function watchVariants() {
        if (document.hidden || !state.snapshot) {
            return;
        }

        try {
            const [history, mood, guides] = await Promise.all([api("/v1/history"), api("/v1/moodboard"), api("/v1/guidelines")]);
            const before = signature(state.arts);
            const moodBefore = state.mood.map((item) => item.id).join("|");
            const rulesBefore = ruleSignature(state.rules);
            state.arts = history.arts || [];
            state.mood = mood.items || [];
            state.rules = guides.rules || [];
            const rulesChanged = rulesBefore !== ruleSignature(state.rules);
            const artsChanged = before !== signature(state.arts);
            const current = state.arts.find((art) => art.current);

            if (current) {
                document.getElementById("project-name").textContent = current.title;
            }
            const moodChanged = moodBefore !== state.mood.map((item) => item.id).join("|");

            if (state.mode === "gallery" && (artsChanged || moodChanged)) {
                render();
            } else if (state.mode === "moodboard" && moodChanged) {
                render();
            } else if (state.mode === "guidelines" && rulesChanged && !state.editingRule && !guidelineDraft()) {
                render();
            } else if (state.mode === "preview" && artsChanged) {
                paintVariantList();
            }
        } catch {
            return;
        }
    }

    function ruleSignature(rules) {
        return rules.map((rule) => `${rule.id}:${rule.updatedAt}`).join("|");
    }

    function signature(arts) {
        return arts.map((art) => `${art.requestId || ""}:${art.current}:${art.variants.map((item) => `${item.id}=${item.status}`).join(",")}`).join("|");
    }

    // A variant is addressed by its art (request) and id, since ids repeat across arts.
    function keyOf(variant) {
        return `${variant.requestId || ""}/${variant.id}`;
    }

    function withArt(art) {
        return art.variants.map((item) => ({ ...item, requestId: art.requestId, artTitle: art.title }));
    }

    function variants() {
        return state.arts.flatMap(withArt);
    }

    function variantByKey(key) {
        return key ? variants().find((item) => keyOf(item) === key) : undefined;
    }

    function artworkSrc(variant) {
        const request = variant.requestId ? `&request=${encodeURIComponent(variant.requestId)}` : "";
        return `/artwork/${encodeURIComponent(variant.id)}?token=${TOKEN}${request}`;
    }

    function pinOf(variant) {
        return state.mood.find((item) => item.kind === "variant" && item.variantId === variant.id
            && (item.requestId || "") === (variant.requestId || ""));
    }

    function render() {
        if (!state.snapshot) {
            return;
        }

        clearCanvasObserver();
        stage.classList.remove("is-canvas");
        stage.ondragover = null;
        stage.ondragleave = null;
        stage.ondrop = null;
        main.classList.toggle("is-wide", state.mode !== "preview");

        if (state.mode === "gallery") {
            renderGallery();
        } else if (state.mode === "moodboard") {
            renderMoodboard();
        } else if (state.mode === "guidelines") {
            renderGuidelines();
        } else {
            renderPreview();
        }
    }

    function renderGallery() {
        rail.innerHTML = "";
        inspect.innerHTML = "";

        if (!state.arts.some((art) => art.variants.length)) {
            stage.innerHTML = `<div class="empty"><h2>${t("noVariants")}</h2><p>${t("noVariantsHint")}</p></div>`;
            return;
        }

        stage.innerHTML = state.arts.map(artSection).join("");
        // Only a choice that differs from the default is remembered, so an art closes once it is no longer current.
        stage.querySelectorAll("details.art").forEach((node) => {
            node.addEventListener("toggle", () => {
                const key = node.getAttribute("data-art");

                if (node.open === node.classList.contains("is-current")) {
                    delete state.artOpen[key];
                } else {
                    state.artOpen[key] = node.open;
                }
            });
        });
        stage.querySelectorAll("[data-status]").forEach((button) => {
            button.onclick = (event) => {
                event.stopPropagation();
                void setStatus(button.getAttribute("data-key"), button.getAttribute("data-status"));
            };
        });
        stage.querySelectorAll("[data-pin]").forEach((button) => {
            button.onclick = (event) => {
                event.stopPropagation();
                void togglePin(button.getAttribute("data-key"));
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

    // One collapsible section per art in this chat, newest first. The current art starts open.
    function artSection(art) {
        const key = art.requestId || "project";
        const open = state.artOpen[key] !== undefined ? state.artOpen[key] : art.current;
        const all = withArt(art);
        const list = all.filter((item) => item.status !== "rejected");
        const rejected = all.filter((item) => item.status === "rejected");
        return `<details class="art${art.current ? " is-current" : ""}" data-art="${escape(key)}"${open ? " open" : ""}>
            <summary>
                <span class="art-title">${icon("chevron-right", "chevron")}${icon("layers")}<strong>${escape(art.title)}</strong>${art.current ? `<span class="tag">${t("current")}</span>` : ""}</span>
                <span class="art-meta">${escape(formatDate(art.createdAt))} · ${all.length === 1 ? t("variantOne") : t("variantCount", { n: all.length })}</span>
            </summary>
            ${list.length
                ? `<div class="gallery">${list.map(variantCard).join("")}</div>`
                : `<p class="muted">${t("noArtVariants")}</p>`}
            ${rejected.length
                ? `<details class="rejected"><summary>${icon("chevron-right", "chevron")}${icon("archive")}${t("rejected")} (${rejected.length})</summary>
                    <div class="gallery">${rejected.map(variantCard).join("")}</div>
                </details>`
                : ""}
        </details>`;
    }

    function formatDate(value) {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        const locale = state.lang === "pt" ? "pt-BR" : state.lang;
        return date.toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    }

    function variantCard(variant) {
        const key = escape(keyOf(variant));
        const pinned = Boolean(pinOf(variant));
        const pin = `<button type="button" class="${pinned ? "is-pinned" : ""}" data-key="${key}" data-pin>${icon("pin")}${pinned ? t("unpin") : t("pin")}</button>`;
        const actions = variant.status === "rejected"
            ? `<button type="button" data-key="${key}" data-status="draft">${icon("rotate-ccw")}${t("restore")}</button>`
            : variant.status === "accepted"
                ? `<button type="button" data-key="${key}" data-status="draft">${icon("rotate-ccw")}${t("undoAccept")}</button>
                   <button type="button" data-key="${key}" data-status="rejected">${icon("x")}${t("reject")}</button>${pin}`
                : `<button type="button" class="accept" data-key="${key}" data-status="accepted">${icon("check")}${t("accept")}</button>
                   <button type="button" data-key="${key}" data-status="rejected">${icon("x")}${t("reject")}</button>${pin}`;
        return `<article class="card is-${escape(variant.status)}" data-variant="${key}" tabindex="0">
            ${previewFrame(artworkSrc(variant), variant.title, variant.width, variant.height)}
            <header><strong>${escape(variant.title)}</strong><span class="badge">${variant.status === "accepted" ? icon("circle-check") : ""}${escape(t(`status_${variant.status}`))}</span></header>
            <footer>${escape(formatName(variant))} · ${variant.width}×${variant.height}</footer>
            <div class="card-actions">${actions}</div>
        </article>`;
    }

    async function togglePin(key) {
        const variant = variantByKey(key);

        if (!variant) {
            return;
        }

        const pinned = pinOf(variant);

        try {
            if (pinned) {
                await api("/v1/moodboard/remove", { method: "POST", body: JSON.stringify({ id: pinned.id }) });
            } else {
                await api("/v1/moodboard", {
                    method: "POST",
                    body: JSON.stringify({ kind: "variant", request: variant.requestId, variantId: variant.id })
                });
            }

            await refresh();
            toast(t(pinned ? "toastUnpinned" : "toastPinned", { id: variant.id }));
        } catch (err) {
            toast(err.message, "error");
        }
    }

    async function setStatus(key, status) {
        const variant = variantByKey(key);

        if (!variant) {
            return;
        }

        const id = variant.id;

        try {
            await api("/v1/variants/status", {
                method: "POST",
                body: JSON.stringify({ id, status, request: variant.requestId })
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

    async function openPreview(key) {
        state.active = key;
        state.pick = null;

        setMode("preview");
    }

    function renderPreview() {
        const variant = variantByKey(state.active);

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
                        <iframe id="live-frame" src="${artworkSrc(variant)}" title="${t("artworkPreview")}"></iframe>
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

        rail.innerHTML = `<h2>${t("variants")}</h2>${state.arts.map((art) => {
            const list = withArt(art).filter((item) => item.status !== "rejected" || keyOf(item) === state.active);

            if (!list.length) {
                return "";
            }

            return `<h3 class="rail-art">${escape(art.title)}${art.current ? ` <span class="tag">${t("current")}</span>` : ""}</h3>
                <div class="variant-list">${list.map((item) =>
                    `<button type="button" class="${keyOf(item) === state.active ? "is-on" : ""}" data-open="${escape(keyOf(item))}">
                        <strong>${escape(item.title)}</strong>
                        <span>${escape(formatName(item))} · ${item.width}×${item.height}</span>
                    </button>`
                ).join("")}</div>`;
        }).join("")}`;
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
            saveNotes(state.active, []);
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
    function notesKey(key) {
        return `artdirector:notes:${key}`;
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

        const notes = loadNotes(state.active);
        notes.push({ text, selection: state.pick });
        saveNotes(state.active, notes);
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

        const notes = loadNotes(state.active);
        list.innerHTML = notes.map((item, index) => `<li>
                <div><span class="where">${escape(item.selection ? describe(item.selection) : t("wholeBoard"))}</span>${escape(item.text)}</div>
                <button type="button" class="link" data-remove="${index}" aria-label="${t("removeComment", { n: index + 1 })}">${icon("trash-2")}${t("remove")}</button>
            </li>`).join("");
        list.querySelectorAll("[data-remove]").forEach((button) => {
            button.onclick = () => {
                const next = loadNotes(state.active);
                next.splice(Number(button.getAttribute("data-remove")), 1);
                saveNotes(state.active, next);
                paintNotes();
            };
        });
        document.getElementById("prompt-block").hidden = notes.length === 0;
        document.getElementById("prompt").textContent = buildPrompt(notes);
        sendMarks();
    }

    function sendMarks() {
        const marks = loadNotes(state.active)
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
        const variant = variantByKey(state.active);

        if (!variant || !notes.length) {
            return "";
        }

        const lines = [
            t("promptHead", { id: variant.id, w: variant.width, h: variant.height }),
            t("promptFile", { file: variant.htmlFile || variant.htmlPath })
        ];

        if (variant.requestId) {
            lines.push(t("promptArt", { title: variant.artTitle, id: variant.requestId }));
        }

        lines.push("");

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
        const variant = variantByKey(state.active);
        const id = variant ? variant.id : null;

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
                body: JSON.stringify({ id, format: format.api, request: variant.requestId })
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

    function renderMoodboard() {
        rail.innerHTML = "";
        inspect.innerHTML = "";
        const items = state.mood;
        stage.innerHTML = `<div class="mood-tools">
                <label class="mood-drop" id="mood-drop">${icon("image-plus")}<span>${t("moodDrop")}</span>
                    <input type="file" id="mood-file" accept="image/*" multiple hidden>
                </label>
                <form class="mood-form" id="mood-color">
                    ${icon("palette")}
                    <input type="color" id="mood-color-value" value="#c23b22" aria-label="${t("moodAddColor")}">
                    <input type="text" id="mood-color-caption" placeholder="${t("moodCaption")}">
                    <button type="submit">${t("moodAddColor")}</button>
                </form>
                <form class="mood-form" id="mood-note">
                    ${icon("sticky-note")}
                    <input type="text" id="mood-note-text" placeholder="${t("moodNotePlaceholder")}">
                    <button type="submit">${t("moodAddNote")}</button>
                </form>
            </div>
            <p class="muted mood-hint">${t("moodHint")}</p>
            ${items.length
                ? `<div class="mood">${items.map(moodItem).join("")}</div>`
                : `<div class="empty"><h2>${t("moodEmpty")}</h2><p>${t("moodEmptyHint")}</p></div>`}`;

        document.getElementById("mood-file").onchange = (event) => {
            void uploadImages([...event.target.files]);
            event.target.value = "";
        };
        const drop = document.getElementById("mood-drop");
        stage.ondragover = (event) => {
            event.preventDefault();
            drop.classList.add("is-over");
        };
        stage.ondragleave = () => drop.classList.remove("is-over");
        stage.ondrop = (event) => {
            event.preventDefault();
            drop.classList.remove("is-over");
            void uploadImages([...event.dataTransfer.files]);
        };
        document.getElementById("mood-color").onsubmit = (event) => {
            event.preventDefault();
            void addMood({
                kind: "color",
                color: document.getElementById("mood-color-value").value,
                caption: document.getElementById("mood-color-caption").value
            });
        };
        document.getElementById("mood-note").onsubmit = (event) => {
            event.preventDefault();
            const text = document.getElementById("mood-note-text").value.trim();

            if (text) {
                void addMood({ kind: "note", text });
            }
        };
        stage.querySelectorAll("[data-remove-mood]").forEach((button) => {
            button.onclick = (event) => {
                event.stopPropagation();
                void removeMood(button.getAttribute("data-remove-mood"));
            };
        });
        stage.querySelectorAll("[data-open-mood]").forEach((node) => {
            node.onclick = () => {
                if (variantByKey(node.getAttribute("data-open-mood"))) {
                    openPreview(node.getAttribute("data-open-mood"));
                }
            };
        });
        observeFits(stage);
    }

    // Dos and don'ts. The agent writes most of them from the user's feedback; the user can add, edit, flip, or remove any.
    function renderGuidelines() {
        rail.innerHTML = "";
        inspect.innerHTML = "";
        const rules = state.rules;
        const workspace = state.rulesWorkspace.split(/[\\/]/).filter(Boolean).pop() || state.rulesWorkspace;
        const column = (kind) => {
            const list = rules.filter((rule) => rule.kind === kind);
            const title = kind === "dont" ? t("rulesDont") : t("rulesDo");
            return `<section class="rules is-${kind}">
                    <h2>${icon(kind === "dont" ? "ban" : "circle-check")}${title}<span class="count">${list.length}</span></h2>
                    ${list.map(ruleCard).join("")}
                </section>`;
        };

        stage.innerHTML = `<form class="rule-form" id="rule-form">
                <div class="rule-kind" role="radiogroup">
                    <button type="button" role="radio" data-rule-kind="dont" aria-checked="${state.ruleKind === "dont"}">${icon("ban")}${t("ruleDont")}</button>
                    <button type="button" role="radio" data-rule-kind="do" aria-checked="${state.ruleKind === "do"}">${icon("circle-check")}${t("ruleDo")}</button>
                </div>
                <input type="text" id="rule-text" maxlength="300" placeholder="${escape(t("ruleText"))}" aria-label="${escape(t("ruleText"))}">
                <input type="text" id="rule-why" maxlength="500" placeholder="${escape(t("ruleWhy"))}" aria-label="${escape(t("ruleWhy"))}">
                <select id="rule-scope" aria-label="Scope">
                    <option value="workspace">${t("ruleScopeWorkspace")}</option>
                    <option value="user">${t("ruleScopeUser")}</option>
                </select>
                <button type="submit">${t("ruleAdd")}</button>
            </form>
            <p class="muted mood-hint">${escape(t("rulesHint", { workspace }))}</p>
            ${rules.length
                ? `<div class="rules-grid">${column("dont")}${column("do")}</div>`
                : `<div class="empty"><h2>${t("rulesEmpty")}</h2><p>${t("rulesEmptyHint")}</p></div>`}`;

        stage.querySelectorAll("[data-rule-kind]").forEach((button) => {
            button.onclick = () => {
                state.ruleKind = button.getAttribute("data-rule-kind");
                stage.querySelectorAll("[data-rule-kind]").forEach((item) => {
                    item.setAttribute("aria-checked", String(item === button));
                });
            };
        });
        document.getElementById("rule-form").onsubmit = (event) => {
            event.preventDefault();
            const text = document.getElementById("rule-text").value.trim();

            if (text) {
                void addRule({
                    kind: state.ruleKind,
                    text,
                    why: document.getElementById("rule-why").value,
                    scope: document.getElementById("rule-scope").value
                });
            }
        };
        stage.querySelectorAll("[data-rule-action]").forEach((button) => {
            button.onclick = () => {
                const id = button.getAttribute("data-rule-id");
                const action = button.getAttribute("data-rule-action");
                const rule = state.rules.find((item) => item.id === id);

                if (!rule) {
                    return;
                }

                if (action === "remove") {
                    void changeRule("/v1/guidelines/remove", { id }, t("ruleRemoved"));
                } else if (action === "flip") {
                    void changeRule("/v1/guidelines/update", { id, kind: rule.kind === "do" ? "dont" : "do" }, t("ruleFlipped"));
                } else if (action === "edit") {
                    state.editingRule = id;
                    render();
                    const input = document.getElementById("rule-edit-text");
                    input && input.focus();
                } else if (action === "cancel") {
                    state.editingRule = null;
                    render();
                }
            };
        });
        const editForm = document.getElementById("rule-edit");

        if (editForm) {
            editForm.onsubmit = (event) => {
                event.preventDefault();
                const id = state.editingRule;
                state.editingRule = null;
                void changeRule("/v1/guidelines/update", {
                    id,
                    text: document.getElementById("rule-edit-text").value,
                    why: document.getElementById("rule-edit-why").value,
                    scope: document.getElementById("rule-edit-scope").value
                });
            };
        }
    }

    function ruleCard(rule) {
        const scope = rule.scope === "user" ? t("ruleScopeUser") : t("ruleScopeWorkspace");

        if (state.editingRule === rule.id) {
            return `<form class="rule is-editing" id="rule-edit">
                    <input type="text" id="rule-edit-text" maxlength="300" value="${escape(rule.text)}" aria-label="${escape(t("ruleText"))}">
                    <input type="text" id="rule-edit-why" maxlength="500" value="${escape(rule.why || "")}" placeholder="${escape(t("ruleWhy"))}" aria-label="${escape(t("ruleWhy"))}">
                    <div class="rule-actions">
                        <select id="rule-edit-scope" aria-label="Scope">
                            <option value="workspace"${rule.scope === "workspace" ? " selected" : ""}>${t("ruleScopeWorkspace")}</option>
                            <option value="user"${rule.scope === "user" ? " selected" : ""}>${t("ruleScopeUser")}</option>
                        </select>
                        <button type="submit">${t("ruleSave")}</button>
                        <button type="button" class="link" data-rule-action="cancel" data-rule-id="${escape(rule.id)}">${t("ruleCancel")}</button>
                    </div>
                </form>`;
        }

        const last = rule.evidence && rule.evidence.length ? rule.evidence[rule.evidence.length - 1] : null;
        const quote = last && last.quote ? `<blockquote>${escape(last.quote)}</blockquote>` : "";
        const hits = rule.hits > 1 ? `<span>${t("ruleHits", { n: rule.hits })}</span>` : "";
        const action = (name, label, glyph) =>
            `<button type="button" class="link" data-rule-action="${name}" data-rule-id="${escape(rule.id)}">${icon(glyph)}${label}</button>`;

        return `<article class="rule">
                <p class="rule-text">${escape(rule.text)}</p>
                ${rule.why ? `<p class="rule-why">${escape(rule.why)}</p>` : ""}
                ${quote}
                <div class="rule-meta">
                    <span class="tag${rule.scope === "user" ? " is-user" : ""}">${escape(scope)}</span>
                    <span class="mood-by">${rule.source === "agent" ? t("ruleLearned") : t("ruleByYou")}</span>
                    ${hits}
                </div>
                <div class="rule-actions">
                    ${action("edit", t("ruleEdit"), "pencil")}
                    ${action("flip", t("ruleFlip"), "repeat")}
                    ${action("remove", t("remove"), "trash-2")}
                </div>
            </article>`;
    }

    function guidelineDraft() {
        const input = document.getElementById("rule-text");
        return Boolean(input && input.value.trim());
    }

    async function addRule(payload) {
        try {
            const body = await api("/v1/guidelines", { method: "POST", body: JSON.stringify(payload) });
            await refresh();
            toast(body.reversed ? t("ruleFlipped") : body.reinforced ? t("ruleConfirmed") : t("ruleAdded"));
        } catch (err) {
            toast(err.message, "error");
        }
    }

    async function changeRule(path, payload, message) {
        try {
            await api(path, { method: "POST", body: JSON.stringify(payload) });
            await refresh();

            if (message) {
                toast(message);
            }
        } catch (err) {
            toast(err.message, "error");
        }
    }

    function moodItem(item) {
        const by = `<span class="mood-by">${item.source === "agent" ? t("moodByAgent") : t("moodByYou")}</span>`;
        const remove = `<button type="button" class="link" data-remove-mood="${escape(item.id)}">${icon("trash-2")}${t("remove")}</button>`;
        const caption = item.caption ? `<p>${escape(item.caption)}</p>` : "";
        let body = "";

        if (item.kind === "image") {
            body = `<img src="${item.url}?token=${TOKEN}" alt="${escape(item.caption || "")}" loading="lazy">${caption}`;
        } else if (item.kind === "color") {
            body = `<div class="swatch" style="background:${escape(item.color)}"></div><p><code>${escape(item.color)}</code></p>${caption}`;
        } else if (item.kind === "note") {
            body = `<blockquote>${escape(item.text)}</blockquote>`;
        } else if (item.missing) {
            body = `<p class="muted">${t("moodMissing")}</p>`;
        } else {
            const key = `${item.requestId || ""}/${item.variantId}`;
            body = `<div class="mood-variant" data-open-mood="${escape(key)}">
                    ${previewFrame(`${item.url}${item.url.includes("?") ? "&" : "?"}token=${TOKEN}`, item.title, item.width, item.height)}
                </div>
                <p><strong>${escape(item.title)}</strong> · ${escape(item.artTitle)}</p>${caption}`;
        }

        return `<figure class="mood-item is-${escape(item.kind)}">${body}<figcaption>${by}${remove}</figcaption></figure>`;
    }

    async function addMood(payload) {
        try {
            await api("/v1/moodboard", { method: "POST", body: JSON.stringify(payload) });
            await refresh();
            toast(t("moodAdded"));
        } catch (err) {
            toast(err.message, "error");
        }
    }

    async function removeMood(id) {
        try {
            await api("/v1/moodboard/remove", { method: "POST", body: JSON.stringify({ id }) });
            await refresh();
        } catch (err) {
            toast(err.message, "error");
        }
    }

    async function uploadImages(files) {
        for (const file of files) {
            if (!file.type.startsWith("image/")) {
                toast(t("moodNotImage", { name: file.name }), "error");
                continue;
            }

            if (file.size > 15 * 1024 * 1024) {
                toast(t("moodTooBig", { name: file.name }), "error");
                continue;
            }

            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
            });
            const name = file.name && file.name.includes(".") ? file.name : `pasted.${file.type.split("/")[1] || "png"}`;
            await addMood({ kind: "image", name, data });
        }
    }

    function onPaste(event) {
        if (state.mode !== "moodboard" || !event.clipboardData) {
            return;
        }

        const files = [...event.clipboardData.files].filter((file) => file.type.startsWith("image/"));

        if (files.length) {
            event.preventDefault();
            void uploadImages(files);
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
