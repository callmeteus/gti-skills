import { VideoErrors } from "../core/Errors";
import { Ids } from "../core/Ids";
import type { MusicTrack, Scene, TimelineSpec } from "../core/Types";

/** Default canvas and output used by `init` and by the starter template. */
export const Defaults = {
    width: 1920,
    height: 1080,
    fps: 30,
    background: "black",
    duration: 5,
    fontSize: 72,
    fontColor: "white"
} as const;

/**
 * Creates a new, empty timeline document.
 *
 * @param name Project name
 * @returns Timeline ready to edit
 */
export function defaultSpec(name = "untitled"): TimelineSpec {
    return {
        version: 1,
        name,
        canvas: {
            width: Defaults.width,
            height: Defaults.height,
            fps: Defaults.fps,
            background: Defaults.background
        },
        scenes: [],
        music: [],
        overlays: [],
        output: {
            format: "mp4",
            quality: "final"
        }
    };
}

/**
 * Sum of scene durations on the timeline.
 *
 * @param spec Timeline
 * @returns Total seconds
 */
export function totalDuration(spec: TimelineSpec): number {
    return spec.scenes.reduce((sum, scene) => sum + scene.duration, 0);
}

/**
 * Checks a timeline for the mistakes that produce broken ffmpeg commands.
 *
 * @param spec Timeline to check
 * @returns Human readable problems, empty when the spec is valid
 */
export function validate(spec: TimelineSpec): string[] {
    const errors: string[] = [];

    if (spec.version !== 1) {
        errors.push(`Unsupported spec version ${String(spec.version)}. Use version 1.`);
    }

    if (!Array.isArray(spec.scenes) || spec.scenes.length === 0) {
        errors.push("The timeline has no scenes. Add one with `scene add`.");
        return errors;
    }

    const ids = new Set<string>();

    spec.scenes.forEach((scene, index) => {
        if (!scene.id || ids.has(scene.id)) {
            errors.push(`Scene ${index + 1} needs a unique id.`);
        }
        ids.add(scene.id);

        if (!scene.source?.trim()) {
            errors.push(`Scene ${index + 1} has no source.`);
        }

        if (!Number.isFinite(scene.duration) || scene.duration <= 0) {
            errors.push(`Scene ${index + 1} needs a duration greater than 0.`);
        }

        if (scene.in !== undefined && (!Number.isFinite(scene.in) || scene.in < 0)) {
            errors.push(`Scene ${index + 1} has a negative in-point.`);
        }

        if (scene.fit && !["cover", "contain", "fill"].includes(scene.fit)) {
            errors.push(`Scene ${index + 1} has an unknown fit "${scene.fit}". Use cover, contain, or fill.`);
        }

        for (const overlay of scene.text ?? []) {
            if (!overlay.value?.trim()) {
                errors.push(`Scene ${index + 1} has an empty text overlay.`);
            }
        }
    });

    const canvas = spec.canvas ?? {};

    for (const key of ["width", "height", "fps"] as const) {
        const value = canvas[key];

        if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
            errors.push(`canvas.${key} must be greater than 0.`);
        }
    }

    for (const track of spec.music ?? []) {
        if (!track.source?.trim()) {
            errors.push(`Music track ${track.id || "?"} has no source.`);
        }
    }

    for (const overlay of spec.overlays ?? []) {
        if (!overlay.source?.trim()) {
            errors.push(`Motion overlay ${overlay.id || "?"} has no source.`);
        }
        if (!Number.isFinite(overlay.at) || overlay.at < 0) {
            errors.push(`Motion overlay ${overlay.id || "?"} needs a non-negative at time.`);
        }
        if (!Number.isFinite(overlay.duration) || overlay.duration <= 0) {
            errors.push(`Motion overlay ${overlay.id || "?"} needs a duration greater than 0.`);
        }
    }

    return errors;
}

/**
 * Throws a typed error when the spec cannot be rendered.
 *
 * @param spec Timeline to check
 */
export function assertValid(spec: TimelineSpec): void {
    const errors = validate(spec);

    if (errors.length > 0) {
        throw VideoErrors.spec(errors.join(" "));
    }
}

/** Flags accepted by the `scene add` command. */
export interface SceneInput {
    source: string;
    duration: number;
    in?: number;
    fit?: Scene["fit"];
    text?: string;
    fontSize?: number;
    fontColor?: string;
    fontFile?: string;
    fadeIn?: number;
    fadeOut?: number;
    volume?: number;
}

/**
 * Appends a scene and returns it. Does not mutate the input spec.
 *
 * @param spec Timeline to extend
 * @param input Scene flags
 * @returns Updated timeline
 */
export function addScene(spec: TimelineSpec, input: SceneInput): TimelineSpec {
    const scene: Scene = {
        id: `scene-${Ids.short()}`,
        source: input.source,
        duration: input.duration
    };

    if (input.in !== undefined) {
        scene.in = input.in;
    }
    if (input.fit) {
        scene.fit = input.fit;
    }
    if (input.fadeIn !== undefined) {
        scene.fadeIn = input.fadeIn;
    }
    if (input.fadeOut !== undefined) {
        scene.fadeOut = input.fadeOut;
    }
    if (input.volume !== undefined) {
        scene.volume = input.volume;
    }
    if (input.text) {
        scene.text = [{
            value: input.text,
            fontSize: input.fontSize ?? Defaults.fontSize,
            fontColor: input.fontColor ?? Defaults.fontColor,
            fontFile: input.fontFile
        }];
    }

    return { ...spec, scenes: [...spec.scenes, scene] };
}

/** Flags accepted by the `music add` command. */
export interface MusicInput {
    source: string;
    in?: number;
    volume?: number;
    fadeIn?: number;
    fadeOut?: number;
}

/**
 * Appends a music track and returns the updated timeline.
 *
 * @param spec Timeline to extend
 * @param input Music flags
 * @returns Updated timeline
 */
export function addMusic(spec: TimelineSpec, input: MusicInput): TimelineSpec {
    const track: MusicTrack = {
        id: `music-${Ids.short()}`,
        source: input.source
    };

    if (input.in !== undefined) {
        track.in = input.in;
    }
    if (input.volume !== undefined) {
        track.volume = input.volume;
    }
    if (input.fadeIn !== undefined) {
        track.fadeIn = input.fadeIn;
    }
    if (input.fadeOut !== undefined) {
        track.fadeOut = input.fadeOut;
    }

    return { ...spec, music: [...(spec.music ?? []), track] };
}
