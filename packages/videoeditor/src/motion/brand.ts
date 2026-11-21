import { existsSync, readFileSync } from "node:fs";

import { VideoErrors } from "../core/Errors";
import type { BrandKit } from "./types";

/** Default kit. Compositions read these as CSS variables --brand-*. */
export const DefaultBrand: BrandKit = {
    name: "Studio Default",
    colors: {
        primary: "#6C5CE7",
        secondary: "#00D2A6",
        accent: "#FFB020",
        background: "#0E1016",
        text: "#FFFFFF"
    },
    fonts: { display: "Arial, sans-serif", body: "Arial, sans-serif" },
    tone: "confident, plain spoken, design led"
};

/** Reads a brand.json, falling back to defaults for missing keys. */
export function readBrand(path?: string): BrandKit {
    if (!path) {
        return DefaultBrand;
    }

    if (!existsSync(path)) {
        throw VideoErrors.input(`Brand kit not found: ${path}`);
    }

    try {
        const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<BrandKit>;
        return {
            name: raw.name ?? DefaultBrand.name,
            colors: { ...DefaultBrand.colors, ...(raw.colors ?? {}) },
            fonts: { ...DefaultBrand.fonts, ...(raw.fonts ?? {}) },
            logo: raw.logo,
            tone: raw.tone ?? DefaultBrand.tone
        };
    } catch (error) {
        throw VideoErrors.input(`Invalid brand kit ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** CSS custom properties injected into every composition. */
export function brandCss(brand: BrandKit): string {
    const colors = Object.entries(brand.colors)
        .map(([key, value]) => `--brand-${key}:${value};`)
        .join("");
    const fonts = Object.entries(brand.fonts)
        .map(([key, value]) => `--font-${key}:${value};`)
        .join("");
    return `:root{${colors}${fonts}}`;
}

/** Escapes a value used in HTML text or attributes. */
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** Replaces {{TOKEN}} placeholders, leaving unknown tokens intact. */
export function fillTokens(html: string, values: Record<string, string>): string {
    return html.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, token: string) => values[token] ?? match);
}
