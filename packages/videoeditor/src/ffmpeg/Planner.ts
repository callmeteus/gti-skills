import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";

import { Paths } from "../core/Paths";
import type { EditPlan, SourceCapabilities, TextOverlay, TimelineSpec } from "../core/Types";
import { VideoErrors } from "../core/Errors";
import { Defaults, assertValid, totalDuration } from "../session/Spec";
import { resolveSource } from "./Capabilities";

/**
 * Escapes a value used inside a single quoted ffmpeg filter option.
 * Colons need a backslash too, otherwise a Windows drive letter is read as an
 * option separator even inside quotes.
 */
function quote(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
}

/** Finite number or fallback. */
function num(value: number | undefined, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Rounds to three decimals so commands are stable and readable. */
function round(value: number): number {
    return Math.round(value * 1000) / 1000;
}

/** Quotes arguments containing whitespace for display only. */
export function formatCommand(args: string[]): string {
    return args.map((arg) => /\s/.test(arg) ? JSON.stringify(arg) : arg).join(" ");
}

/** Codec flags for each supported output format. */
function codecArgs(spec: TimelineSpec, fps: number): string[] {
    const format = spec.output?.format ?? "mp4";
    const quality = spec.output?.quality ?? "final";

    if (format === "gif") {
        return ["-c:v", "gif", "-r", String(fps), "-loop", "0"];
    }
    if (format === "webm") {
        return [
            "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", quality === "draft" ? "36" : "30",
            "-pix_fmt", "yuv420p", "-r", String(fps), "-c:a", "libopus", "-b:a", "128k"
        ];
    }
    return [
        "-c:v", "libx264", "-preset", quality === "draft" ? "veryfast" : "medium",
        "-crf", quality === "draft" ? "28" : "20", "-pix_fmt", "yuv420p", "-r", String(fps),
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"
    ];
}

/** Common system fonts, used when a spec does not name one. */
const FontCandidates = [
    "C:/Windows/Fonts/segoeui.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
];

/** First system font that exists, or undefined to let ffmpeg choose. */
function defaultFont(): string | undefined {
    return FontCandidates.find((path) => existsSync(path));
}

/** Filter pieces for one text overlay. */
function drawtextParts(overlay: TextOverlay, duration: number, workspace: string): string[] {
    const parts: string[] = [];
    const font = overlay.fontFile
        ? (isAbsolute(overlay.fontFile) ? overlay.fontFile : Paths.resolve(workspace, overlay.fontFile))
        : defaultFont();

    if (font) {
        parts.push(`fontfile='${quote(font)}'`);
    }
    parts.push(
        `text='${quote(overlay.value)}'`,
        `fontsize=${num(overlay.fontSize, Defaults.fontSize)}`,
        `fontcolor='${quote(overlay.fontColor ?? Defaults.fontColor)}'`,
        `x='${quote(overlay.x ?? "(w-text_w)/2")}'`,
        `y='${quote(overlay.y ?? "(h-text_h)/2")}'`,
        "expansion=none"
    );

    if (overlay.box) {
        parts.push("box=1", `boxcolor='${quote(overlay.boxColor ?? "black@0.5")}'`);
    }
    if (overlay.start !== undefined || overlay.end !== undefined) {
        parts.push(`enable='between(t,${round(num(overlay.start, 0))},${round(num(overlay.end, duration))})'`);
    }

    return parts;
}

/**
 * Turns a timeline into a deterministic ffmpeg command. Pure: it never runs
 * ffmpeg and never writes files. Capabilities come from `Capabilities.forSpec`.
 *
 * @param spec Timeline to render
 * @param capabilities ffprobe results keyed by absolute source path
 * @param outputPath Where ffmpeg should write the file
 * @param workspace User working directory, used for relative source paths
 * @param stateDir Request state folder, used for media and font paths
 * @returns Complete, inspectable edit plan
 */
export function build(
    spec: TimelineSpec,
    capabilities: Map<string, SourceCapabilities>,
    outputPath: string,
    workspace: string,
    stateDir: string
): EditPlan {
    assertValid(spec);

    const width = num(spec.canvas?.width, Defaults.width);
    const height = num(spec.canvas?.height, Defaults.height);
    const fps = num(spec.canvas?.fps, Defaults.fps);
    const background = spec.canvas?.background ?? Defaults.background;
    const outputFps = num(spec.output?.fps, fps);
    const total = totalDuration(spec);
    const warnings: string[] = [];
    const inputs: EditPlan["inputs"] = [];
    const filters: string[] = [];
    const sceneLabels: string[] = [];
    const audioSegments: string[] = [];

    spec.scenes.forEach((scene, index) => {
        const source = resolveSource(workspace, stateDir, scene.source);
        const caps = capabilities.get(source);

        if (!caps?.exists) {
            throw VideoErrors.input(`Scene ${index + 1} source does not exist: ${source}`);
        }
        if (caps.kind !== "video" && caps.kind !== "image") {
            throw VideoErrors.input(`Scene ${index + 1} source is not a video or image: ${source}`);
        }

        const inputIndex = inputs.length;
        inputs.push({ index: inputIndex, path: source, loop: caps.kind === "image" });
        const duration = scene.duration;
        const inPoint = caps.kind === "image" ? 0 : num(scene.in, 0);
        const trim = caps.kind === "image"
            ? `trim=duration=${round(duration)}`
            : `trim=start=${round(inPoint)}:duration=${round(duration)}`;

        let scale: string;

        if (scene.fit === "fill") {
            scale = `scale=${width}:${height}`;
        } else if (scene.fit === "contain") {
            scale = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:'${quote(background)}'`;
        } else {
            scale = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
        }

        filters.push(
            `[${inputIndex}:v]${trim},setpts=PTS-STARTPTS,${scale},fps=${fps},setsar=1,settb=AVTB[v${index}]`
        );
        let label = `[v${index}]`;

        (scene.text ?? []).forEach((overlay, overlayIndex) => {
            const parts = drawtextParts(overlay, duration, workspace).join(":");
            filters.push(`${label}drawtext=${parts}[v${index}_t${overlayIndex}]`);
            label = `[v${index}_t${overlayIndex}]`;
        });

        const fadeIn = num(scene.fadeIn, 0);
        const fadeOut = num(scene.fadeOut, 0);

        if (fadeIn > 0 || fadeOut > 0) {
            const fades: string[] = [];

            if (fadeIn > 0) {
                fades.push(`fade=t=in:st=0:d=${round(fadeIn)}`);
            }
            if (fadeOut > 0) {
                fades.push(`fade=t=out:st=${round(Math.max(0, duration - fadeOut))}:d=${round(fadeOut)}`);
            }
            filters.push(`${label}${fades.join(",")}[scene${index}]`);
            label = `[scene${index}]`;
        }

        sceneLabels.push(label);

        const volume = scene.volume === undefined ? 1 : scene.volume;

        if (caps.hasAudio && caps.kind === "video" && volume > 0) {
            filters.push(
                `[${inputIndex}:a]atrim=start=${round(inPoint)}:duration=${round(duration)},` +
                `asetpts=PTS-STARTPTS,volume=${volume}[a${index}]`
            );
            audioSegments.push(`[a${index}]`);
        } else if (caps.hasAudio && volume === 0) {
            warnings.push(`Scene ${index + 1} audio is muted.`);
        } else if (!caps.hasAudio && scene.volume === undefined) {
            warnings.push(`Scene ${index + 1} has no audio stream; the scene is silent.`);
        }
    });

    let videoMap: string;

    if (sceneLabels.length === 1) {
        videoMap = sceneLabels[0] ?? "[v0]";
    } else {
        filters.push(`${sceneLabels.join("")}concat=n=${sceneLabels.length}:v=1:a=0[vout]`);
        videoMap = "[vout]";
    }

    (spec.overlays ?? []).forEach((overlay, index) => {
        const source = resolveSource(workspace, stateDir, overlay.source);
        const caps = capabilities.get(source);

        if (!caps?.exists || caps.kind !== "video") {
            warnings.push(`Motion overlay ${index + 1} has no readable video stream and was skipped.`);
            return;
        }

        const inputIndex = inputs.length;
        inputs.push({ index: inputIndex, path: source, loop: false });
        const overlayWidth = num(overlay.width, width);
        const overlayHeight = num(overlay.height, height);
        filters.push(
            `[${inputIndex}:v]scale=${overlayWidth}:${overlayHeight},format=rgba,setpts=PTS-STARTPTS[mo${index}]`
        );
        const x = overlay.x ?? "(w-ow)/2";
        const y = overlay.y ?? "(h-oh)/2";
        filters.push(
            `${videoMap}[mo${index}]overlay=${quote(x)}:${quote(y)}:` +
            `enable='between(t,${round(overlay.at)},${round(overlay.at + overlay.duration)})'[mout${index}]`
        );
        videoMap = `[mout${index}]`;
    });

    let baseLabel: string | null = null;

    if (audioSegments.length === 1) {
        baseLabel = audioSegments[0] ?? null;
    } else if (audioSegments.length > 1) {
        filters.push(`${audioSegments.join("")}concat=n=${audioSegments.length}:v=0:a=1[abase]`);
        baseLabel = "[abase]";
    }

    const musicLabels: string[] = [];

    (spec.music ?? []).forEach((track, index) => {
        const source = resolveSource(workspace, stateDir, track.source);
        const caps = capabilities.get(source);

        if (!caps?.exists || !caps.hasAudio) {
            warnings.push(`Music track ${index + 1} has no audio stream and was skipped.`);
            return;
        }

        const inputIndex = inputs.length;
        inputs.push({ index: inputIndex, path: source, loop: false });
        const fadeIn = num(track.fadeIn, 0);
        const fadeOut = num(track.fadeOut, 0);
        const parts = [
            `atrim=start=${round(num(track.in, 0))}:duration=${round(total)}`,
            "asetpts=PTS-STARTPTS",
            `volume=${num(track.volume, 1)}`
        ];

        if (fadeIn > 0) {
            parts.push(`afade=t=in:st=0:d=${round(fadeIn)}`);
        }
        if (fadeOut > 0) {
            parts.push(`afade=t=out:st=${round(Math.max(0, total - fadeOut))}:d=${round(fadeOut)}`);
        }

        filters.push(`[${inputIndex}:a]${parts.join(",")}[m${index}]`);
        musicLabels.push(`[m${index}]`);
    });

    let musicLabel: string | null = null;

    if (musicLabels.length === 1) {
        musicLabel = musicLabels[0] ?? null;
    } else if (musicLabels.length > 1) {
        filters.push(`${musicLabels.join("")}amix=inputs=${musicLabels.length}:duration=first:dropout_transition=0[music]`);
        musicLabel = "[music]";
    }

    let audioMap: string | null = null;

    if (baseLabel && musicLabel) {
        filters.push(`${baseLabel}${musicLabel}amix=inputs=2:duration=first:dropout_transition=0[aout]`);
        audioMap = "[aout]";
    } else if (baseLabel) {
        audioMap = baseLabel;
    } else if (musicLabel) {
        audioMap = musicLabel;
    } else {
        warnings.push("No audio streams found; the render will be silent.");
    }

    if ((spec.output?.format ?? "mp4") === "gif" && audioMap) {
        audioMap = null;
        warnings.push("GIF output drops the audio track.");
    }

    const command = ["-y"];

    for (const input of inputs) {
        if (input.loop) {
            command.push("-loop", "1");
        }
        command.push("-i", input.path);
    }
    if (filters.length > 0) {
        command.push("-filter_complex", filters.join(";"));
    }
    command.push("-map", videoMap);
    if (audioMap) {
        command.push("-map", audioMap);
    } else {
        command.push("-an");
    }
    command.push(...codecArgs(spec, outputFps), "-t", String(round(total)), outputPath);

    return {
        spec,
        inputs,
        filterGraph: filters.join(";"),
        videoMap,
        audioMap,
        duration: total,
        width,
        height,
        fps: outputFps,
        outputPath,
        command,
        commandDisplay: formatCommand(command),
        warnings
    };
}
