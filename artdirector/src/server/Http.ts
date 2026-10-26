import { createReadStream, existsSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname } from "node:path";

import { ArtDirectorError } from "../core";

/**
 * Minimal HTTP helpers for the local studio server.
 */
export namespace Http {
    /**
     * Reads the request body as JSON.
     *
     * @param req Incoming request
     * @returns Parsed object
     */
    export async function jsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
        const chunks: Buffer[] = [];

        for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        const raw = Buffer.concat(chunks).toString("utf8").trim();

        if (!raw) {
            return {};
        }

        return JSON.parse(raw) as Record<string, unknown>;
    }

    /**
     * Sends a JSON response.
     *
     * @param res Response
     * @param status Status code
     * @param body Body
     */
    export function json(res: ServerResponse, status: number, body: unknown): void {
        const payload = JSON.stringify(body);
        res.writeHead(status, {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Length": Buffer.byteLength(payload),
            "Cache-Control": "no-store"
        });
        res.end(payload);
    }

    /**
     * Maps an error to JSON.
     *
     * @param res Response
     * @param err Error
     */
    export function error(res: ServerResponse, err: unknown): void {
        if (err instanceof ArtDirectorError) {
            json(res, err.status, {
                ok: false,
                error: err.code,
                summary: err.message
            });
            return;
        }

        json(res, 500, {
            ok: false,
            error: "INTERNAL",
            summary: err instanceof Error ? err.message : String(err)
        });
    }

    /**
     * Serves a static file if it exists.
     *
     * @param res Response
     * @param file Absolute path
     * @returns Whether the file was served
     */
    export function file(res: ServerResponse, file: string): boolean {
        if (!existsSync(file) || statSync(file).isDirectory()) {
            return false;
        }

        const type = mime(extname(file));
        res.writeHead(200, {
            "Content-Type": type,
            "Cache-Control": "no-store"
        });
        createReadStream(file).pipe(res);
        return true;
    }

    /**
     * Sends HTML.
     *
     * @param res Response
     * @param html Markup
     */
    export function html(res: ServerResponse, html: string): void {
        res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store"
        });
        res.end(html);
    }

    /**
     * Reads a query param.
     *
     * @param url Parsed URL
     * @param name Param name
     * @returns Value
     */
    export function query(url: URL, name: string): string | undefined {
        return url.searchParams.get(name) ?? undefined;
    }
}

/**
 * MIME type from extension.
 *
 * @param ext Extension
 * @returns MIME type
 */
function mime(ext: string): string {
    switch (ext) {
        case ".html":
            return "text/html; charset=utf-8";
        case ".css":
            return "text/css; charset=utf-8";
        case ".js":
            return "text/javascript; charset=utf-8";
        case ".json":
            return "application/json; charset=utf-8";
        case ".svg":
            return "image/svg+xml";
        case ".png":
            return "image/png";
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".pdf":
            return "application/pdf";
        default:
            return "application/octet-stream";
    }
}
