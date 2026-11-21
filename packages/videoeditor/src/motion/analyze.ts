import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { VideoErrors } from "../core/Errors";
import { probe } from "../ffmpeg/Capabilities";
import { requireTool, run, runBuffer } from "../ffmpeg/Runner";
import type { MotionBrief } from "./types";

/** Parsed showinfo line values used here. */
function showTimes(stderr: string, key: "pts_time" | "lavfi.scene_score"): number[] {
    const values: number[] = [];
    const pattern = new RegExp(`${key.replace(".", "\\.")}:([0-9.]+)`);

    for (const line of stderr.split(/\r?\n/)) {
        const match = line.match(pattern);

        if (match) {
            const value = Number(match[1]);
            if (Number.isFinite(value)) {
                values.push(value);
            }
        }
    }

    return values;
}

/** Runs scene detection at a threshold and returns cut times and scores. */
async function scenes(path: string, threshold: number): Promise<{ cuts: number[]; scores: number[] }> {
    const result = await run("ffmpeg", [
        "-hide_banner", "-i", path, "-vf",
        `select='gt(scene,${threshold})',showinfo`, "-an", "-f", "null", "-"
    ]);

    if (result.code !== 0) {
        throw VideoErrors.ffmpeg(`Scene detection failed: ${result.stderr.trim().slice(-400)}`);
    }

    return { cuts: showTimes(result.stderr, "pts_time"), scores: showTimes(result.stderr, "lavfi.scene_score") };
}

/** Quantizes rgb24 pixels into coarse hex buckets and returns the top colors. */
function paletteFrom(buffer: Buffer, top = 5): MotionBrief["palette"] {
    const counts = new Map<string, number>();
    const size = Math.min(buffer.length, 8 * 8 * 3);

    for (let index = 0; index + 2 < size; index += 3) {
        const r = Math.round(buffer[index]! / 32) * 32;
        const g = Math.round(buffer[index + 1]! / 32) * 32;
        const b = Math.round(buffer[index + 2]! / 32) * 32;
        const hex = `#${[r, g, b].map((value) => Math.min(255, value).toString(16).padStart(2, "0")).join("")}`;
        counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }

    const total = [...counts.values()].reduce((sum, value) => sum + value, 0) || 1;

    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, top)
        .map(([hex, count]) => ({ hex, share: Math.round((count / total) * 100) / 100 }));
}

/** Fraction of neighboring pixels with a strong luminance change. */
function edgeDensity(gray: Buffer): number {
    const side = 16;
    const limit = side * side;
    let edges = 0;
    let pairs = 0;

    for (let y = 0; y < side; y += 1) {
        for (let x = 1; x < side; x += 1) {
            const index = y * side + x;

            if (index >= limit || index - 1 >= gray.length || index >= gray.length) {
                continue;
            }
            pairs += 1;
            if (Math.abs(gray[index]! - gray[index - 1]!) > 45) {
                edges += 1;
            }
        }
    }

    return pairs > 0 ? Math.round((edges / pairs) * 100) / 100 : 0;
}

/** Extracts one PNG keyframe and two small raw samples at a time. */
async function sampleFrame(path: string, time: number, pngPath: string): Promise<{ palette: MotionBrief["palette"]; edges: number }> {
    await run("ffmpeg", [
        "-y", "-hide_banner", "-loglevel", "error", "-ss", String(time), "-i", path,
        "-frames:v", "1", pngPath
    ]);

    const color = await runBuffer("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-ss", String(time), "-i", path,
        "-frames:v", "1", "-vf", "scale=8:8", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"
    ]);
    const gray = await runBuffer("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-ss", String(time), "-i", path,
        "-frames:v", "1", "-vf", "scale=16:16", "-f", "rawvideo", "-pix_fmt", "gray", "-"
    ]);

    return {
        palette: color.code === 0 ? paletteFrom(color.stdout) : [],
        edges: gray.code === 0 ? edgeDensity(gray.stdout) : 0
    };
}

