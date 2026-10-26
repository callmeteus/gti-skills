import { ArtCommand } from "../core";

/**
 * Command metadata shared by the CLI, studio, and skill.
 */
export interface CommandMeta {
    id: ArtCommand;
    label: string;
    category: "build" | "evaluate" | "refine" | "produce";
    summary: string;
    liveAction: boolean;
}

/**
 * Unified vocabulary. Semantics are graphic-design, even when names match Impeccable.
 */
export const CommandRegistry: CommandMeta[] = [
    {
        id: ArtCommand.INIT,
        label: "Init",
        category: "build",
        summary: "Create project files, brand tokens, and session state.",
        liveAction: false
    },
    {
        id: ArtCommand.BRIEF,
        label: "Brief",
        category: "build",
        summary: "Record the communication goal, audience, format, and constraints.",
        liveAction: false
    },
    {
        id: ArtCommand.SHAPE,
        label: "Shape",
        category: "build",
        summary: "Choose a visual direction from rendered alternatives.",
        liveAction: false
    },
    {
        id: ArtCommand.CRAFT,
        label: "Craft",
        category: "build",
        summary: "Design a complete piece or campaign in HTML/CSS/SVG.",
        liveAction: false
    },
    {
        id: ArtCommand.GENERATE,
        label: "Generate",
        category: "build",
        summary: "Create and compare real HTML variants in the studio gallery.",
        liveAction: true
    },
    {
        id: ArtCommand.LIVE,
        label: "Live",
        category: "refine",
        summary: "Select elements in the rendered artwork and request changes.",
        liveAction: true
    },
    {
        id: ArtCommand.CRITIQUE,
        label: "Critique",
        category: "evaluate",
        summary: "Review hierarchy, type, and originality against the quality floor.",
        liveAction: false
    },
    {
        id: ArtCommand.AUDIT,
        label: "Audit",
        category: "evaluate",
        summary: "Run deterministic rendering checks (size, overflow, fonts, assets).",
        liveAction: false
    },
    {
        id: ArtCommand.POLISH,
        label: "Polish",
        category: "refine",
        summary: "Final refinement pass before export.",
        liveAction: true
    },
    {
        id: ArtCommand.BOLDER,
        label: "Bolder",
        category: "refine",
        summary: "Increase visual impact without changing the brief.",
        liveAction: true
    },
    {
        id: ArtCommand.QUIETER,
        label: "Quieter",
        category: "refine",
        summary: "Reduce visual noise and competing accents.",
        liveAction: true
    },
    {
        id: ArtCommand.TYPESET,
        label: "Typeset",
        category: "refine",
        summary: "Refine typographic hierarchy, measure, and pairing.",
        liveAction: true
    },
    {
        id: ArtCommand.COLORIZE,
        label: "Colorize",
        category: "refine",
        summary: "Explore color treatments inside the chosen direction.",
        liveAction: true
    },
    {
        id: ArtCommand.LAYOUT,
        label: "Layout",
        category: "refine",
        summary: "Adjust composition, alignment, and spatial rhythm.",
        liveAction: true
    },
    {
        id: ArtCommand.DISTILL,
        label: "Distill",
        category: "refine",
        summary: "Remove anything that does not serve the communication goal.",
        liveAction: true
    },
    {
        id: ArtCommand.ADAPT,
        label: "Adapt",
        category: "produce",
        summary: "Adapt an approved piece to another format or size.",
        liveAction: false
    },
    {
        id: ArtCommand.EXPORT,
        label: "Export",
        category: "produce",
        summary: "Export PNG, JPEG, SVG, PDF, or HTML from the accepted artwork.",
        liveAction: false
    },
    {
        id: ArtCommand.RESUME,
        label: "Resume",
        category: "build",
        summary: "Recover the project, session, and pending live events.",
        liveAction: false
    }
];

/**
 * Live Mode action chips shown on a selected element.
 */
export const LiveActions = [
    {
        id: "freeform",
        label: "Apply note"
    },
    {
        id: ArtCommand.BOLDER,
        label: "Make bolder"
    },
    {
        id: ArtCommand.DISTILL,
        label: "Simplify"
    },
    {
        id: ArtCommand.TYPESET,
        label: "Improve typography"
    },
    {
        id: ArtCommand.LAYOUT,
        label: "Improve hierarchy"
    },
    {
        id: "composition",
        label: "Try a different composition"
    },
    {
        id: ArtCommand.QUIETER,
        label: "Reduce decorative noise"
    },
    {
        id: "contrast",
        label: "Increase contrast"
    },
    {
        id: "editorial",
        label: "Make more editorial"
    },
    {
        id: "premium",
        label: "Make more premium"
    },
    {
        id: "brand",
        label: "Preserve brand identity"
    },
    {
        id: "direction",
        label: "Try a completely different direction"
    }
] as const;

/**
 * Command lookup.
 */
export namespace Commands {
    /**
     * Finds metadata for a command id.
     *
     * @param id Command id
     * @returns Metadata or undefined
     */
    export function byId(id: string): CommandMeta | undefined {
        return CommandRegistry.find((item) => item.id === id);
    }

    /**
     * True when `value` is a known command.
     *
     * @param value Candidate
     * @returns Whether it is an ArtCommand
     */
    export function isCommand(value: string): value is ArtCommand {
        return CommandRegistry.some((item) => item.id === value);
    }
}
