import type { BrandContext, CreativeBrief } from "../core";
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
     * Builds the default token map for a project.
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

        return {
            brandName: options.brand.name,
            tagline: options.brand.tagline ?? "",
            ink: options.brand.colors.ink,
            paper: options.brand.colors.paper,
            accent: options.brand.colors.accent,
            muted: options.brand.colors.muted ?? "#8a8178",
            displayFont: options.brand.fonts.display,
            bodyFont: options.brand.fonts.body,
            title: options.brief.copy.title ?? options.brief.goal ?? options.brand.name,
            subtitle: options.brief.copy.subtitle ?? options.brief.audience ?? "",
            kicker: options.brief.copy.kicker ?? "",
            body: options.brief.copy.body ?? "",
            cta: options.brief.copy.cta ?? "",
            width: String(format.width),
            height: String(format.height),
            ...(options.extra ?? {})
        };
    }

    /**
     * Substitutes `{{token}}` placeholders.
     *
     * @param html Template HTML
     * @param map Token map
     * @returns Filled HTML
     */
    export function fill(html: string, map: TemplateTokens): string {
        return html.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => map[key] ?? "");
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
}
