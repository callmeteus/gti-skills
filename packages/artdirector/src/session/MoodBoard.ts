import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

import { ArtErrors, Ids, JsonFile } from "../core";

/**
 * Kinds of mood board entries.
 */
export enum MoodKind {
    IMAGE = "image",
    COLOR = "color",
    NOTE = "note",
    VARIANT = "variant"
}

/**
 * One mood board entry. Shared by every art in the session.
 */
export interface MoodItem {
    id: string;
    kind: MoodKind;
    createdAt: string;
    /** Who added it: the agent through the CLI, or the user in the studio. */
    source: "agent" | "studio";
    caption?: string;
    /** Image file name inside the board's `files/` folder. */
    file?: string;
    /** Hex color. */
    color?: string;
    /** Note text. */
    text?: string;
    /** Pinned variant: its request and id. */
    requestId?: string;
    variantId?: string;
}

const ImageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"];
const MaxImageBytes = 15 * 1024 * 1024;

/**
 * Reference board stored at `<studio state>/moodboard/`: `board.json` plus copied images.
 */
export class MoodBoard {
    /**
     * @param dir Mood board folder
     */
    constructor(readonly dir: string) {}

    /**
     * @returns Entries in the order they were added
     */
    items(): MoodItem[] {
        const file = join(this.dir, "board.json");

        if (!existsSync(file)) {
            return [];
        }

        try {
            return JsonFile.read<MoodItem[]>(file);
        } catch {
            return [];
        }
    }

    /**
     * Copies a local image into the board.
     *
     * @param source Absolute image path
     * @param from Who added it
     * @param caption Optional caption
     * @returns Entry
     */
    addImageFile(source: string, from: MoodItem["source"], caption?: string): MoodItem {
        if (!existsSync(source)) {
            throw ArtErrors.notFound(`Image not found: ${source}`);
        }

        const ext = imageExtension(source);
        const id = Ids.short();
        mkdirSync(this.filesDir(), { recursive: true });
        copyFileSync(source, join(this.filesDir(), `${id}${ext}`));
        return this.push({ id, kind: MoodKind.IMAGE, file: `${id}${ext}`, caption, source: from });
    }

    /**
     * Stores an uploaded image.
     *
     * @param name Original file name, used for the extension
     * @param data Image bytes
     * @param from Who added it
     * @param caption Optional caption
     * @returns Entry
     */
    addImageData(name: string, data: Buffer, from: MoodItem["source"], caption?: string): MoodItem {
        if (data.length === 0 || data.length > MaxImageBytes) {
            throw ArtErrors.project("Mood board images must be between 1 byte and 15 MB.");
        }

        const ext = imageExtension(name);
        const id = Ids.short();
        mkdirSync(this.filesDir(), { recursive: true });
        writeFileSync(join(this.filesDir(), `${id}${ext}`), data);
        return this.push({ id, kind: MoodKind.IMAGE, file: `${id}${ext}`, caption, source: from });
    }

    /**
     * @param color Hex color such as `#c23b22`
     * @param from Who added it
     * @param caption Optional caption
     * @returns Entry
     */
    addColor(color: string, from: MoodItem["source"], caption?: string): MoodItem {
        const value = color.trim();

        if (!/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) {
            throw ArtErrors.project(`Not a hex color: ${color}`);
        }

        return this.push({ id: Ids.short(), kind: MoodKind.COLOR, color: value.toLowerCase(), caption, source: from });
    }

    /**
     * @param text Note text
     * @param from Who added it
     * @returns Entry
     */
    addNote(text: string, from: MoodItem["source"]): MoodItem {
        const value = text.trim();

        if (!value) {
            throw ArtErrors.project("A mood board note needs text.");
        }

        return this.push({ id: Ids.short(), kind: MoodKind.NOTE, text: value, source: from });
    }

    /**
     * Pins a variant from any art in the session.
     *
     * @param requestId Request id, absent for a repository project
     * @param variantId Variant id
     * @param from Who added it
     * @param caption Optional caption
     * @returns Entry, or the existing pin
     */
    addVariant(requestId: string | undefined, variantId: string, from: MoodItem["source"], caption?: string): MoodItem {
        const existing = this.items().find((item) =>
            item.kind === MoodKind.VARIANT && item.variantId === variantId && item.requestId === requestId);

        if (existing) {
            return existing;
        }

        return this.push({ id: Ids.short(), kind: MoodKind.VARIANT, requestId, variantId, caption, source: from });
    }

    /**
     * Removes an entry and its image file.
     *
     * @param id Entry id
     * @returns Removed entry
     */
    remove(id: string): MoodItem {
        const items = this.items();
        const item = items.find((entry) => entry.id === id);

        if (!item) {
            throw ArtErrors.notFound(`Mood board entry not found: ${id}`);
        }

        if (item.file) {
            rmSync(join(this.filesDir(), item.file), { force: true });
        }

        this.write(items.filter((entry) => entry.id !== id));
        return item;
    }

    /**
     * @param id Entry id
     * @returns Absolute image path for an image entry
     */
    imagePath(id: string): string {
        const item = this.items().find((entry) => entry.id === id && entry.file);

        if (!item?.file) {
            throw ArtErrors.notFound(`Mood board image not found: ${id}`);
        }

        return join(this.filesDir(), item.file);
    }

    /**
     * @returns Folder for copied images
     */
    filesDir(): string {
        return join(this.dir, "files");
    }

    /**
     * @param entry Entry without a timestamp
     * @returns Stored entry
     */
    private push(entry: Omit<MoodItem, "createdAt">): MoodItem {
        const item: MoodItem = { ...entry, createdAt: new Date().toISOString() };

        if (!item.caption?.trim()) {
            delete item.caption;
        }

        this.write([...this.items(), item]);
        return item;
    }

    /**
     * @param items Entries
     */
    private write(items: MoodItem[]): void {
        mkdirSync(this.dir, { recursive: true });
        JsonFile.write(join(this.dir, "board.json"), items);
    }
}

/**
 * @param name File name or path
 * @returns Lowercase image extension
 */
function imageExtension(name: string): string {
    const ext = extname(name).toLowerCase();

    if (!ImageExtensions.includes(ext)) {
        throw ArtErrors.project(`Mood board images must be ${ImageExtensions.join(", ")}.`);
    }

    return ext;
}
