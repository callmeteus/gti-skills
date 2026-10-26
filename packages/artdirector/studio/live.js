(() => {
    if (window.__ARTDIRECTOR_LIVE__) {
        return;
    }

    window.__ARTDIRECTOR_LIVE__ = true;
    const skip = new Set(["HTML", "HEAD", "BODY", "SCRIPT", "STYLE", "LINK", "META"]);
    const box = overlay("border:3px solid #c23b22;background:rgba(194,59,34,0.08);");
    const hover = overlay("border:2px dashed rgba(194,59,34,0.7);");
    let current = null;
    let marks = [];

    document.addEventListener("mousemove", (event) => {
        const el = event.target;

        if (!(el instanceof Element) || skip.has(el.tagName) || el === current) {
            hover.style.display = "none";
            return;
        }

        place(hover, el);
    }, true);

    document.addEventListener("mouseleave", () => {
        hover.style.display = "none";
    });

    document.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const el = event.target;

        if (!(el instanceof Element) || skip.has(el.tagName)) {
            return;
        }

        current = el;
        place(box, el);
        hover.style.display = "none";
        window.parent.postMessage({
            type: "artdirector-select",
            selection: {
                tagName: el.tagName.toLowerCase(),
                id: el.id || undefined,
                className: typeof el.className === "string" && el.className ? el.className : undefined,
                selector: selector(el),
                text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
                role: el.getAttribute("data-ad-select") || el.getAttribute("data-layer") || undefined
            }
        }, "*");
    }, true);

    // The studio sends the numbered comment markers and asks to clear the current pick.
    window.addEventListener("message", (event) => {
        if (!event.data || typeof event.data.type !== "string") {
            return;
        }

        if (event.data.type === "artdirector-clear") {
            current = null;
            box.style.display = "none";
        } else if (event.data.type === "artdirector-marks") {
            drawMarks(event.data.marks || []);
        }
    });

    function overlay(style) {
        const node = document.createElement("div");
        node.style.cssText = `position:fixed;pointer-events:none;z-index:99999;display:none;box-sizing:border-box;${style}`;
        document.documentElement.appendChild(node);
        return node;
    }

    function place(node, el) {
        const rect = el.getBoundingClientRect();
        node.style.display = "block";
        node.style.top = `${rect.top}px`;
        node.style.left = `${rect.left}px`;
        node.style.width = `${rect.width}px`;
        node.style.height = `${rect.height}px`;
    }

    function drawMarks(list) {
        marks.forEach((node) => node.remove());
        marks = [];

        for (const item of list) {
            let el = null;

            try {
                el = document.querySelector(item.selector);
            } catch {
                el = null;
            }

            if (!el) {
                continue;
            }

            const rect = el.getBoundingClientRect();
            const pin = document.createElement("div");
            pin.textContent = String(item.n);
            pin.style.cssText = [
                "position:fixed",
                "pointer-events:none",
                "z-index:99998",
                `top:${Math.max(4, rect.top - 18)}px`,
                `left:${Math.max(4, rect.left - 18)}px`,
                "width:44px",
                "height:44px",
                "border-radius:50%",
                "background:#c23b22",
                "color:#fff",
                "font:700 24px/44px system-ui,sans-serif",
                "text-align:center",
                "box-shadow:0 2px 8px rgba(0,0,0,0.35)"
            ].join(";");
            document.documentElement.appendChild(pin);
            marks.push(pin);
        }
    }

    function selector(el) {
        if (el.id) {
            return `#${CSS.escape(el.id)}`;
        }

        const ad = el.getAttribute("data-ad-select");

        if (ad) {
            return `[data-ad-select="${ad}"]`;
        }

        const layer = el.getAttribute("data-layer");

        if (layer) {
            return `[data-layer="${layer}"]`;
        }

        const path = [];
        let node = el;

        while (node && node.nodeType === 1 && node.tagName !== "BODY" && path.length < 6) {
            let piece = node.tagName.toLowerCase();
            const parent = node.parentElement;

            if (parent) {
                const same = Array.from(parent.children).filter((child) => child.tagName === node.tagName);

                if (same.length > 1) {
                    piece += `:nth-child(${Array.from(parent.children).indexOf(node) + 1})`;
                }
            }

            path.unshift(piece);
            node = parent;
        }

        return path.join(" > ");
    }
})();
