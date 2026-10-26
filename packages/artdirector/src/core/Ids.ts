import { randomBytes, randomUUID } from "node:crypto";

/**
 * Identifier and token helpers.
 */
export namespace Ids {
    /**
     * Creates a UUID v4 string.
     *
     * @returns UUID
     */
    export function uuid(): string {
        return randomUUID();
    }

    /**
     * Creates a short hex id for variants and live events.
     *
     * @param bytes Number of random bytes
     * @returns Hex string
     */
    export function short(bytes = 4): string {
        return randomBytes(bytes).toString("hex");
    }

    /**
     * Creates a bearer token for the local studio server.
     *
     * @returns Hex token
     */
    export function token(): string {
        return randomBytes(24).toString("hex");
    }

    /**
     * Creates a filesystem-safe slug from a title.
     *
     * @param value Raw title
     * @returns Kebab-case slug
     */
    export function slug(value: string): string {
        const trimmed = value
            .normalize("NFKD")
            .replace(/[^\w\s-]/g, "")
            .trim()
            .toLowerCase()
            .replace(/[\s_]+/g, "-")
            .replace(/-+/g, "-");

        return trimmed.slice(0, 48) || "piece";
    }
}
