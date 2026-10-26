import { ArtworkCategory, type OutputFormat } from "../core";

/**
 * Named output sizes used by templates, the studio, and export.
 */
export const OutputFormats: OutputFormat[] = [
    {
        id: "instagram-square",
        label: "Instagram square",
        short: "Square",
        width: 1080,
        height: 1080,
        category: ArtworkCategory.SOCIAL_CARD
    },
    {
        id: "instagram-portrait",
        label: "Instagram portrait",
        short: "Portrait",
        width: 1080,
        height: 1350,
        category: ArtworkCategory.SOCIAL_CARD
    },
    {
        id: "story",
        label: "Story / Reel cover",
        short: "Story",
        width: 1080,
        height: 1920,
        category: ArtworkCategory.THUMBNAIL
    },
    {
        id: "og-card",
        label: "Open Graph / X card",
        short: "OG card",
        width: 1200,
        height: 630,
        category: ArtworkCategory.ANNOUNCEMENT
    },
    {
        id: "cover-16x9",
        label: "Cover 16:9",
        short: "Cover",
        width: 1920,
        height: 1080,
        category: ArtworkCategory.COVER
    },
    {
        id: "cover-cinematic",
        label: "Cover cinematic",
        short: "Cinematic",
        width: 1920,
        height: 817,
        category: ArtworkCategory.COVER
    },
    {
        id: "slide-16x9",
        label: "Slide 16:9",
        short: "Slide",
        width: 1920,
        height: 1080,
        category: ArtworkCategory.SLIDE
    },
    {
        id: "infographic-portrait",
        label: "Infographic portrait",
        short: "Infographic",
        width: 1080,
        height: 1920,
        category: ArtworkCategory.INFOGRAPHIC
    },
    {
        id: "editorial-poster",
        label: "Editorial poster",
        short: "Poster",
        width: 1600,
        height: 2000,
        category: ArtworkCategory.EDITORIAL
    },
    {
        id: "data-landscape",
        label: "Data landscape",
        short: "Data",
        width: 1200,
        height: 800,
        category: ArtworkCategory.DATA_VIZ
    },
    {
        id: "coupon",
        label: "Coupon / ticket",
        short: "Coupon",
        width: 1080,
        height: 540,
        category: ArtworkCategory.COUPON
    },
    {
        id: "carousel-slide",
        label: "Carousel slide",
        short: "Carousel",
        width: 1080,
        height: 1080,
        category: ArtworkCategory.CAROUSEL
    }
];

/**
 * Format lookup helpers.
 */
export namespace Formats {
    /**
     * Finds a named format.
     *
     * @param id Format id
     * @returns Format or undefined
     */
    export function byId(id: string): OutputFormat | undefined {
        return OutputFormats.find((item) => item.id === id);
    }

    /**
     * Formats that match a category.
     *
     * @param category Artwork category
     * @returns Matching formats
     */
    export function forCategory(category: ArtworkCategory): OutputFormat[] {
        return OutputFormats.filter((item) => item.category === category);
    }

    /**
     * First format that matches a pixel size. Story (1080x1920) wins over infographic portrait.
     *
     * @param width Width in pixels
     * @param height Height in pixels
     * @returns Format or undefined
     */
    export function match(width: number, height: number): OutputFormat | undefined {
        return OutputFormats.find((item) => item.width === width && item.height === height);
    }

    /**
     * Short chip label, never empty.
     *
     * @param format Format
     * @returns Label
     */
    export function shortName(format: OutputFormat): string {
        return format.short || format.label || format.id;
    }

    /**
     * Default format for a category.
     *
     * @param category Artwork category
     * @returns Format
     */
    export function defaultFor(category?: ArtworkCategory): OutputFormat {
        if (category) {
            const match = forCategory(category)[0];

            if (match) {
                return match;
            }
        }

        return OutputFormats[0] as OutputFormat;
    }
}
