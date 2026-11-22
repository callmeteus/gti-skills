import type { AuditFinding } from "./Audit";

/**
 * Text that does not fit the shape it sits in.
 */
export interface ShapeMiss {
    /** `clipped`: a clip-path cuts the glyphs. `spills`: the text runs past the shape behind it. */
    kind: "clipped" | "spills";
    label: string;
}

/**
 * Checks text placed in a shape: a starburst, badge, bubble, or seal. The text must sit inside
 * the shape's outline, not be cut by it or run past it.
 */
export namespace ShapeFit {
    /**
     * Runs inside the page. Must stay self-contained: Playwright serializes it.
     *
     * @returns Text that is cut by or spills out of its shape
     */
    export function scan(): ShapeMiss[] {
        const root = document.querySelector("[data-artdirector-root], .artboard") ?? document.body;
        const board = root.getBoundingClientRect();
        const boardArea = board.width * board.height;
        const misses: ShapeMiss[] = [];

        // Hit testing follows clip-path, so it tells whether a point is inside a clipped shape.
        // Decorative layers often turn pointer events off; turn them back on while checking.
        const force = document.createElement("style");
        force.textContent = "* { pointer-events: auto !important; }";
        document.head.appendChild(force);

        // Shapes: filled SVG outlines, and HTML boxes cut to a shape with clip-path. Large ones are backgrounds.
        const shapes = Array.from(root.querySelectorAll("*"))
            .filter((node) => {
                const box = node.getBoundingClientRect();

                if (box.width * box.height === 0 || box.width * box.height > boardArea * 0.6) {
                    return false;
                }

                if (node instanceof SVGGeometryElement) {
                    if (!["polygon", "path", "circle", "ellipse"].includes(node.tagName)) {
                        return false;
                    }

                    const style = getComputedStyle(node);
                    return style.fill !== "none" && Number(style.fillOpacity) > 0;
                }

                return !(node instanceof SVGElement) && getComputedStyle(node).clipPath !== "none";
            });

        const inside = (shape: Element, x: number, y: number) => {
            if (shape instanceof SVGGeometryElement) {
                const ctm = shape.getScreenCTM();

                if (!ctm) {
                    return true;
                }

                const local = new DOMPoint(x, y).matrixTransform(ctm.inverse());
                return shape.isPointInFill(local);
            }

            return document.elementsFromPoint(x, y).includes(shape);
        };

        for (const node of Array.from(root.querySelectorAll("*"))) {
            const el = node as HTMLElement;
            const own = Array.from(el.childNodes).filter((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim());

            if (own.length === 0 || el.closest("[data-bleed], [aria-hidden='true']")) {
                continue;
            }

            const style = getComputedStyle(el);

            if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
                continue;
            }

            // Points well inside each line box, away from the line-height padding.
            const points: Array<[number, number]> = [];
            let left = Infinity;
            let top = Infinity;
            let right = -Infinity;
            let bottom = -Infinity;

            for (const child of own) {
                const range = document.createRange();
                range.selectNodeContents(child);

                for (const line of Array.from(range.getClientRects())) {
                    if (line.width < 2 || line.height < 2) {
                        continue;
                    }

                    const inset = Math.min(line.height * 0.2, line.width * 0.1);
                    const midY = line.top + line.height / 2;
                    points.push([line.left + inset, midY], [line.right - inset, midY], [line.left + line.width / 2, line.top + line.height * 0.3], [line.left + line.width / 2, line.bottom - line.height * 0.3]);
                    left = Math.min(left, line.left);
                    top = Math.min(top, line.top);
                    right = Math.max(right, line.right);
                    bottom = Math.max(bottom, line.bottom);
                }
            }

            if (points.length === 0) {
                continue;
            }

            const label = el.tagName.toLowerCase() + `:${(el.textContent ?? "").trim().slice(0, 24)}`;
            const clipper = shapes.find((shape) => !(shape instanceof SVGElement) && shape.contains(el));

            if (clipper && points.some(([x, y]) => !document.elementsFromPoint(x, y).includes(el))) {
                misses.push({
                    kind: "clipped",
                    label
                });
                continue;
            }

            // The shape behind: the smallest one under the middle of the text that is about the text's size or larger.
            const cx = (left + right) / 2;
            const cy = (top + bottom) / 2;
            const area = (right - left) * (bottom - top);
            const behind = shapes
                .filter((shape) => !shape.contains(el) && !el.contains(shape))
                .filter((shape) => {
                    const box = shape.getBoundingClientRect();
                    return box.width * box.height >= area * 0.8 && cx > box.left && cx < box.right && cy > box.top && cy < box.bottom && inside(shape, cx, cy);
                })
                .sort((a, b) => {
                    const boxA = a.getBoundingClientRect();
                    const boxB = b.getBoundingClientRect();
                    return boxA.width * boxA.height - boxB.width * boxB.height;
                })[0];

            if (behind && points.some(([x, y]) => !inside(behind, x, y))) {
                misses.push({
                    kind: "spills",
                    label
                });
            }
        }

        force.remove();
        return misses;
    }

    /**
     * @param misses Text that does not fit its shape
     * @returns Findings
     */
    export function findings(misses: ShapeMiss[]): AuditFinding[] {
        return misses.slice(0, 8).map((miss): AuditFinding => miss.kind === "clipped"
            ? {
                id: "shape-clip",
                severity: "error",
                message: `The shape cuts the text on ${miss.label}. Shrink the text or grow the shape so every letter sits inside its outline with room to spare.`
            }
            : {
                id: "shape-spill",
                severity: "warn",
                message: `Text runs past the edge of the shape behind it on ${miss.label}. Keep text inside a starburst, badge, or bubble by 15 percent of its size; mark it data-bleed if the overlap is on purpose.`
            });
    }
}
