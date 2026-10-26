import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, extname } from "node:path";
import { chromium, type Browser, type Page } from "playwright";

import { ArtErrors, ExportFormat } from "../core";
import { HtmlDocument } from "./HtmlDocument";
import type { RenderRequest, RenderResult } from "./Types";

/**
 * Playwright-backed renderer used for live previews, audit, PDF, and as the
 * ClickClick-compatible fallback for PNG/JPEG.
 */
export class PlaywrightRenderer {
    private browser: Browser | null = null;

    /**
     * Renders HTML to an image or PDF.
     *
     * @param request Render request
     * @returns Result with path and buffer
     */
    async render(request: RenderRequest): Promise<RenderResult> {
        const format = request.format ?? inferFormat(request.outputPath);
        const dims = HtmlDocument.dimensions(request.html);
        const page = await this.page(dims.width, dims.height);

        try {
            await page.setContent(request.html, {
                waitUntil: "networkidle",
                timeout: 30000
            });
            await waitForFonts(page);
            await page.waitForTimeout(500);

            if (request.beforeCapture) {
                await request.beforeCapture(page);
            }

            const target = page.locator("[data-artdirector-root], .artboard, body").first();
            const box = await target.boundingBox();
            const width = Math.round(box?.width ?? dims.width);
            const height = Math.round(box?.height ?? dims.height);

            if (format === ExportFormat.PDF) {
                const buffer = await page.pdf({
                    width: `${width}px`,
                    height: `${height}px`,
                    printBackground: true
                });
                return writeResult(request.outputPath, buffer, format, width, height);
            }

            if (format === ExportFormat.SVG) {
                const svg = await page.evaluate(() => {
                    const root = document.querySelector("[data-artdirector-root], .artboard");
                    const svgNode = root?.querySelector("svg") ?? document.querySelector("svg");
                    return svgNode ? svgNode.outerHTML : "";
                });

                if (!svg) {
                    throw ArtErrors.render("SVG export needs an SVG root in the composition. Export PNG or HTML instead.");
                }

                const buffer = Buffer.from(svg, "utf8");
                return writeResult(request.outputPath, buffer, format, width, height);
            }

            const buffer = await target.screenshot({
                type: format === ExportFormat.JPEG ? "jpeg" : "png",
                omitBackground: request.omitBackground === true,
                quality: format === ExportFormat.JPEG ? (request.quality ?? 90) : undefined
            });

            return writeResult(request.outputPath, buffer, format, width, height);
        } finally {
            await page.context().close();
        }
    }

    /**
     * Runs a function against a loaded artboard (used by audit).
     *
     * @param html Document
     * @param fn Page callback
     * @returns Callback result
     */
    async inspect<T>(html: string, fn: (page: Page) => Promise<T>): Promise<T> {
        const dims = HtmlDocument.dimensions(html);
        const page = await this.page(dims.width, dims.height);

        try {
            await page.setContent(html, {
                waitUntil: "load",
                timeout: 30000
            });
            await waitForFonts(page);
            return await fn(page);
        } finally {
            await page.context().close();
        }
    }

    /**
     * Closes the shared browser.
     */
    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Opens a page at the artboard size.
     *
     * @param width Viewport width
     * @param height Viewport height
     * @returns Page
     */
    private async page(width: number, height: number): Promise<Page> {
        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: true
            });
        }

        const context = await this.browser.newContext({
            viewport: {
                width,
                height
            },
            deviceScaleFactor: 1
        });

        return context.newPage();
    }
}

/**
 * Infers format from a file extension.
 *
 * @param outputPath Destination path
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

/**
 * Waits for document fonts when the Font Loading API is available.
 *
 * @param page Playwright page
 */
async function waitForFonts(page: Page): Promise<void> {
    await page.evaluate(async () => {
        if ("fonts" in document) {
            await document.fonts.ready;
        }
    });
    await page.waitForTimeout(200);
}

/**
 * Writes a buffer and returns the result.
 *
 * @param outputPath Optional destination
 * @param buffer Bytes
 * @param format Format
 * @param width Width
 * @param height Height
 * @returns Result
 */
function writeResult(
    outputPath: string | undefined,
    buffer: Buffer,
    format: ExportFormat,
    width: number,
    height: number
): RenderResult {
    if (outputPath) {
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, buffer);
    }

    return {
        buffer,
        format,
        width,
        height,
        path: outputPath,
        engine: "playwright"
    };
}
