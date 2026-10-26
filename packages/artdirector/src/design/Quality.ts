/**
 * Persistent quality standard adapted from Frontend Design.
 * This is applied by the skill, critique, and HTML generation - not documentation alone.
 */
export const QualityStandard = {
    name: "ArtDirector quality floor",

    must: [
        "Commit to one named visual direction and execute it throughout the piece.",
        "Typography must carry the voice: a distinct display face plus a refined body face. Never Inter, Roboto, Arial, or a system stack as the design.",
        "Hierarchy is built from scale, weight, spacing, and placement - not from extra boxes.",
        "Give the piece a hero (photo, object, or monumental word) and lock the type to it: letters behind or across the subject.",
        "Build at least three planes of depth (field, back graphic, hero, front type, finish) and finish with a texture layer such as grain or paper.",
        "Use the whole canvas. Bleed and crop with intent; empty fields must be deliberate breathing room, never leftover.",
        "Contrast must keep primary text readable against its actual background.",
        "Every decorative mark (grain, rule, sticker, glow) has to earn its place against the brief.",
        "Compositions are original. References set the level, never the layout: do not reproduce a reference's composition, copy, or brand.",
        "Do not default to a flat single-color card with centered text or a centered card on a gradient.",
        "Drawn objects are built on one grid with identical gaps; characters and mascots come from the brand or a licensed set, never freehand.",
        "Text clears the artboard edge by 56 px or bleeds past it on purpose. Never a near miss."
    ],

    never: [
        "Generative image APIs, diffusion models, or DALL-E / Midjourney substitutes.",
        "Purple-to-pink hero gradients on white as a default look.",
        "Repeating rounded-corner cards with identical drop shadows.",
        "Unmotivated glassmorphism, neon glow, or 3D pie charts.",
        "Cookie-cutter three-card rows when the content is a single idea.",
        "Claiming an edit succeeded before the HTML is written and re-rendered.",
        "Blur as a way to hide text. Use tape, a sticker, or question marks.",
        "A flat strip where the art ends early, or a hero floating above it."
    ],

    hierarchy: [
        "One dominant element. Everything else is supporting.",
        "Primary type should be readable at the export size without zooming.",
        "Labels, kicker, and meta sit at least two steps below the headline.",
        "Align to a real grid (columns, baseline, or modular) even when the layout looks loose."
    ],

    finishing: [
        "Lock the artboard to the exact export dimensions. Overflow is a defect.",
        "Load fonts before capture. Fallback stacks are not the design.",
        "Icons are Lucide, the bundled svg-defs symbols, or other licensed SVGs, optically aligned, not emoji.",
        "Photos come from the user or open licenses (CC0, public domain); record them in .artdirector/assets.json.",
        "Export only after audit. Automated checks do not prove subjective quality."
    ]
} as const;

/**
 * Short checklist returned by `critique` for the agent to act on.
 */
export const CritiquePrompts = [
    "Is the visual direction unmistakable at thumbnail size?",
    "Does the headline occupy a decisive scale, or is everything medium?",
    "Are the fonts a pairing with a point of view?",
    "What would you remove first if asked to distill?",
    "Does color serve emphasis, or is it applied evenly?",
    "Would this still work in one ink color?",
    "Is the composition original, or a rearranged template of cards?",
    "Are there at least three planes of depth and a texture layer, or does the field go flat?",
    "Could someone match this piece to one specific reference? If so, change the structure.",
    "Does any line of text nearly touch an edge, or does the art stop before the board does?",
    "Are drawn objects straight, on one grid, and grounded?"
] as const;
