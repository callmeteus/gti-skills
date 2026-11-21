import type { StyleGuide } from "./types";

/**
 * Original starter Motion.md guides. They describe intent and timing, never
 * code. An agent reads one and writes a deterministic composition from it.
 * Structure and naming are inspired by OpenMotion Motion.md guides (Apache-2.0).
 */
const raw: Omit<StyleGuide, "content">[] = [
    {
        id: "kinetic-type",
        name: "Kinetic Type",
        mood: "bold, rhythmic, editorial",
        paletteRoles: ["background", "text", "accent"],
        type: "one heavy display face, tight tracking, uppercase hook",
        easing: "easeOutExpo for entrances, linear for the ticker",
        durations: "hook 0.6s, body 1.2s, hold 0.8s",
        do: ["Let words enter on separate beats", "Keep one word dominant per frame", "Hold the final line long enough to read twice"],
        dont: ["Do not animate every letter at once", "Do not use more than two weights", "Do not hide the hook behind motion"]
    },
    {
        id: "product-reveal",
        name: "Product Reveal",
        mood: "premium, calm, deliberate",
        paletteRoles: ["background", "primary", "text"],
        type: "clean geometric sans, small label over large product name",
        easing: "easeInOutCubic for the mask, easeOutQuad for the label",
        durations: "reveal 0.9s, label 0.4s, hold 1.0s",
        do: ["Reveal with a single moving mask", "Keep the product name on one line", "Leave quiet space around the object"],
        dont: ["Do not spin or bounce the product", "Do not stack three animations at the same time", "Do not cover the logo"]
    },
    {
        id: "data-callout",
        name: "Data Callout",
        mood: "precise, confident, factual",
        paletteRoles: ["background", "text", "accent"],
        type: "tabular numerals, small caps label, monospace source note",
        easing: "easeOutCubic for the count, easeOutQuad for the bar",
        durations: "count 1.0s, bar 0.6s, hold 1.2s",
        do: ["Count up to the real number", "Show the unit next to the value", "Keep the source note legible"],
        dont: ["Do not round a statistic into a false claim", "Do not animate the source note away", "Do not use decorative charts without data"]
    },
    {
        id: "lower-third",
        name: "Lower Third",
        mood: "broadcast, clear, unobtrusive",
        paletteRoles: ["background transparent", "primary", "text"],
        type: "two-line sans, name larger than role",
        easing: "easeOutCubic slide from the left",
        durations: "slide 0.35s, hold 1.5s, exit 0.25s",
        do: ["Stay inside the bottom safe area", "Use a solid plate behind text", "Keep the role line short"],
        dont: ["Do not cover the speaker's face", "Do not use thin type under 48px", "Do not animate the plate and text apart"]
    },
    {
        id: "logo-sting",
        name: "Logo Sting",
        mood: "confident, brief, memorable",
        paletteRoles: ["background", "primary", "accent"],
        type: "brand mark with the name set once",
        easing: "easeOutExpo for the scale, easeInOutQuad for the wipe",
        durations: "build 0.5s, hold 0.8s, wipe 0.4s",
        do: ["Use the approved mark file", "Give the mark one clear gesture", "End on a still frame"],
        dont: ["Do not redraw the mark", "Do not add lens flare or glitch", "Do not exceed 2s"]
    },
    {
        id: "social-hook",
        name: "Social Hook",
        mood: "direct, energetic, short attention span",
        paletteRoles: ["background", "accent", "text"],
        type: "huge question or promise, one line at a time",
        easing: "easeOutBack for the pop, snap between lines",
        durations: "line 0.35s, beat 0.1s, hold 0.7s",
        do: ["Put the promise in the first 0.5s", "Use three words or fewer per line", "Reserve the bottom fifth for platform UI"],
        dont: ["Do not fade in slowly", "Do not bury the point in a logo", "Do not use a paragraph"]
    },
    {
        id: "quote-card",
        name: "Quote Card",
        mood: "considered, editorial, human",
        paletteRoles: ["background", "text", "primary"],
        type: "large serif quote, small attribution",
        easing: "easeOutQuad for the quote, none for the attribution",
        durations: "quote 0.7s, attribution 0.3s, hold 1.4s",
        do: ["Break the quote into two natural lines", "Credit the speaker", "Keep a quiet margin"],
        dont: ["Do not paraphrase without saying so", "Do not animate punctuation", "Do not use all caps"]
    },
    {
        id: "chapter-card",
        name: "Chapter Card",
        mood: "structured, instructive, steady",
        paletteRoles: ["background", "primary", "text"],
        type: "number plus short label, aligned left",
        easing: "easeOutCubic vertical reveal",
        durations: "number 0.3s, label 0.4s, hold 1.0s",
        do: ["Number the chapter", "Keep the label under six words", "Match the previous card's rhythm"],
        dont: ["Do not change layout between chapters", "Do not skip a number", "Do not overlap the next scene"]
    }
];

function asMarkdown(guide: Omit<StyleGuide, "content">): string {
    return [
        "---",
        `name: ${guide.name}`,
        `mood: ${guide.mood}`,
        `palette_roles: ${guide.paletteRoles.join(", ")}`,
        `type: ${guide.type}`,
        `easing: ${guide.easing}`,
        `durations: ${guide.durations}`,
        "---",
        "",
        `# ${guide.name}`,
        "",
        `Mood: ${guide.mood}. This guide describes intent and timing. Write a composition that seeks to any time t and renders the same frame every time.`,
        "",
        "## Do",
        ...guide.do.map((line) => `- ${line}`),
        "",
        "## Do not",
        ...guide.dont.map((line) => `- ${line}`),
        "",
        "## Timing",
        `${guide.durations}. Easing: ${guide.easing}.`,
        ""
    ].join("\n");
}

/** All starter guides, each with its own Markdown body. */
export const StyleGuides: StyleGuide[] = raw.map((guide) => ({ ...guide, content: asMarkdown(guide) }));

/** Finds a guide by id, case insensitively. */
export function styleById(id: string): StyleGuide | undefined {
    return StyleGuides.find((guide) => guide.id === id.toLowerCase());
}
