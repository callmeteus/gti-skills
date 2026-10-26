import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DefaultBrandColors, DefaultProjectName, Paths, type BrandContext, type CreativeBrief } from "../core";
import { Formats } from "../design";
import { Fonts } from "../assets";
import type { TemplateSpec } from "./Catalog";

/**
 * Token map applied to templates (`{{key}}` and `data-layer` text).
 */
export type TemplateTokens = Record<string, string>;

/**
 * Fills a template with brand, brief, and extra tokens.
 */
export namespace TemplateApply {
    /**
     * Builds the token map for a project.
     *
     * Only values the user actually set are included, so a template keeps its own sample copy and
     * palette (`{{token|default}}`) until the brief or brand provides something. Brand colors count
     * as set once they differ from the colors a new project starts with. Every brief copy field
     * (`brief.copy.<key>`) becomes a token of the same name. `extra` wins over everything.
     *
     * @param options Brand, brief, optional template format, and extras
     * @returns Token map
     */
    export function tokens(options: {
        brand: BrandContext;
        brief: CreativeBrief;
        extra?: TemplateTokens;
        formatId?: string;
    }): TemplateTokens {
        const format = Formats.byId(options.formatId ?? options.brief.formatId ?? "") ?? Formats.defaultFor(options.brief.category);
        const { brand, brief } = options;
        const map: TemplateTokens = {
            width: String(format.width),
            height: String(format.height)
        };

        const set = (key: string, value: string | undefined, unset?: string): void => {
            if (value && value !== unset) {
                map[key] = value;
            }
        };

        set("brandName", brand.name, DefaultProjectName);
        set("tagline", brand.tagline);
        set("ink", brand.colors.ink, DefaultBrandColors.ink);
        set("paper", brand.colors.paper, DefaultBrandColors.paper);
        set("accent", brand.colors.accent, DefaultBrandColors.accent);
        set("muted", brand.colors.muted, DefaultBrandColors.muted);
        set("title", brief.copy.title ?? brief.goal);
        set("subtitle", brief.copy.subtitle);

        for (const [key, value] of Object.entries(brief.copy)) {
            set(key, value);
        }

        return {
            ...map,
            ...(options.extra ?? {})
        };
    }

    /**
     * Substitutes `{{token}}` and `{{token|default}}` placeholders. A token that is missing or
     * empty in the map uses its default. `{{> effect}}` includes are left for {@link Effects.expand}.
     *
     * @param html Template HTML
     * @param map Token map
     * @returns Filled HTML
     */
    export function fill(html: string, map: TemplateTokens): string {
        return html.replace(/\{\{([a-zA-Z0-9_]+)(?:\|([^}]*))?\}\}/g, (_, key: string, fallback?: string) => {
            const value = map[key];

            if (value !== undefined && value !== "") {
                return value;
            }

            return fallback ?? "";
        });
    }

    /**
     * Lists the tokens a template reads, with their defaults.
     *
     * @param html Template HTML
     * @returns Token name to default value (empty string when the token has no default)
     */
    export function slots(html: string): Record<string, string> {
        const result: Record<string, string> = {};

        for (const match of html.matchAll(/\{\{([a-zA-Z0-9_]+)(?:\|([^}]*))?\}\}/g)) {
            const key = match[1] ?? "";

            if (!(key in result) || (!result[key] && match[2])) {
                result[key] = match[2] ?? "";
            }
        }

        return result;
    }

    /**
     * Fills a spec and injects a Bunny Fonts import when missing.
     *
     * @param spec Template
     * @param map Token map
     * @param fontPairing Pairing id
     * @returns HTML document
     */
    export function render(spec: TemplateSpec, map: TemplateTokens, fontPairing = "editorial"): string {
        const filled = fill(spec.html, map);
        const pairing = Fonts.pairing(fontPairing);

        if (filled.includes("fonts.bunny.net")) {
            return filled;
        }

        return filled.replace("</head>", `    <style>${Fonts.importCss(pairing.bunny)}</style>\n</head>`);
    }

    /**
     * Writes a filled template into a variant folder and copies the local images it references.
     *
     * Image tokens may hold an absolute path, a path relative to `workspace`, or a path under the
     * library `photos/` folder. Each referenced file is copied into `<variantDir>/assets/` and the
     * HTML is rewritten to point at the copy, so the variant folder is self-contained.
     *
     * @param html Filled template HTML
     * @param variantDir Absolute variant folder
     * @param workspace Folder used to resolve relative paths given by the user
     * @returns HTML that references `assets/<file>` for every copied image
     */
    export function materialize(html: string, variantDir: string, workspace: string): string {
        const assetsDir = join(variantDir, "assets");
        const copied = new Map<string, string>();

        const rewrite = (reference: string): string => {
            if (!isLocalReference(reference)) {
                return reference;
            }

            const source = resolveAsset(reference, workspace);

            if (!source) {
                return reference;
            }

            if (!copied.has(source)) {
                mkdirSync(assetsDir, { recursive: true });
                const name = uniqueName(basename(source), [...copied.values()]);
                copyFileSync(source, join(assetsDir, name));
                copied.set(source, name);
            }

            return `assets/${copied.get(source)}`;
        };

        return html
            .replace(/(\ssrc=")([^"]+)(")/g, (_, open: string, value: string, close: string) => `${open}${rewrite(value)}${close}`)
            .replace(/url\((["']?)([^"')]+)\1\)/g, (match: string, quote: string, value: string) => {
                const next = rewrite(value);
                return next === value ? match : `url(${quote}${next}${quote})`;
            });
    }
}

/**
 * True for references that point at a file on disk (not data, http, fragment, or effect markers).
 *
 * @param reference Value of a src attribute or url()
 * @returns Whether it is a local file reference
 */
function isLocalReference(reference: string): boolean {
    return Boolean(reference) &&
        !/^(data:|https?:|blob:|#|\{\{|about:)/i.test(reference) &&
        !reference.startsWith("assets/");
}

/**
 * Resolves an image reference to an existing file.
 *
 * @param reference Absolute path, file URL, workspace-relative path, or library-relative path
 * @param workspace Folder for relative paths
 * @returns Absolute path, or null when no file exists
 */
function resolveAsset(reference: string, workspace: string): string | null {
    if (/^file:/i.test(reference)) {
        const file = fileURLToPath(reference);
        return existsSync(file) ? file : null;
    }

    const candidates = isAbsolute(reference)
        ? [reference]
        : [resolve(workspace, reference), join(Paths.libraryDir(), reference)];

    return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

/**
 * Picks a file name that is not taken yet.
 *
 * @param name Desired name
 * @param taken Names already used
 * @returns Free name
 */
function uniqueName(name: string, taken: string[]): string {
    if (!taken.includes(name)) {
        return name;
    }

    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let index = 2;

    while (taken.includes(`${stem}-${index}${ext}`)) {
        index += 1;
    }

    return `${stem}-${index}${ext}`;
}
