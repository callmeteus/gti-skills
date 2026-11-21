import { existsSync } from "node:fs";
import { basename, extname, join } from "node:path";

import { Paths } from "../core/Paths";
import type { SourceCapabilities, TimelineSpec } from "../core/Types";
import { VideoErrors } from "../core/Errors";
import { run } from "./Runner";

const ImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff", ".gif"]);

/**
 * Resolves a spec source to a real file path. Relative paths are tried against
 * the workspace, the request folder, and its `media/` folder, in that order.
 *
 * @param workspace User working directory
 * @param stateDir Request state folder
 * @param source Source value from the spec
 * @returns Best existing path, or the workspace-relative fallback
 */
export function resolveSource(workspace: string, stateDir: string, source: string): string {
    const candidates = [
        Paths.resolve(workspace, source),
        Paths.resolve(stateDir, source),
        Paths.resolve(stateDir, join("media", source)),
        Paths.resolve(stateDir, join("media", basename(source)))
    ];
    return candidates.find((path) => existsSync(path)) ?? candidates[0] ?? source;
}

/** One ffprobe stream as used here. */
interface ProbeStream {
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
}

/** Parsed ffprobe JSON. */
interface ProbeOutput {
    streams?: ProbeStream[];
    format?: { duration?: string; format_name?: string };
}

/**
 * Reads stream information for a source with ffprobe.
 *
 * @param path Absolute path to a media file
 * @returns Capabilities used by the planner
 */
export async function probe(path: string): Promise<SourceCapabilities> {
    if (!existsSync(path)) {
        return { path, exists: false, kind: "unknown", hasVideo: false, hasAudio: false };
    }

    const result = await run("ffprobe", [
        "-v", "error",
        "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate:format=duration,format_name",
        "-of", "json",
        path
    ]);

    if (result.code !== 0) {
        throw VideoErrors.input(`ffprobe could not read ${path}: ${result.stderr.trim()}`);
    }

    let parsed: ProbeOutput;

    try {
        parsed = JSON.parse(result.stdout) as ProbeOutput;
    } catch {
        throw VideoErrors.input(`ffprobe returned invalid JSON for ${path}.`);
    }

    const streams = parsed.streams ?? [];
    const hasVideo = streams.some((stream) => stream.codec_type === "video");
    const hasAudio = streams.some((stream) => stream.codec_type === "audio");
    const video = streams.find((stream) => stream.codec_type === "video");
    const audio = streams.find((stream) => stream.codec_type === "audio");
    const formatName = parsed.format?.format_name ?? "";
    const isImage = ImageExtensions.has(extname(path).toLowerCase())
        || (hasVideo && !hasAudio && /image2|image_pipe/.test(formatName));
    const kind = isImage ? "image" : hasVideo ? "video" : hasAudio ? "audio" : "unknown";
    const rawDuration = Number(parsed.format?.duration);

    return {
        path,
        exists: true,
        kind,
        hasVideo,
        hasAudio,
        width: video?.width,
        height: video?.height,
        duration: Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : undefined,
        fps: video?.r_frame_rate,
        videoCodec: video?.codec_name,
        audioCodec: audio?.codec_name
    };
}

/**
 * Probes every source referenced by a timeline.
 *
 * @param spec Timeline
 * @param workspace User working directory
 * @param stateDir Request state folder
 * @returns Map of absolute path to capabilities
 */
export async function forSpec(
    spec: TimelineSpec,
    workspace: string,
    stateDir: string
): Promise<Map<string, SourceCapabilities>> {
    const sources = new Set<string>();

    for (const scene of spec.scenes) {
        sources.add(resolveSource(workspace, stateDir, scene.source));
    }
    for (const track of spec.music ?? []) {
        sources.add(resolveSource(workspace, stateDir, track.source));
    }

    const entries = await Promise.all([...sources].map(async (path) => [path, await probe(path)] as const));
    return new Map(entries);
}
