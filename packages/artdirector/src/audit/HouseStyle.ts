import type { AuditFinding } from "./Audit";

/**
 * One default move found on the board, with a few elements that show it.
 */
export interface HouseTic {
    id: string;
    count: number;
    samples: string[];
}

/**
 * Plain names for each move, used in the audit message.
 */
const TicNames: Record<string, string> = {
    "tracked-mono": "letter-spaced monospace labels",
    "edge-vertical": "small vertical text along a side edge",
    "dot-separated": "dot-separated meta lines (a · b · c)",
    "ghost-type": "a giant faded or outlined word behind the layout",
    "label-pill": "rounded label pills",
    "offset-card": "cards with a hard offset shadow",
    "faint-scatter": "faint icons scattered around the board",
    "dark-glow": "a near-black field with a radial glow"
};

/**
 * Detects the moves Art Director pieces fall back on by default: the ones that make every
 * board look like the same template. One of them can be a choice; several together are a tell.
 */
export namespace HouseStyle {
    /**
     * Runs inside the page. Must stay self-contained: Playwright serializes it.
     *
     * @returns Moves found on the board
     */
    export function scan(): HouseTic[] {
        const root = document.querySelector("[data-artdirector-root], .artboard") ?? document.body;
        const board = root.getBoundingClientRect();
        const found = new Map<string, HouseTic>();

        const add = (id: string, el: Element) => {
            const tic = found.get(id) ?? { id, count: 0, samples: [] };
            tic.count += 1;

            if (tic.samples.length < 3) {
                tic.samples.push(el.tagName.toLowerCase() + ((el.textContent ?? "").trim() ? `:${(el.textContent ?? "").trim().slice(0, 24)}` : ""));
            }

            found.set(id, tic);
        };

        const opacity = (el: Element) => {
            let value = 1;

            for (let up: Element | null = el; up && up !== root.parentElement; up = up.parentElement) {
                value *= Number(getComputedStyle(up).opacity);
            }

            return value;
        };

        // Red, green, blue (0-255) and alpha (0-1) of a computed color; null when it is not rgb().
        const channels = (color: string) => {
            const parts = (/rgba?\(([^)]+)\)/.exec(color)?.[1] ?? "").split(/[\s,/]+/).filter(Boolean).map(Number);
            return parts.length >= 3 ? [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1] : null;
        };

        const alpha = (color: string) => channels(color)?.[3] ?? (color === "transparent" ? 0 : 1);

        const luminance = (color: string) => {
            const [r = 255, g = 255, b = 255] = channels(color) ?? [];
            return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        };

        const angle = (el: Element) => {
            for (let up: Element | null = el; up && up !== root; up = up.parentElement) {
                const style = getComputedStyle(up);

                if (style.writingMode.startsWith("vertical") || style.writingMode.startsWith("sideways")) {
                    return 90;
                }

                const matrix = /matrix\(([^)]+)\)/.exec(style.transform)?.[1];

                if (matrix) {
                    const [a = 1, b = 0] = matrix.split(",").map(Number);
                    const degrees = Math.abs(Math.atan2(b, a) * 180 / Math.PI);

                    if (degrees > 1) {
                        return degrees;
                    }
                }
            }

            return 0;
        };

        let faint = 0;
        const faintSamples: Element[] = [];

        for (const node of Array.from(root.querySelectorAll("*"))) {
            const el = node as HTMLElement;
            const style = getComputedStyle(el);

            if (style.display === "none" || style.visibility === "hidden") {
                continue;
            }

            const rect = el.getBoundingClientRect();
            const own = Array.from(el.childNodes).some((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim());
            const size = parseFloat(style.fontSize);

            if (own) {
                const text = Array.from(el.childNodes).map((child) => child.nodeType === Node.TEXT_NODE ? child.textContent ?? "" : "").join("");
                const family = (style.fontFamily.split(",")[0] ?? "").toLowerCase();
                const tracking = (parseFloat(style.letterSpacing) || 0) / size;

                if (/mono|courier|consolas|menlo|code/.test(family) && tracking >= 0.1) {
                    add("tracked-mono", el);
                }

                const turned = angle(el);
                const nearSide = Math.min(rect.left - board.left, board.right - rect.right) < 140;

                if (Math.abs(turned - 90) < 5 && nearSide && size < 48) {
                    add("edge-vertical", el);
                }

                if (/\S\s+[·•|]\s+\S/.test(text) && size <= 48) {
                    add("dot-separated", el);
                }

                const stroked = parseFloat(style.getPropertyValue("-webkit-text-stroke-width")) > 0
                    && alpha(style.getPropertyValue("-webkit-text-fill-color") || style.color) <= 0.3;

                if (size >= 240 && (opacity(el) <= 0.3 || alpha(style.color) <= 0.3 || stroked)) {
                    add("ghost-type", el);
                }
            }

            const radius = parseFloat(style.borderTopLeftRadius) || 0;
            const filled = alpha(style.backgroundColor) > 0 || parseFloat(style.borderTopWidth) > 0 || style.backgroundImage !== "none";
            const label = (el.textContent ?? "").trim();

            if (rect.height >= 24 && rect.height <= 110 && rect.width >= rect.height * 1.8 && radius >= rect.height / 2 - 1 && filled && label.length > 0 && label.length <= 32) {
                add("label-pill", el);
            }

            for (const shadow of style.boxShadow === "none" ? [] : style.boxShadow.split(/,(?![^(]*\))/)) {
                const lengths = (shadow.replace(/rgba?\([^)]*\)/, "").match(/-?[\d.]+px/g) ?? []).map(parseFloat);

                if (!shadow.includes("inset") && lengths[2] === 0 && Math.max(Math.abs(lengths[0] ?? 0), Math.abs(lengths[1] ?? 0)) >= 6 && rect.width * rect.height >= 20000) {
                    add("offset-card", el);
                    break;
                }
            }

            const graphic = el.tagName === "svg" || el.tagName === "IMG";

            if (graphic && !el.parentElement?.closest("svg") && rect.width > 0 && rect.width <= 220 && rect.height <= 220 && opacity(el) <= 0.4) {
                faint += 1;
                faintSamples.push(el);
            }

            const fullBleed = rect.width * rect.height >= board.width * board.height * 0.9;

            if (fullBleed && /radial-gradient/.test(style.backgroundImage) && luminance(getComputedStyle(root).backgroundColor) < 0.1) {
                if (!found.has("dark-glow")) {
                    add("dark-glow", el);
                }
            }
        }

        if (faint >= 3) {
            for (const el of faintSamples) {
                add("faint-scatter", el);
            }
        }

        return Array.from(found.values());
    }

    /**
     * Turns the scan into audit findings: one warning when two or more default moves meet.
     *
     * @param tics Moves found on the board
     * @returns Findings
     */
    export function findings(tics: HouseTic[]): AuditFinding[] {
        if (tics.length === 0) {
            return [];
        }

        const names = tics.map((tic) => TicNames[tic.id] ?? tic.id);

        return [{
            id: "house-style",
            severity: tics.length >= 2 ? "warn" : "info",
            message: tics.length >= 2
                ? `Uses ${tics.length} of Art Director's default moves, which makes every piece look alike: ${names.join("; ")}. Keep at most one, and only when it carries meaning for this piece.`
                : `Uses one of Art Director's default moves: ${names[0]}. Fine if it carries meaning; never repeat it across every variant.`
        }];
    }
}
