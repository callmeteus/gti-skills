import { existsSync, openSync, closeSync, statSync } from "node:fs";
import { extname } from "node:path";

import { VideoErrors } from "../core/Errors";

/** Kinds of input the engine can accept before touching ffmpeg. */
export type InputKind = "video" | "image" | "audio" | "subtitle" | "any";

const VideoExtensions = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v", ".mpg", ".mpeg", ".ts"]);
const ImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"]);
const AudioExtensions = new Set([".mp3", ".wav", ".aac", ".m4a", ".flac", ".ogg", ".opus"]);
const SubtitleExtensions = new Set([".srt", ".vtt"]);

/** Result of the pre-flight check. */
export interface InputReport {
    path: string;
    ok: boolean;
    kind: InputKind;
    size: number;
    reason?: string;
}

/** Human readable list of accepted extensions. */
function accepted(kind: InputKind): string {
    if (kind === "any") {
        return "video, image, audio, or SRT/VTT subtitle files";
    }
    const set = kind === "video" ? VideoExtensions
        : kind === "image" ? ImageExtensions
            : kind === "audio" ? AudioExtensions
                : SubtitleExtensions;
    return [...set].join(", ");
}

/** Extension based kind, or undefined when unsupported. */
function extensionKind(path: string): Exclude<InputKind, "any"> | undefined {
    const ext = extname(path).toLowerCase();

    if (VideoExtensions.has(ext)) {
        return "video";
    }
    if (ImageExtensions.has(ext)) {
        return "image";
    }
    if (AudioExtensions.has(ext)) {
        return "audio";
    }
    if (SubtitleExtensions.has(ext)) {
        return "subtitle";
    }
    return undefined;
}

/**
 * Refuses unreadable, empty, and unsupported files before any external tool runs.
 *
 * @param path Absolute path to check
 * @param expected Expected media kind, or `any`
 * @returns Report with a reason when the file cannot be used
 */
export function validateInput(path: string, expected: InputKind = "any"): InputReport {
    const found = extensionKind(path);
    const report: InputReport = { path, ok: false, kind: found ?? expected, size: 0 };

    if (!existsSync(path)) {
        return { ...report, reason: `File does not exist: ${path}` };
    }

    try {
        const stats = statSync(path);
        report.size = stats.size;

        if (!stats.isFile()) {
            return { ...report, reason: `Not a regular file: ${path}` };
        }
        if (stats.size === 0) {
            return { ...report, reason: `File is empty (0 bytes): ${path}` };
        }
    } catch (error) {
        return { ...report, reason: `Cannot stat file: ${error instanceof Error ? error.message : String(error)}` };
    }

    try {
        const handle = openSync(path, "r");
        closeSync(handle);
    } catch (error) {
        return { ...report, reason: `File is not readable: ${error instanceof Error ? error.message : String(error)}` };
    }

    if (!found) {
        return { ...report, reason: `Unsupported file type "${extname(path) || "none"}". Expected ${accepted(expected)}.` };
    }
    if (expected !== "any" && found !== expected) {
        return { ...report, reason: `Expected ${expected} input but found ${found}: ${path}` };
    }

    return { ...report, ok: true, kind: found };
}

/** Throws a typed INPUT error with the reason when validation fails. */
export function requireInput(path: string, expected: InputKind = "any"): InputReport {
    const report = validateInput(path, expected);

    if (!report.ok) {
        throw VideoErrors.input(report.reason ?? `Cannot use ${path}.`);
    }

    return report;
}
