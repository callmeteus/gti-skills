import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ArtErrors, Paths } from "../core";

/**
 * File extensions an effect can have, in lookup order.
 */
const EffectExtensions = [".css", ".svg", ".html"];

/**
 * Matches `{{> effect-id}}` include markers.
 */
const IncludePattern = /\{\{>\s*([a-z0-9-]+)\s*\}\}/g;

/**
 * One reusable CSS or SVG snippet from `library/effects`.
 */
export interface EffectSpec {
    id: string;
    kind: "css" | "svg" | "html";
    summary: string;
    source: string;
}

/**
 * Reusable visual effects (textures, photo treatments, type effects, ornaments).
 *
 * Artwork and templates include an effect with `{{> effect-id}}`. Includes are expanded when
 * a template is filled, when the studio serves an artwork, and when the renderer exports it,
 * so the source HTML stays short and every piece shares one implementation.
 */
export namespace Effects {
    /**
     * Lists every effect.
     *
     * @returns Effect specs sorted by id
     */
    export function list(): EffectSpec[] {
        const dir = effectsDir();

        if (!existsSync(dir)) {
            return [];
        }

        const ids = readdirSync(dir)
            .filter((name) => EffectExtensions.some((ext) => name.endsWith(ext)))
            .map((name) => name.replace(/\.(css|svg|html)$/, ""));

        return [...new Set(ids)].sort().map((id) => read(id));
    }

    /**
     * Reads one effect.
     *
     * @param id Effect id (file name without extension)
     * @returns Spec
     */
    export function read(id: string): EffectSpec {
        for (const ext of EffectExtensions) {
            const file = join(effectsDir(), `${id}${ext}`);

            if (existsSync(file)) {
                const source = readFileSync(file, "utf8");

                if (/<\/style/i.test(source)) {
                    throw ArtErrors.project(`Effect ${id} contains a closing style tag, which would end the page stylesheet early.`);
                }
                const summary = source.match(/@summary\s+([^\n*]+)/)?.[1]?.trim() ?? id;

                return {
                    id,
                    kind: ext.slice(1) as EffectSpec["kind"],
                    summary,
                    source
                };
            }
        }

        throw ArtErrors.notFound(`Unknown effect: ${id}. Run \`artdirector effects --json\` to list them.`);
    }

    /**
     * Replaces every `{{> effect-id}}` marker with the effect source. Each effect is inlined once;
     * later markers for the same effect are removed.
     *
     * @param html Artwork or template HTML
     * @returns HTML with effects inlined
     */
    export function expand(html: string): string {
        const seen = new Set<string>();

        return html.replace(IncludePattern, (_, id: string) => {
            if (seen.has(id)) {
                return "";
            }

            seen.add(id);
            return read(id).source.trim();
        });
    }

    /**
     * Lists the effect ids a document includes.
     *
     * @param html Artwork or template HTML
     * @returns Unique effect ids in order of first use
     */
    export function used(html: string): string[] {
        return [...new Set([...html.matchAll(IncludePattern)].map((match) => match[1] ?? ""))].filter(Boolean);
    }
}

/**
 * Folder that holds the effects.
 *
 * @returns Absolute path
 */
function effectsDir(): string {
    return join(Paths.libraryDir(), "effects");
}
