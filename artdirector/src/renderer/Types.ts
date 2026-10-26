import type { Page } from "playwright";

import type { ExportFormat } from "../core";

/**
 * Unified render request. Callers do not choose an engine.
 */
export interface RenderRequest {
    html: string;
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
