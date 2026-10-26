(() => {
    const TOKEN = window.__ARTDIRECTOR_TOKEN__;
    const headers = {
        "Authorization": `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
    };

    let state = {
        mode: "brief",
        snapshot: null,
        selected: null,
        canvasObserver: null,
        ignoreQueueOutside: false,
        galleryFocus: null,
        sizeIds: ["instagram-square", "story"]
    };

    const rail = document.getElementById("rail");
    const stage = document.getElementById("stage");
    const inspect = document.getElementById("inspect");
    const queueBtn = document.getElementById("queue-btn");
    const queueN = document.getElementById("queue-n");
    const queuePanel = document.getElementById("queue-panel");
    const toasts = document.getElementById("toasts");

    document.querySelectorAll("[data-mode]").forEach((button) => {
        button.addEventListener("click", () => {
            state.mode = button.getAttribute("data-mode");
            document.querySelectorAll("[data-mode]").forEach((item) => {
                item.classList.toggle("is-on", item === button);
            });
            render();
        });
    });

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
        document.getElementById("phase").textContent = state.snapshot.session.phase;
        paintQueue();
        render();
    }

    function render() {
        if (!state.snapshot) {
            return;
        }

        clearCanvasObserver();
        stage.classList.remove("is-canvas");

        if (state.mode === "brief") {
            renderBrief();
        } else if (state.mode === "gallery") {
            renderGallery();
        } else if (state.mode === "live") {
            renderLive();
        } else {
            renderAudit();
        }
    }

    function renderBrief() {
        const brief = state.snapshot.project.brief;
        const brand = state.snapshot.project.brand;
        rail.innerHTML = `
            <h2>Brief</h2>
            <label>Goal</label>
            <textarea id="goal">${escape(brief.goal || "")}</textarea>
            <label>Audience</label>
            <input id="audience" value="${escape(brief.audience || "")}">
            <label>Category</label>
            <input id="category" value="${escape(brief.category || "")}">
            <label>Format</label>
            <select id="format">${state.snapshot.formats.map((item) =>
                `<option value="${item.id}" ${item.id === brief.formatId ? "selected" : ""}>${item.label} (${item.width}x${item.height})</option>`
            ).join("")}</select>
            <div class="actions">
                <button class="primary" id="save-brief">Save brief</button>
            </div>
        `;
        stage.innerHTML = `
            <h2>Brand</h2>
            <p>${escape(brand.name)} / ${escape(brand.tagline || "no tagline")}</p>
            <p>Display ${escape(brand.fonts.display)} · Body ${escape(brand.fonts.body)}</p>
            <p>Ink ${escape(brand.colors.ink)} · Paper ${escape(brand.colors.paper)} · Accent ${escape(brand.colors.accent)}</p>
            <p>Technique pack: <strong>${escape(state.snapshot.techniques.id)}</strong></p>
        `;
        inspect.innerHTML = `<h2>Note</h2><p>Only ask for what is missing. Sensible defaults are already filled.</p>`;
        document.getElementById("save-brief").onclick = async () => {
            await api("/v1/brief", {
                method: "POST",
                body: JSON.stringify({
                    goal: value("goal"),
                    audience: value("audience"),
                    category: value("category"),
                    formatId: value("format")
                })
            });
            await refresh();
            toast("Brief saved.");
        };
    }

    function renderGallery() {
        const focused = state.galleryFocus;
        const variants = focused
            ? state.snapshot.variants.filter((item) => item.templateId === focused)
            : state.snapshot.variants;
        rail.innerHTML = `<h2>Sizes</h2>
            <p>Choose the sizes for this piece, then pick a look.</p>
            <div class="chip-row" id="size-row">
                ${state.snapshot.formats.map((item) =>
                    `<button type="button" class="chip ${state.sizeIds.includes(item.id) ? "is-on" : ""}" data-size="${item.id}">${escape(sizeLabel(item))} ${item.width}×${item.height}</button>`
                ).join("")}
            </div>
            <p>${focused ? "Same piece, one card per size." : `${state.snapshot.variants.length} on file.`}</p>
            <p class="muted">The agent suggests the look for this brief.</p>`;
        stage.innerHTML = variants.length
            ? `<div class="gallery">${variants.map(variantCard).join("")}</div>`
            : `<p>No variants yet. Ask the agent for a look in the right sizes.</p>`;
        inspect.innerHTML = `<h2>Compare</h2><p>Same piece, one card per size. Select a card, then Live or Accept.</p>`;
        rail.querySelectorAll("[data-size]").forEach((chip) => {
            chip.onclick = () => {
                const id = chip.getAttribute("data-size");
                state.sizeIds = state.sizeIds.includes(id)
                    ? state.sizeIds.filter((item) => item !== id)
                    : state.sizeIds.concat(id);
                render();
            };
        });
        stage.querySelectorAll("[data-variant]").forEach((card) => {
            card.onclick = () => selectVariant(card.getAttribute("data-variant"));
        });
        observeFits(stage);
    }

    function sizeLabel(format) {
        return format.short || format.label || format.id || `${format.width}×${format.height}`;
    }

    function formatName(variant) {
        const formats = (state.snapshot && state.snapshot.formats) ? state.snapshot.formats : [];
        const match = formats.find((item) => item.id === variant.formatId)
            || formats.find((item) => item.width === variant.width && item.height === variant.height);

        if (match) {
            return sizeLabel(match);
        }

        return variant.direction || `${variant.width}×${variant.height}`;
    }

    function variantCard(variant) {
        return `<article class="card" data-variant="${variant.id}">
            ${previewFrame(`/artwork/${variant.id}?token=${TOKEN}`, variant.title, variant.width, variant.height)}
            <header><strong>${escape(variant.title)}</strong><span>${escape(variant.status)}</span></header>
            <footer>${escape(formatName(variant))} · ${variant.width}×${variant.height}</footer>
        </article>`;
    }

    function previewFrame(src, title, width, height) {
        return `<div class="preview" data-art-width="${Number(width) || 1}" data-art-height="${Number(height) || 1}">
            <div class="canvas-fit">
                <iframe src="${src}" title="${escape(title)}"></iframe>
            </div>
        </div>`;
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
                if (!box.isConnected) {
                    return;
                }

                const frame = box.querySelector("iframe");

                if (!frame) {
                    return;
                }

                const width = box.getAttribute("data-art-width");
                const height = box.getAttribute("data-art-height");
                const scale = fitArtwork(box, frame, width, height);
                const meta = document.getElementById("canvas-meta");

                if (meta && box.classList.contains("canvas")) {
                    meta.textContent = `${width} × ${height} · fitted ${Math.round(scale * 100)}%`;
                }
            });
        };

        layout();
        requestAnimationFrame(layout);
        const observer = new ResizeObserver(layout);
        boxes.forEach((box) => observer.observe(box));
        state.canvasObserver = observer;
    }

    async function selectVariant(id) {
        await api("/v1/variants/status", {
            method: "POST",
            body: JSON.stringify({
                id,
                status: "selected"
            })
        });
        state.mode = "live";
        document.querySelectorAll("[data-mode]").forEach((item) => {
            item.classList.toggle("is-on", item.getAttribute("data-mode") === "live");
        });
        await refresh();
    }

    function renderLive() {
        const id = state.snapshot.project.activeVariantId || (state.snapshot.variants[0] && state.snapshot.variants[0].id);
        const variant = (state.snapshot.variants || []).find((item) => item.id === id);
        const width = variant && variant.width ? variant.width : 1080;
        const height = variant && variant.height ? variant.height : 1080;
        rail.innerHTML = `<h2>Live</h2><p>Click an element in the artwork. Choose an action or write a note. The agent edits source; this preview updates after render.</p>
            <label>Freeform note</label>
            <textarea id="prompt"></textarea>
            <div class="actions" id="live-actions"></div>`;
        stage.classList.add("is-canvas");
        stage.innerHTML = id
            ? `<div class="canvas" data-art-width="${width}" data-art-height="${height}">
                <div class="canvas-fit">
                    <iframe id="live-frame" src="/artwork/${id}?token=${TOKEN}" title="Live artwork"></iframe>
                </div>
            </div>`
            : `<p>Select a variant first.</p>`;
        inspect.innerHTML = `<h2>Selection</h2>
            <p id="canvas-meta">${width} × ${height}</p>
            <pre id="sel">None</pre>
            <div class="actions">
                <button class="primary" id="accept">Accept variant</button>
                <button id="reject">Reject</button>
            </div>`;
        api("/v1/commands").then((payload) => {
            document.getElementById("live-actions").innerHTML = payload.liveActions.map((item) =>
                `<button data-action="${item.id}">${escape(item.label)}</button>`
            ).join("");
            document.querySelectorAll("[data-action]").forEach((button) => {
                button.onclick = () => postEvent(button.getAttribute("data-action"));
            });
        });
        const frame = document.getElementById("live-frame");

        if (frame) {
            frame.addEventListener("load", () => {
                try {
                    const doc = frame.contentDocument;
                    const script = doc.createElement("script");
                    script.src = `/live.js?token=${TOKEN}`;
                    doc.documentElement.appendChild(script);
                    window.addEventListener("message", onPick);
                } catch (err) {
                    toast("Live overlay could not attach. Open the artwork origin with the studio token.", "error");
                }
            }, { once: true });
        }

        document.getElementById("accept").onclick = () => setStatus("accepted");
        document.getElementById("reject").onclick = () => setStatus("rejected");
        const promptField = document.getElementById("prompt");

        if (promptField) {
            promptField.addEventListener("keydown", (event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();

                    if (promptField.value.trim()) {
                        void postEvent("freeform");
                    }
                }
            });
        }

        observeFits(stage);
    }

    function onPick(event) {
        if (!event.data || event.data.type !== "artdirector-select") {
            return;
        }

        state.pick = event.data.selection;
        document.getElementById("sel").textContent = JSON.stringify(event.data.selection, null, 2);
    }

    async function postEvent(action) {
        const id = state.snapshot.project.activeVariantId;

        try {
            await api("/v1/events", {
                method: "POST",
                body: JSON.stringify({
                    type: "generate",
                    action,
                    prompt: value("prompt"),
                    selection: state.pick,
                    variantId: id,
                    count: 3
                })
            });
            toast(`Queued ${actionLabel(action)}.`);
            await syncQueue();
        } catch (err) {
            toast(err.message, "error");
        }
    }

    async function setStatus(statusName) {
        const id = state.snapshot.project.activeVariantId;

        if (!id) {
            return;
        }

        await api("/v1/variants/status", {
            method: "POST",
            body: JSON.stringify({
                id,
                status: statusName
            })
        });
        await refresh();
        toast(`${statusName}: ${id}`);
    }

    function renderAudit() {
        const id = state.snapshot.project.acceptedVariantId || state.snapshot.project.activeVariantId;
        rail.innerHTML = `<h2>Audit / Export</h2><p>Deterministic checks only. Passing them does not prove the piece is beautiful.</p>
            <div class="actions">
                <button id="run-audit">Run audit</button>
                <button class="primary" id="export-png">Export PNG</button>
                <button id="export-jpg">Export JPEG</button>
                <button id="export-pdf">Export PDF</button>
            </div>`;
        stage.innerHTML = `<pre id="audit-out">No report yet.</pre>`;
        inspect.innerHTML = `<h2>Active</h2><p>${escape(id || "none")}</p>`;
        document.getElementById("run-audit").onclick = async () => {
            const report = await api("/v1/audit", {
                method: "POST",
                body: JSON.stringify({ id })
            });
            document.getElementById("audit-out").textContent = JSON.stringify(report.report, null, 2);
        };
        ["png", "jpg", "pdf"].forEach((format) => {
            const button = document.getElementById(format === "jpg" ? "export-jpg" : `export-${format}`);
            button.onclick = async () => {
                const exportFormat = format === "jpg" ? "jpeg" : format;
                const extension = format === "jpg" ? "jpg" : format;

                try {
                    const res = await fetch("/v1/export", {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                            id,
                            format: exportFormat
                        })
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

                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `${id}.${extension}`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(url);

                    toast(`Exported ${exportFormat.toUpperCase()}.`);
                } catch (err) {
                    toast(err.message, "error");
                }
            };
        });
    }

    function queueItems() {
        return (state.snapshot && state.snapshot.queue) ? state.snapshot.queue : [];
    }

    function actionLabel(action) {
        const actions = (state.snapshot && state.snapshot.liveActions) ? state.snapshot.liveActions : [];
        const match = actions.find((item) => item.id === action);
        return match ? match.label : (action || "Edit");
    }

    function waitingLabel(iso) {
        const ms = Date.now() - Date.parse(iso || "");

        if (!Number.isFinite(ms) || ms < 8000) {
            return "just now";
        } else if (ms < 60000) {
            return `${Math.round(ms / 1000)}s waiting`;
        } else {
            return `${Math.round(ms / 60000)}m waiting`;
        }
    }

    function queueDetail(item) {
        const bits = [];

        if (item.selection && item.selection.text) {
            bits.push(item.selection.text);
        } else if (item.selection && item.selection.selector) {
            bits.push(item.selection.selector);
        }

        if (item.prompt) {
            bits.push(item.prompt);
        }

        bits.push(waitingLabel(item.createdAt));
        return bits.join(" · ");
    }

    function fillQueuePanel() {
        const items = queueItems();

        if (!items.length) {
            queuePanel.innerHTML = `<h2 id="queue-title">Queue</h2><p class="queue-empty">No edits waiting. Live actions stay here until the agent writes HTML and replies.</p>`;
            return;
        }

        queuePanel.innerHTML = `<h2 id="queue-title">Queue</h2>${items.map((item) => `
            <article class="queue-item">
                <header>
                    <strong>${escape(actionLabel(item.action))}</strong>
                    <span>Waiting</span>
                </header>
                <p>${escape(queueDetail(item))}</p>
            </article>
        `).join("")}`;
    }

    function paintQueue() {
        const count = queueItems().length;
        queueN.textContent = `(${count})`;
        queueBtn.classList.toggle("has-items", count > 0);
        queueBtn.setAttribute("aria-expanded", queuePanel.hidden ? "false" : "true");

        if (!queuePanel.hidden) {
            fillQueuePanel();
        }
    }

    async function syncQueue() {
        if (document.hidden || !state.snapshot) {
            return;
        }

        try {
            const snap = await api("/v1/session");
            const prev = queueItems().length;
            state.snapshot.queue = snap.queue || [];
            state.snapshot.liveActions = snap.liveActions || state.snapshot.liveActions;

            if (state.snapshot.queue.length < prev) {
                toast(state.snapshot.queue.length ? "Next edit is in progress." : "Queue is clear.");
            }

            paintQueue();
        } catch {
            return;
        }
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

    function value(id) {
        const node = document.getElementById(id);
        return node ? node.value : "";
    }

    function escape(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll("\"", "&quot;");
    }

    queueBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const willOpen = queuePanel.hidden;
        queuePanel.hidden = !willOpen;

        if (willOpen) {
            fillQueuePanel();
            state.ignoreQueueOutside = true;
            window.setTimeout(() => {
                state.ignoreQueueOutside = false;
            }, 0);
        }

        paintQueue();
    });

    document.addEventListener("pointerdown", (event) => {
        if (state.ignoreQueueOutside || queuePanel.hidden) {
            return;
        }

        if (queuePanel.contains(event.target) || queueBtn.contains(event.target)) {
            return;
        }

        queuePanel.hidden = true;
        paintQueue();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !queuePanel.hidden) {
            queuePanel.hidden = true;
            queueBtn.focus();
            paintQueue();
        }
    });

    window.setInterval(() => {
        void syncQueue();
    }, 2500);

    refresh().catch((err) => {
        toast(err.message, "error");
    });
})();
