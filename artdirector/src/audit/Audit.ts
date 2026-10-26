import { readFileSync } from "node:fs";

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
     * @returns Report
     */
    export async function run(
        htmlPath: string,
        expected?: Pick<ArtworkVariant, "width" | "height">,
        renderer?: UnifiedRenderer
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
                    images: Array<{ src: string; ok: boolean }>;
                    scrollWidth: number;
                    scrollHeight: number;
                } => {
                    const root = document.querySelector("[data-artdirector-root], .artboard") ?? document.body;
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

                    const images = Array.from(document.images).map((img: HTMLImageElement) => ({
                        src: img.currentSrc || img.src,
                        ok: img.complete && img.naturalWidth > 0
                    }));

                    return {
                        overflowX,
                        overflowY,
                        clipped,
                        images,
                        scrollWidth: document.documentElement.scrollWidth,
                        scrollHeight: document.documentElement.scrollHeight
                    };
                });
            });

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
