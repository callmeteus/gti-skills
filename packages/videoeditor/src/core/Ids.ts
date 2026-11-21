/**
 * Small id and slug helpers used for request folders.
 */
export const Ids = {
    /** Lowercase, hyphenated slug safe for folder names. */
    slug(value: string): string {
        return value
            .normalize("NFKD")
            .replace(/[^\w\s-]/g, "")
            .trim()
            .toLowerCase()
            .replace(/[\s_]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
    },

    /** Short time based id with a random suffix. */
    short(): string {
        const time = Date.now().toString(36);
        const random = Math.random().toString(36).slice(2, 8);
        return `${time}-${random}`;
    }
};
