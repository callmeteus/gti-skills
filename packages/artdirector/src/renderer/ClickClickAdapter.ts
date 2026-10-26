import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, extname } from "node:path";
import type { Page } from "playwright";

import { ExportFormat } from "../core";
import { HtmlDocument } from "./HtmlDocument";
import { PlaywrightRenderer } from "./PlaywrightRenderer";
import type { RenderRequest, RenderResult } from "./Types";

interface ClickClickModule {
    renderImage: (input: {
        document: {
            html: string;
            css: string;
        };
        output?: {
            path?: string;
            format?: "png" | "jpeg";
            quality?: number;
            omitBackground?: boolean;
        };
        viewport?: {
            width: number;
            height: number;
        };
        render?: {
            waitUntil?: "load" | "domcontentloaded" | "networkidle";
            delayMs?: number;
        };
    }) => Promise<{
        buffer: Buffer;
        format: string;
        width: number;
        height: number;
        path?: string;
    }>;
}

/**
 * Production renderer: ClickClick for PNG/JPEG when the library loads,
 * Playwright for PDF, SVG, HTML, and as fallback.
 *
 * ClickClick does not export PDF or SVG and does not host the live studio,
 * so Playwright remains complementary rather than a second template system.
 */
export class UnifiedRenderer {
    private playwright = new PlaywrightRenderer();
    private clickclick: ClickClickModule | null | undefined;

    /**
     * Renders through the preferred production engine.
     *
     * @param request Render request
     * @returns Result
     */
    async render(source: RenderRequest): Promise<RenderResult> {
        const request: RenderRequest = {
            ...source,
            html: HtmlDocument.prepare(source.html, source.baseDir, source.root)
        };
        const format = request.format ?? inferFormat(request.outputPath);

        if (format === ExportFormat.HTML && request.outputPath) {
            mkdirSync(dirname(request.outputPath), { recursive: true });
            writeFileSync(request.outputPath, request.html, "utf8");
            const dims = HtmlDocument.dimensions(request.html);
            return {
                buffer: Buffer.from(request.html, "utf8"),
                format,
                width: dims.width,
                height: dims.height,
                path: request.outputPath,
                engine: "playwright"
            };
        }

        const clickclick = await this.loadClickClick();
        const canUseClickClick =
            clickclick &&
            (format === ExportFormat.PNG || format === ExportFormat.JPEG) &&
            !request.beforeCapture;

        if (canUseClickClick && clickclick) {
            try {
                const dims = HtmlDocument.dimensions(request.html);
                const parts = HtmlDocument.fragments(request.html);
                const result = await clickclick.renderImage({
                    document: {
                        html: parts.html,
                        css: parts.css
                    },
                    viewport: {
                        width: dims.width,
                        height: dims.height
                    },
                    output: {
                        path: request.outputPath,
                        format: format === ExportFormat.JPEG ? "jpeg" : "png",
                        quality: request.quality,
                        omitBackground: request.omitBackground
                    },
                    render: {
                        waitUntil: "networkidle",
                        delayMs: 500
                    }
                });

                return {
                    buffer: result.buffer,
                    format,
                    width: result.width,
                    height: result.height,
                    path: result.path ?? request.outputPath,
                    engine: "clickclick"
                };
            } catch (err) {
                console.error("[render] ClickClick failed, falling back to Playwright: %O", err);
            }
        }

        return this.playwright.render(request);
    }

    /**
     * Inspects a loaded page via Playwright (audit, live).
     *
     * @param html Document
     * @param fn Callback
     * @param baseDir Folder relative image paths resolve against
     * @param root Folder images must stay inside
     * @returns Callback result
     */
    inspect<T>(html: string, fn: (page: Page) => Promise<T>, baseDir?: string, root?: string): Promise<T> {
        return this.playwright.inspect(HtmlDocument.prepare(html, baseDir, root), fn);
    }

    /**
     * Closes browsers owned by both engines.
     */
    async close(): Promise<void> {
        await this.playwright.close();
    }

    /**
     * Loads ClickClick once. Missing or failed import is a documented fallback.
     *
     * @returns Module or null
     */
    private async loadClickClick(): Promise<ClickClickModule | null> {
        if (this.clickclick !== undefined) {
            return this.clickclick;
        }

        try {
            this.clickclick = (await import("@maurogoncalo/clickclick")) as ClickClickModule;
        } catch {
            this.clickclick = null;
        }

        return this.clickclick;
    }
}

/**
 * Infers format from extension.
 *
 * @param outputPath Destination
 * @returns Format
 */
function inferFormat(outputPath?: string): ExportFormat {
    const ext = outputPath ? extname(outputPath).toLowerCase() : ".png";

    if (ext === ".jpg" || ext === ".jpeg") {
        return ExportFormat.JPEG;
    }

    if (ext === ".pdf") {
        return ExportFormat.PDF;
    }

    if (ext === ".svg") {
        return ExportFormat.SVG;
    }

    if (ext === ".html") {
        return ExportFormat.HTML;
    }

    return ExportFormat.PNG;
}
