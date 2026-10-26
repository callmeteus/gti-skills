import { ArtworkCategory, type CreativeBrief } from "../core";
import { Formats } from "../design";

/**
 * Specialized composition guidance distilled from Claude HT Skills.
 * The engine picks one technique pack from the requested artifact - it does not load six competing skills.
 */
export interface TechniquePack {
    id: string;
    categories: ArtworkCategory[];
    layouts: string[];
    principles: string[];
    htmlNotes: string[];
    avoid: string[];
}

/**
 * Integrated technique library.
 */
export const TechniquePacks: TechniquePack[] = [
    {
        id: "infographic",
        categories: [ArtworkCategory.INFOGRAPHIC, ArtworkCategory.DATA_VIZ],
        layouts: [
            "linear-progression",
            "binary-comparison",
            "hub-spoke",
            "bento-modules",
            "funnel",
            "dashboard-metrics",
            "circular-flow",
            "dense-modules"
        ],
        principles: [
            "Preserve source numbers exactly. Do not round or rephrase statistics.",
            "One idea per module. Connectors must encode sequence, not decoration.",
            "Prefer numbered steps, comparison columns, and annotated diagrams over paragraphs.",
            "Use Lucide or geometric SVG marks as wayfinding, never emoji."
        ],
        htmlNotes: [
            "CSS Grid for modules; SVG for connectors, Venn, and flow paths.",
            "Tokenize colors, type scale, and module gap as custom properties.",
            "Lock the artboard. Infographic export is a poster, not a scrolling page."
        ],
        avoid: [
            "Glassmorphism as a default infographic skin.",
            "3D charts, exploded pies, isometric clip towns."
        ]
    },
    {
        id: "story",
        categories: [ArtworkCategory.THUMBNAIL],
        layouts: [
            "full-bleed-stack",
            "monumental-type",
            "top-claim-bottom-cta"
        ],
        principles: [
            "The 1080x1920 artboard is the phone screen. Fill the height. Do not drop a square poster in the middle with empty bands.",
            "Type must be huge and readable at arm's length: display 180-240px, supporting 36-48px, kicker 28-34px.",
            "Stack top to bottom. Keep critical type out of the top 210px and bottom 250px (platform chrome), and use everything between.",
            "One idea. Three to five blocks. If it looks like a feed post, the type is too small."
        ],
        htmlNotes: [
            "Lock .artboard to 1080x1920. display:flex; flex-direction:column; justify-content:space-between.",
            "Padding about 220px 64px 260px. Headline 180px or larger, line-height 0.82-0.9.",
            "data-layer on kicker, title, subtitle, brand, and CTA."
        ],
        avoid: [
            "Letterboxed square compositions.",
            "Centered cards with padding that wastes the vertical.",
            "Headlines under 140px.",
            "Feed-post layouts stretched into 9:16."
        ]
    },
    {
        id: "social-card",
        categories: [
            ArtworkCategory.SOCIAL_CARD,
            ArtworkCategory.CAROUSEL,
            ArtworkCategory.ANNOUNCEMENT
        ],
        layouts: [
            "sparse-claim",
            "balanced-kicker",
            "list-stack",
            "comparison-split",
            "quote-poster"
        ],
        principles: [
            "Readable at phone-thumbnail size. One claim, one supporting line.",
            "Safe margins for platform UI chrome.",
            "Carousel slides share tokens and a recurring kicker, not cloned layouts.",
            "Stories are not this pack. Use the story pack for 1080x1920."
        ],
        htmlNotes: [
            "Fixed square or 4:5 portrait artboard. Overflow hidden.",
            "Headline uses a display face; meta in small caps or mono."
        ],
        avoid: [
            "Watermarks and fake engagement bars.",
            "Tiny body copy that dies at 1080px.",
            "Putting a square post into a story frame."
        ]
    },
    {
        id: "cover",
        categories: [ArtworkCategory.COVER, ArtworkCategory.TYPOGRAPHY],
        layouts: [
            "hero-field",
            "conceptual-geometry",
            "typography-as-image",
            "minimal-accent",
            "metaphor-shape"
        ],
        principles: [
            "The cover is an image made of type and shape, not a screenshot of a layout.",
            "Title, not paragraph. Subtitle optional. Author/meta as a quiet colophon.",
            "Pick a rendering: flat vector, screen-print, chalk, or ink - then stay there."
        ],
        htmlNotes: [
            "Use clip-path, repeating-linear-gradient, and SVG grain instead of photos when none are licensed.",
            "Honor the requested aspect (16:9, 2.35:1, 1:1, 3:4)."
        ],
        avoid: [
            "Stock landscape behind white title cards.",
            "Centered gradient orbs as a metaphor for 'ideas'."
        ]
    },
    {
        id: "slides",
        categories: [ArtworkCategory.SLIDE],
        layouts: [
            "title-slide",
            "section-opener",
            "two-column-compare",
            "stat-break",
            "diagram-slide",
            "closing"
        ],
        principles: [
            "One thought per slide. If it needs a scroll, it is two slides.",
            "Shared master: type scale, margins, and a running footer.",
            "Speaker notes stay in HTML comments or `data-notes`, never on the artboard."
        ],
        htmlNotes: [
            "Each slide is a 1920x1080 artboard. Decks are multiple files or `#slide-n` sections.",
            "Keyboard navigation belongs in the preview, not in the exported PNG."
        ],
        avoid: [
            "Bullet walls.",
            "Default corporate blue templates."
        ]
    },
    {
        id: "editorial",
        categories: [ArtworkCategory.EDITORIAL, ArtworkCategory.ILLUSTRATION],
        layouts: [
            "magazine-opener",
            "pull-quote",
            "illustrated-diagram",
            "captioned-figure"
        ],
        principles: [
            "Type and illustration share a baseline. Captions are designed, not dumped.",
            "Illustration is geometric, typographic, or licensed photography - never generated pictures.",
            "Column measure stays readable. Do not set 90-character lines at poster size."
        ],
        htmlNotes: [
            "Use CSS columns or a modular grid. Drop caps only when they fit the direction.",
            "SVG scenes for article illustrations: flowchart, comparison, timeline, framework."
        ],
        avoid: [
            "Stock people silhouettes.",
            "Decorative drop shadows behind body text."
        ]
    },
    {
        id: "promotion",
        categories: [ArtworkCategory.PROMOTION, ArtworkCategory.COUPON],
        layouts: [
            "poster-claim",
            "ticket-stub",
            "price-callout",
            "date-stamp"
        ],
        principles: [
            "Offer, date, and action must be findable in under a second.",
            "Brand marks stay intact. Do not recolor a logo 'to match the vibe' unless asked.",
            "Coupons feel printed: perforations, serials, and stamps as CSS/SVG, not photos of paper."
        ],
        htmlNotes: [
            "Giant type for the offer. Fine print is still legible at export size.",
            "data-layer on offer, date, code, and CTA for template production."
        ],
        avoid: [
            "Fake urgency timers.",
            "QR codes that do not encode a real URL supplied by the user."
        ]
    }
];

/**
 * Technique selection.
 */
export namespace Techniques {
    /**
     * Picks the technique pack for a brief or category.
     *
     * @param input Category or brief
     * @returns Matching pack
     */
    export function forBrief(input?: ArtworkCategory | Pick<CreativeBrief, "category" | "formatId">): TechniquePack {
        const fromFormat = typeof input === "object" && input?.formatId
            ? Formats.byId(input.formatId)?.category
            : undefined;
        const category = fromFormat
            ?? (typeof input === "string" ? input : input?.category);

        if (category) {
            const match = TechniquePacks.find((pack) => pack.categories.includes(category));

            if (match) {
                return match;
            }
        }

        return TechniquePacks[0] as TechniquePack;
    }

    /**
     * Lists pack ids for the studio and CLI.
     *
     * @returns Pack summaries
     */
    export function list(): Array<{ id: string; categories: ArtworkCategory[] }> {
        return TechniquePacks.map((pack) => ({
            id: pack.id,
            categories: pack.categories
        }));
    }
}