/** Writes a short brief markdown file from the measurements. */
function briefMarkdown(brief: MotionBrief): string {
    const shots = brief.cuts.length > 0
        ? brief.cuts.map((cut) => `- ${cut.at.toFixed(2)}s: shot ${cut.shot}, length ${cut.length.toFixed(2)}s`).join("\n")
        : "- No hard cuts detected";
    const palette = brief.palette.map((item) => `- ${item.hex}: ${Math.round(item.share * 100)}%`).join("\n");
    const textFrames = brief.textHeavy.length > 0
        ? brief.textHeavy.map((time) => `${time.toFixed(2)}s`).join(", ")
        : "none";

    return [
        "# Motion brief",
        "",
        `Source: ${brief.source}`,
        `${brief.width}x${brief.height} @ ${brief.fps} fps, ${brief.duration.toFixed(2)}s.`,
        "",
        "## Shot order and pacing",
        shots,
        "",
        `Motion intensity: ${brief.motionIntensity} changes per second at a low scene threshold.`,
        "",
        "## Dominant palette",
        palette,
        "",
        `Text-heavy frames (high edge density): ${textFrames}.`,
        "",
        "## Keyframes",
        ...brief.keyframes.map((path) => `- ${path}`),
        "",
        "Pick a style guide and write a deterministic composition. Keep the pacing, replace the content.",
        ""
    ].join("\n");
}

/**
 * Measures a reference video with ffmpeg and ffprobe. No AI model is called.
 *
 * @param path Source video
 * @param stateDir Request folder that receives keyframes and the brief
 * @returns Measured brief with paths to the artifacts
 */
export async function analyze(path: string, stateDir: string): Promise<MotionBrief> {
    await requireTool("ffmpeg");
    await requireTool("ffprobe");

    if (!existsSync(path)) {
        throw VideoErrors.input(`Reference video not found: ${path}`);
    }
    const caps = await probe(path);

    if (caps.kind !== "video" || !caps.duration || !caps.width || !caps.height) {
        throw VideoErrors.input(`Reference must be a readable video with dimensions: ${path}`);
    }

    const hard = await scenes(path, 0.3);
    const soft = await scenes(path, 0.08);
    const cuts = hard.cuts.map((at, index) => ({
        at,
        shot: index + 1,
        length: index === 0 ? at : at - (hard.cuts[index - 1] ?? 0)
    }));
    const motionIntensity = Math.round((soft.cuts.length / Math.max(1, caps.duration)) * 100) / 100;

    const outDir = join(stateDir, "motion", "analyze");
    mkdirSync(outDir, { recursive: true });
    const count = Math.min(6, Math.max(2, Math.round(caps.duration)));
    const keyframes: string[] = [];
    const palette = new Map<string, number>();
    const textHeavy: number[] = [];

    for (let index = 0; index < count; index += 1) {
        const time = ((index + 0.5) / count) * caps.duration;
        const png = join(outDir, `keyframe-${String(index).padStart(2, "0")}.png`);
        const sample = await sampleFrame(path, time, png);
        keyframes.push(png);

        for (const entry of sample.palette) {
            palette.set(entry.hex, (palette.get(entry.hex) ?? 0) + entry.share);
        }
        if (sample.edges > 0.12) {
            textHeavy.push(time);
        }
    }

    const totalShares = [...palette.values()].reduce((sum, value) => sum + value, 0) || 1;
    const brief: MotionBrief = {
        source: path,
        fps: caps.fps ? Number(caps.fps.split("/")[0]) / Number(caps.fps.split("/")[1] ?? 1) : 30,
        duration: caps.duration,
        width: caps.width,
        height: caps.height,
        cuts,
        motionIntensity,
        palette: [...palette.entries()]
            .sort((left, right) => right[1] - left[1])
            .slice(0, 6)
            .map(([hex, share]) => ({ hex, share: Math.round((share / totalShares) * 100) / 100 })),
        textHeavy,
        keyframes,
        markdownPath: join(outDir, "motion-brief.md")
    };
    writeFileSync(brief.markdownPath, briefMarkdown(brief), "utf8");
    return brief;
}
