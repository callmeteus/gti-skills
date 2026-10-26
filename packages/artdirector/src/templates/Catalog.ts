import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ArtErrors, Paths, type ArtworkCategory } from "../core";
import { Formats } from "../design";

/**
 * A reusable HTML template with token slots and optional ClickClick `data-layer` names.
 */
export interface TemplateSpec {
    id: string;
    title: string;
    category: ArtworkCategory;
    formatId: string;
    html: string;
    layers: string[];
}

/**
 * Loads templates from `library/templates`.
 */
export namespace TemplateCatalog {
    /**
     * Lists available templates.
     *
     * @returns Template specs
     */
    export function list(): TemplateSpec[] {
        const dir = join(Paths.libraryDir(), "templates");

        if (!existsSync(dir)) {
            return [];
        }

        return readdirSync(dir)
            .filter((name) => name.endsWith(".html"))
            .map((name) => read(name.replace(/\.html$/, "")));
    }

    /**
     * Reads one template.
     *
     * @param id Template id (filename without extension)
     * @returns Spec
     */
    export function read(id: string): TemplateSpec {
        const file = join(Paths.libraryDir(), "templates", `${id}.html`);

        if (!existsSync(file)) {
            throw ArtErrors.notFound(`Unknown template: ${id}`);
        }

        const html = readFileSync(file, "utf8");
        const title = attr(html, "data-title") ?? id;
        const category = (attr(html, "data-category") ?? "social-card") as ArtworkCategory;
        const formatId = attr(html, "data-format") ?? Formats.defaultFor(category).id;
        const layers = [...html.matchAll(/data-layer="([^"]+)"/g)].map((match) => match[1] ?? "");

        return {
            id,
            title,
            category,
            formatId,
            html,
            layers: [...new Set(layers.filter(Boolean))]
        };
    }
}

/**
 * Reads a data-* attribute from the first tag.
 *
 * @param html Template source
 * @param name Attribute name
 * @returns Value or undefined
 */
function attr(html: string, name: string): string | undefined {
    const match = html.match(new RegExp(`${name}="([^"]+)"`));
    return match?.[1];
}
