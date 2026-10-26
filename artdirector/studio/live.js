(() => {
    if (window.__ARTDIRECTOR_LIVE__) {
        return;
    }

    window.__ARTDIRECTOR_LIVE__ = true;
    const skip = new Set(["HTML", "HEAD", "BODY", "SCRIPT", "STYLE", "LINK", "META"]);
    let current = null;
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;pointer-events:none;border:2px solid #c23b22;z-index:99999;display:none;";
    document.documentElement.appendChild(box);

    document.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const el = event.target;

        if (!(el instanceof Element) || skip.has(el.tagName)) {
            return;
        }

        current = el;
        const rect = el.getBoundingClientRect();
        box.style.display = "block";
        box.style.top = `${rect.top}px`;
        box.style.left = `${rect.left}px`;
        box.style.width = `${rect.width}px`;
        box.style.height = `${rect.height}px`;
        window.parent.postMessage({
            type: "artdirector-select",
            selection: {
                tagName: el.tagName.toLowerCase(),
                id: el.id || undefined,
                className: el.className || undefined,
                selector: selector(el),
                text: (el.textContent || "").trim().slice(0, 80),
                role: el.getAttribute("data-ad-select") || el.getAttribute("data-layer") || undefined
            }
        }, "*");
    }, true);

    function selector(el) {
        if (el.id) {
            return `#${el.id}`;
        }

        const attr = el.getAttribute("data-ad-select") || el.getAttribute("data-layer");

        if (attr) {
            return `[data-ad-select="${attr}"]`;
        }

        const path = [];
        let node = el;

        while (node && node.nodeType === 1 && path.length < 5) {
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
