import { existsSync, readFileSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";

import { Effects } from "../templates";

/**
 * Helpers for assembling a locked artboard document.
 */
export namespace HtmlDocument {
    /**
     * Wraps inner markup in a full document with a fixed artboard.
     *
     * @param options Document parts
     * @returns HTML string
     */
    export function artboard(options: {
        title: string;
        width: number;
        height: number;
        css: string;
        body: string;
        fontImport?: string;
    }): string {
        const font = options.fontImport ? `        ${options.fontImport}\n` : "";

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=${options.width}">
    <title>${escapeHtml(options.title)}</title>
${font}    <style>
        html, body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background: #000;
        }

        .artboard {
            width: ${options.width}px;
            height: ${options.height}px;
            position: relative;
            overflow: hidden;
        }

${options.css}
    </style>
</head>
<body>
    <div class="artboard" data-artdirector-root data-width="${options.width}" data-height="${options.height}">
${options.body}
    </div>
</body>
</html>
`;
    }

    /**
     * Reads width/height from `data-width` / `data-height` or `.artboard` CSS.
     *
     * @param html Document
     * @returns Dimensions
     */
    export function dimensions(html: string): { width: number; height: number } {
        const dataW = html.match(/data-width="(\d+)"/);
        const dataH = html.match(/data-height="(\d+)"/);

        if (dataW && dataH) {
            return {
                width: Number(dataW[1]),
                height: Number(dataH[1])
            };
        }

        const cssW = html.match(/\.artboard\s*\{[^}]*width:\s*(\d+)px/);
        const cssH = html.match(/\.artboard\s*\{[^}]*height:\s*(\d+)px/);

        return {
            width: Number(cssW?.[1] ?? 1080),
            height: Number(cssH?.[1] ?? 1080)
        };
    }

    /**
     * Prepares artwork HTML for rendering: expands `{{> effect}}` includes and, when a base folder
     * is given, inlines local images as data URIs so the page renders without a file server.
     *
     * @param html Artwork HTML
     * @param baseDir Folder relative image paths resolve against
     * @param root Folder images must stay inside (defaults to baseDir)
     * @returns Self-contained HTML
     */
    export function prepare(html: string, baseDir?: string, root?: string): string {
        const expanded = Effects.expand(html);

        if (!baseDir) {
            return expanded;
        }

        const boundary = resolve(root ?? baseDir);

        return mapLocalReferences(expanded, (reference) => {
            const file = resolve(baseDir, decodeURI(reference.split(/[?#]/)[0] ?? ""));
            const inside = relative(boundary, file);

            if (inside.startsWith("..") || isAbsolute(inside) || !existsSync(file)) {
                return null;
            }

            const mime = ImageMimeTypes[extname(file).toLowerCase()];

            if (!mime) {
                return null;
            }

            return `data:${mime};base64,${readFileSync(file).toString("base64")}`;
        });
    }

    /**
     * Rewrites every relative file reference in `src="..."` attributes and CSS `url(...)` values.
     * Data URIs, web URLs, fragments (`#id`), and absolute paths are left alone.
     *
     * @param html Artwork HTML
     * @param map Returns the new reference, or null to keep the original
     * @returns Rewritten HTML
     */
    export function mapLocalReferences(html: string, map: (reference: string) => string | null): string {
        const local = (reference: string): string | null => {
            if (!reference || /^(data:|https?:|blob:|#|about:|\/)/i.test(reference)) {
                return null;
            }

            return map(reference);
        };

        return html
            .replace(/(\ssrc=")([^"]+)(")/g, (match: string, open: string, value: string, close: string) => {
                const next = local(value);
                return next ? `${open}${next}${close}` : match;
            })
            .replace(/url\((["']?)([^"')]+)\1\)/g, (match: string, quote: string, value: string) => {
                const next = local(value);
                return next ? `url(${quote}${next}${quote})` : match;
            });
    }

    /**
     * Splits a full document into ClickClick-style html + css fragments when possible.
     *
     * @param html Full document
     * @returns Fragments
     */
    export function fragments(html: string): { html: string; css: string } {
        const style = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
            .map((match) => match[1] ?? "")
            .join("\n");
        const links = [...html.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi)]
            .map((match) => match[0] ?? "")
            .join("\n");
        const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;

        return {
            html: [links.trim(), body.trim()].filter(Boolean).join("\n"),
            css: style.trim()
        };
    }
}

/**
 * MIME types for images that may be inlined.
 */
const ImageMimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".avif": "image/avif"
};

/**
 * Escapes text for HTML.
 *
 * @param value Raw text
 * @returns Escaped text
 */
function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;");
}
