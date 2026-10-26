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
        "Whitespace is a material. Empty fields must be intentional, not leftover.",
        "Contrast must keep primary text readable against its actual background.",
        "Every decorative mark (grain, rule, sticker, glow) has to earn its place against the brief.",
        "Compositions are original. Do not default to a centered card on a gradient."
    ],

    never: [
        "Generative image APIs, diffusion models, or DALL-E / Midjourney substitutes.",
        "Purple-to-pink hero gradients on white as a default look.",
        "Repeating rounded-corner cards with identical drop shadows.",
        "Unmotivated glassmorphism, neon glow, or 3D pie charts.",
        "Cookie-cutter three-card rows when the content is a single idea.",
        "Claiming an edit succeeded before the HTML is written and re-rendered."
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
        "Icons are Lucide or other licensed SVGs, optically aligned, not emoji.",
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
    "Is the composition original, or a rearranged template of cards?"
] as const;
