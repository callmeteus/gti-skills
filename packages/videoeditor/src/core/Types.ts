/** How a source is fitted into the canvas. */
export type FitMode = "cover" | "contain" | "fill";

/** Supported output containers. */
export type OutputFormat = "mp4" | "webm" | "gif" | "mov";

/** Render quality presets. */
export type Quality = "draft" | "final";

/** A text overlay drawn on one scene. */
export interface TextOverlay {
    value: string;
    /** drawtext x expression, relative to the canvas. */
    x?: string;
    /** drawtext y expression, relative to the canvas. */
    y?: string;
    fontSize?: number;
    fontColor?: string;
    /** Path to a .ttf or .otf file. Without it, the ffmpeg default font is used. */
    fontFile?: string;
    box?: boolean;
    boxColor?: string;
    /** Seconds into the scene when the overlay appears. */
    start?: number;
    /** Seconds into the scene when the overlay disappears. */
    end?: number;
}

/** One consecutive piece of the timeline. */
export interface Scene {
    id: string;
    /** Path to a video or image file, absolute or relative to the workspace. */
    source: string;
    /** Source in-point in seconds. Defaults to 0. */
    in?: number;
    /** Length of the scene in seconds on the timeline. */
    duration: number;
    fit?: FitMode;
    text?: TextOverlay[];
    fadeIn?: number;
    fadeOut?: number;
    /** Scene audio volume. 0 mutes it. Defaults to 1 when the source has audio. */
    volume?: number;
}

/** A motion graphics clip laid over the timeline at a fixed time. */
export interface MotionOverlay {
    id: string;
    source: string;
    /** Seconds from the start of the timeline. */
    at: number;
    duration: number;
    x?: string;
    y?: string;
    width?: number;
    height?: number;
}

/** A music or narration track laid over the whole timeline. */
export interface MusicTrack {
    id: string;
    source: string;
    in?: number;
    volume?: number;
    fadeIn?: number;
    fadeOut?: number;
}

/** Output settings for a render. */
export interface OutputOptions {
    format?: OutputFormat;
    quality?: Quality;
    /** Output frame rate. Defaults to the canvas frame rate. */
    fps?: number;
}

/** The editable timeline document. */
export interface TimelineSpec {
    version: 1;
    name?: string;
    canvas?: {
        width?: number;
        height?: number;
        fps?: number;
        background?: string;
    };
    scenes: Scene[];
    music?: MusicTrack[];
    overlays?: MotionOverlay[];
    output?: OutputOptions;
}

/** What ffprobe found for one source file. */
export interface SourceCapabilities {
    path: string;
    exists: boolean;
    kind: "video" | "image" | "audio" | "unknown";
    hasVideo: boolean;
    hasAudio: boolean;
    width?: number;
    height?: number;
    duration?: number;
    /** ffprobe r_frame_rate, for example "30/1" or "30000/1001". */
    fps?: string;
    videoCodec?: string;
    audioCodec?: string;
}

/** A deterministic ffmpeg invocation derived from a timeline. */
export interface EditPlan {
    spec: TimelineSpec;
    inputs: Array<{ index: number; path: string; loop: boolean }>;
    filterGraph: string;
    videoMap: string;
    audioMap: string | null;
    duration: number;
    width: number;
    height: number;
    fps: number;
    outputPath: string;
    command: string[];
    commandDisplay: string;
    warnings: string[];
}

/** Standard result envelope printed by every CLI command. */
export interface CommandResult {
    ok: boolean;
    command: string;
    summary: string;
    data?: Record<string, unknown>;
}

/** On-disk project record. */
export interface ProjectRecord {
    id: string;
    name: string;
    createdAt: string;
    workspace: string;
    phase: string;
    specPath: string;
    lastRender: string | null;
}

/** Description of where a command reads and writes state. */
export interface ProjectScope {
    workspace: string;
    root: string;
    stateDir: string;
    specPath: string;
    mediaDir: string;
    exportsDir: string;
    storage: "session" | "permanent";
    session: string;
    request: string;
}
