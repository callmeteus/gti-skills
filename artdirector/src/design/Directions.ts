import { VisualDirection } from "../core";

/**
 * Description of a named visual direction, used for studio cards and agent guidance.
 */
export interface DirectionSpec {
    id: VisualDirection;
    label: string;
    summary: string;
    displayFont: string;
    bodyFont: string;
    ink: string;
    paper: string;
    accent: string;
    density: string;
    layout: string;
    avoid: string[];
}

/**
 * The ten built-in directions. Each has a matching HTML preview in `library/directions`.
 */
export const DirectionCatalog: DirectionSpec[] = [
    {
        id: VisualDirection.EDITORIAL_TYPOGRAPHIC,
        label: "Editorial and typographic",
        summary: "Magazine composure: a display serif, ruled margins, and type as the image.",
        displayFont: "Fraunces",
        bodyFont: "IBM Plex Sans",
        ink: "#14110e",
        paper: "#f4efe6",
        accent: "#c23b22",
        density: "sparse",
        layout: "asymmetric column with a vertical kicker",
        avoid: ["hero cards", "centered everything", "soft purple gradients"]
    },
    {
        id: VisualDirection.BOLD_PROMOTIONAL,
        label: "Bold promotional",
        summary: "One claim at poster scale. High contrast, few words, a single loud accent.",
        displayFont: "Archivo Black",
        bodyFont: "Space Grotesk",
        ink: "#f4ef3a",
        paper: "#101010",
        accent: "#f4ef3a",
        density: "dense type, empty field",
        layout: "full-bleed type stacked to the edges",
        avoid: ["rounded SaaS cards", "drop shadows as depth"]
    },
    {
        id: VisualDirection.SWISS_INSPIRED,
        label: "Swiss-inspired",
        summary: "Modular grid, grotesque sans, mathematical spacing, one accent rule.",
        displayFont: "IBM Plex Sans",
        bodyFont: "IBM Plex Sans",
        ink: "#111111",
        paper: "#f7f7f5",
        accent: "#d31212",
        density: "balanced",
        layout: "strict columns, flush left, no ornament",
        avoid: ["script fonts", "bevels", "stock illustrations"]
    },
    {
        id: VisualDirection.MINIMALIST_GEOMETRIC,
        label: "Minimalist geometric",
        summary: "Few shapes, large fields, one circle or bar doing structural work.",
        displayFont: "Syne",
        bodyFont: "IBM Plex Sans",
        ink: "#1b1b1b",
        paper: "#f6f3ee",
        accent: "#2f5d50",
        density: "sparse",
        layout: "large shape + small type cluster",
        avoid: ["icon grids", "illustrative filler"]
    },
    {
        id: VisualDirection.NEO_BRUTALIST,
        label: "Neo-brutalist",
        summary: "Hard offsets, thick borders, raw type, no polite radius.",
        displayFont: "Space Grotesk",
        bodyFont: "IBM Plex Mono",
        ink: "#111111",
        paper: "#efe8d8",
        accent: "#3d5afe",
        density: "dense",
        layout: "offset slabs with hard drop",
        avoid: ["soft UI kits", "glassmorphism"]
    },
    {
        id: VisualDirection.PREMIUM_CORPORATE,
        label: "Premium corporate",
        summary: "Quiet luxury: restrained gold, deep ink, measured serif, no chrome.",
        displayFont: "Newsreader",
        bodyFont: "IBM Plex Sans",
        ink: "#ece7dc",
        paper: "#161412",
        accent: "#c6a15b",
        density: "sparse",
        layout: "wide margins, hairline frames, small caps",
        avoid: ["stock handshake photos", "lens flares"]
    },
    {
        id: VisualDirection.VINTAGE_PRINT,
        label: "Vintage print",
        summary: "Halftone, overprint, paper grain, condensed wood type.",
        displayFont: "Fraunces",
        bodyFont: "IBM Plex Serif",
        ink: "#3a2415",
        paper: "#e8d7b8",
        accent: "#9c2b18",
        density: "balanced",
        layout: "poster hierarchy with a stamped mark",
        avoid: ["digital neon", "UI buttons"]
    },
    {
        id: VisualDirection.EXPRESSIVE_PLAYFUL,
        label: "Expressive and playful",
        summary: "Off-register color, bouncing scale, a serious grid underneath the play.",
        displayFont: "Syne",
        bodyFont: "Space Grotesk",
        ink: "#1a1033",
        paper: "#fff4d6",
        accent: "#ff5a36",
        density: "balanced",
        layout: "overlapping type and simple geometric stickers",
        avoid: ["clip-art characters", "rainbow gradients"]
    },
    {
        id: VisualDirection.TECHNICAL_INFOGRAPHIC,
        label: "Technical infographic",
        summary: "Blueprint discipline: numbered modules, hairline diagrams, mono labels.",
        displayFont: "IBM Plex Sans",
        bodyFont: "IBM Plex Mono",
        ink: "#d7e6ef",
        paper: "#0b1c28",
        accent: "#3ec8e0",
        density: "dense",
        layout: "numbered modules on a construction grid",
        avoid: ["3D pie charts", "stock isometric towns"]
    },
    {
        id: VisualDirection.DATA_DRIVEN_EDITORIAL,
        label: "Data-driven editorial",
        summary: "A statistic as the headline, annotated chart as the body, newsroom type.",
        displayFont: "Fraunces",
        bodyFont: "IBM Plex Sans",
        ink: "#12202b",
        paper: "#f3efe6",
        accent: "#0e6b5c",
        density: "balanced",
        layout: "big number + small annotated chart",
        avoid: ["rainbow bar charts", "3D columns"]
    }
];

/**
 * Direction catalog helpers.
 */
export namespace Directions {
    /**
     * Finds a direction spec.
     *
     * @param id Direction id
     * @returns Spec
     */
    export function byId(id: VisualDirection): DirectionSpec {
        const found = DirectionCatalog.find((item) => item.id === id);

        if (!found) {
            throw new Error(`Unknown visual direction: ${id}`);
        }

        return found;
    }

    /**
     * Picks a small set of alternatives when the user has not chosen.
     *
     * @param category Optional category hint
     * @returns Three direction specs
     */
    export function suggest(category?: string): DirectionSpec[] {
        if (category === "infographic" || category === "data-viz") {
            return pick(
                VisualDirection.TECHNICAL_INFOGRAPHIC,
                VisualDirection.DATA_DRIVEN_EDITORIAL,
                VisualDirection.SWISS_INSPIRED
            );
        }

        if (category === "promotion" || category === "announcement") {
            return pick(
                VisualDirection.BOLD_PROMOTIONAL,
                VisualDirection.NEO_BRUTALIST,
                VisualDirection.PREMIUM_CORPORATE
            );
        }

        if (category === "cover" || category === "editorial" || category === "typography") {
            return pick(
                VisualDirection.EDITORIAL_TYPOGRAPHIC,
                VisualDirection.VINTAGE_PRINT,
                VisualDirection.MINIMALIST_GEOMETRIC
            );
        }

        return pick(
            VisualDirection.EDITORIAL_TYPOGRAPHIC,
            VisualDirection.BOLD_PROMOTIONAL,
            VisualDirection.TECHNICAL_INFOGRAPHIC
        );
    }
}

/**
 * Resolves a list of direction ids to specs.
 *
 * @param ids Direction ids
 * @returns Specs
 */
function pick(...ids: VisualDirection[]): DirectionSpec[] {
    return ids.map((id) => Directions.byId(id));
}
