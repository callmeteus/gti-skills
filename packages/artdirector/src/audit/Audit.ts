import { readFileSync } from "node:fs";
import { dirname } from "node:path";

import type { ArtworkVariant } from "../core";
import { HtmlDocument, UnifiedRenderer } from "../renderer";

/**
 * One audit finding.
 */
export interface AuditFinding {
    id: string;
    severity: "error" | "warn" | "info";
    message: string;
    autoFix?: string;
}

/**
 * Audit report for one artwork file.
 */
export interface AuditReport {
    path: string;
    width: number;
    height: number;
    findings: AuditFinding[];
    passed: boolean;
    note: string;
}

/**
 * Deterministic rendering and document checks. Passing this is not a claim of subjective quality.
 */
export namespace ArtworkAudit {
    /**
     * Audits an HTML artwork file.
     *
     * @param htmlPath Source path
     * @param expected Optional expected size
     * @param renderer Shared renderer
     * @param root Folder local images must stay inside (defaults to the artwork folder)
     * @returns Report
     */
    export async function run(
        htmlPath: string,
        expected?: Pick<ArtworkVariant, "width" | "height">,
        renderer?: UnifiedRenderer,
        root?: string
    ): Promise<AuditReport> {
        const html = readFileSync(htmlPath, "utf8");
        const dims = HtmlDocument.dimensions(html);
        const findings: AuditFinding[] = [];
        const owned = renderer ?? new UnifiedRenderer();

        if (expected && (dims.width !== expected.width || dims.height !== expected.height)) {
            findings.push({
                id: "dimensions",
                severity: "error",
                message: `Artboard is ${dims.width}x${dims.height}, expected ${expected.width}x${expected.height}.`
            });
        }

        if (!html.includes("<svg") && !html.includes("lucide") && html.includes("dall") ) {
            findings.push({
                id: "generative",
                severity: "error",
                message: "Document appears to reference a generative image tool. ArtDirector forbids that path."
            });
        }

        if (!/fonts\.bunny\.net|@font-face/.test(html)) {
            findings.push({
                id: "fonts",
                severity: "warn",
                message: "No Bunny Fonts import or @font-face found. Capture may fall back to a system stack."
            });
        }

        try {
            const inspection = await owned.inspect(html, async (page) => {
                return page.evaluate((): {
                    overflowX: boolean;
                    overflowY: boolean;
                    clipped: string[];
                    outside: string[];
                    edge: string[];
                    safeZone: string[];
                    blurred: string[];
                    images: Array<{ src: string; ok: boolean }>;
                    scrollWidth: number;
                    scrollHeight: number;
                } => {
                    const root = document.querySelector("[data-artdirector-root], .artboard") ?? document.body;
                    const board = root.getBoundingClientRect();
                    const margin = 40;
                    const story = Math.round(board.width) === 1080 && Math.round(board.height) === 1920;
                    const outside: string[] = [];
                    const edge: string[] = [];
                    const safeZone: string[] = [];
                    const blurred: string[] = [];
                    const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
                    const overflowY = document.documentElement.scrollHeight > document.documentElement.clientHeight + 1;
                    const clipped: string[] = [];

                    for (const node of Array.from(root.querySelectorAll("h1, h2, p, span, li"))) {
                        const el = node as HTMLElement;

                        if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
                            const label = el.tagName.toLowerCase() + (el.textContent ? `:${el.textContent.slice(0, 24)}` : "");
                            clipped.push(label);
                        }
                    }

                    // Layout checks use the box of the text itself, not its container. Elements marked
                    // data-bleed or aria-hidden="true" are decorative and may cross the edge on purpose.
                    for (const node of Array.from(root.querySelectorAll("*"))) {
                        const el = node as HTMLElement;
                        const own = Array.from(el.childNodes).filter((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim());

                        if (own.length === 0 || el.closest("[data-bleed], [aria-hidden='true']")) {
                            continue;
                        }

                        const style = getComputedStyle(el);

                        if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) {
                            continue;
                        }

                        const label = el.tagName.toLowerCase() + `:${(el.textContent ?? "").trim().slice(0, 24)}`;
                        let left = Infinity;
                        let top = Infinity;
                        let right = -Infinity;
                        let bottom = -Infinity;

                        for (const child of own) {
                            const range = document.createRange();
                            range.selectNodeContents(child);
                            const rect = range.getBoundingClientRect();
                            left = Math.min(left, rect.left);
                            top = Math.min(top, rect.top);
                            right = Math.max(right, rect.right);
                            bottom = Math.max(bottom, rect.bottom);
                        }

                        const x0 = left - board.left;
                        const y0 = top - board.top;
                        const x1 = board.right - right;
                        const y1 = board.bottom - bottom;

                        if (x0 < 0 || y0 < 0 || x1 < 0 || y1 < 0) {
                            outside.push(label);
                        } else if (x0 < margin || x1 < margin) {
                            edge.push(`${label} (${Math.round(Math.min(x0, x1))}px)`);
                        }

                        if (story && (y0 < 210 || y1 < 250)) {
                            safeZone.push(label);
                        }

                        // fx-motion and fx-ghost blur on purpose. An SVG filter counts only when it is a plain blur.
                        for (let up: HTMLElement | null = el; up && up !== root.parentElement && !el.closest(".fx-motion, .fx-ghost"); up = up.parentElement) {
                            const filter = getComputedStyle(up).filter;
                            const ref = /url\("?#([^")]+)"?\)/.exec(filter)?.[1];
                            const primitives = ref ? Array.from(document.getElementById(ref)?.children ?? []) : [];
                            const plainBlur = primitives.length > 0 && primitives.every((item) => item.tagName === "feGaussianBlur");

                            if (/blur\(/.test(filter) || plainBlur) {
                                blurred.push(label);
                                break;
                            }
                        }
                    }

                    const images = Array.from(document.images).map((img: HTMLImageElement) => ({
                        src: img.currentSrc || img.src,
                        ok: img.complete && img.naturalWidth > 0
                    }));

                    return {
                        overflowX,
                        overflowY,
                        clipped,
                        outside,
                        edge,
                        safeZone,
                        blurred,
                        images,
                        scrollWidth: document.documentElement.scrollWidth,
                        scrollHeight: document.documentElement.scrollHeight
                    };
                });
            }, dirname(htmlPath), root);

