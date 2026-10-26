import type { Page } from "playwright";

import type { ExportFormat } from "../core";

/**
 * Unified render request. Callers do not choose an engine.
 */
export interface RenderRequest {
    html: string;
    /** Folder that relative image paths in the HTML are resolved against (usually the artwork folder). */
    baseDir?: string;
    /** Folder local images must stay inside. Defaults to `baseDir`. */
    root?: string;
    outputPath?: string;
    format?: ExportFormat;
    quality?: number;
    omitBackground?: boolean;
    beforeCapture?: (page: Page) => Promise<void>;
}

/**
 * Unified render result.
 */
export interface RenderResult {
    buffer: Buffer;
    format: ExportFormat;
    width: number;
    height: number;
    path?: string;
    engine: "clickclick" | "playwright";
}