            if (inspection.overflowX || inspection.overflowY) {
                findings.push({
                    id: "scrollbar",
                    severity: "error",
                    message: `Unexpected overflow (${inspection.scrollWidth}x${inspection.scrollHeight}). Lock overflow on the artboard.`
                });
            }

            for (const label of inspection.clipped.slice(0, 8)) {
                findings.push({
                    id: "clip",
                    severity: "warn",
                    message: `Possible text clipping on ${label}.`
                });
            }

            for (const label of inspection.outside.slice(0, 8)) {
                findings.push({
                    id: "outside",
                    severity: "error",
                    message: `Text crosses the artboard edge on ${label}. Move it inside, or mark a decorative element with data-bleed.`
                });
            }

            for (const label of inspection.edge.slice(0, 8)) {
                findings.push({
                    id: "edge",
                    severity: "warn",
                    message: `Text nearly touches the artboard edge on ${label}. Keep 56 px or more, or bleed it clearly with data-bleed.`
                });
            }

            for (const label of inspection.safeZone.slice(0, 8)) {
                findings.push({
                    id: "safe-zone",
                    severity: "warn",
                    message: `Story text sits in the top 210 px or bottom 250 px app chrome on ${label}.`
                });
            }

            for (const label of inspection.blurred.slice(0, 8)) {
                findings.push({
                    id: "blur-text",
                    severity: "warn",
                    message: `Text is blurred on ${label}. Blurred type reads as a rendering bug; hide it with a sticker, tape, or redaction instead.`
                });
            }

            for (const image of inspection.images) {
                if (!image.ok) {
                    findings.push({
                        id: "asset",
                        severity: "error",
                        message: `Image failed to load: ${image.src || "(empty src)"}`
                    });
                }
            }
        } catch (err) {
            findings.push({
                id: "inspect",
                severity: "warn",
                message: `Browser inspection skipped: ${err instanceof Error ? err.message : String(err)}`
            });
        } finally {
            if (!renderer) {
                await owned.close();
            }
        }

        const passed = findings.every((item) => item.severity !== "error");

        return {
            path: htmlPath,
            width: dims.width,
            height: dims.height,
            findings,
            passed,
            note: "Automated checks do not prove subjective visual quality."
        };
    }
}
