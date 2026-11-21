import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import {
    aspectOf, check, compareCheck, fail, fpsNumber, recordStep, readSteps, collectInputs,
    sizeOf, type Check
} from "../core/Checks";
import { VideoErrors } from "../core/Errors";
import { GtiHome } from "../core/GtiHome";
import { Ids } from "../core/Ids";
import { Json } from "../core/Json";
import { Paths } from "../core/Paths";
import type { CommandResult, ProjectScope, Scene, TimelineSpec } from "../core/Types";
import { detectTranscribers, importSubtitles, transcribe, writeAss } from "../captions";
import { probe, resolveSource } from "../ffmpeg/Capabilities";
import { atempoChain, avDurations, detectSilence, keepRanges, normalizeLoudness, round, tail } from "../ffmpeg/Measure";
import { requireTool, run, toolsAvailable } from "../ffmpeg/Runner";
import { requireInput } from "../input";
import { motionDoctorChecks } from "../motion";
import { ExportPresets, isPreset, type ExportPreset } from "../presets";
import { renderReviewHtml, type ReviewData } from "../review";
import { Project, type ProjectRef } from "../session";
import { Tools } from "../tools";

/** Everything a feature command needs. */
export interface FeatureContext {
    ref: ProjectRef;
    workspace: string;
    flags: Record<string, string | boolean>;
    scope: ProjectScope;
}

/** Scope fallback so standalone commands can still record checks. */
export function featureScope(ref: ProjectRef, workspace: string): ProjectScope {
    try {
        return Project.open(ref).scope;
    } catch {
        const base = join(GtiHome.rootForSkill(), "scratch", GtiHome.workspaceKey(workspace));
        mkdirSync(base, { recursive: true });
        return {
            workspace,
            root: workspace,
            stateDir: base,
            specPath: join(base, "timeline.json"),
            mediaDir: join(base, "media"),
            exportsDir: join(base, "exports"),
            storage: "session",
            session: Project.sessionFromEnv(ref.session),
            request: "scratch"
        };
    }
}

/** Flag helpers local to this module. */
const str = (ctx: FeatureContext, name: string): string | undefined => {
    const value = ctx.flags[name];
    return typeof value === "string" ? value : undefined;
};
const num = (ctx: FeatureContext, name: string): number | undefined => {
    const value = str(ctx, name);

    if (value === undefined || value.trim() === "") {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

/** Resolves a source against the workspace or request, then refuses bad files. */
function source(ctx: FeatureContext, name = "source"): string {
    const value = str(ctx, name);

    if (!value) {
        throw VideoErrors.spec(`${name} is required. Pass --${name} <path>.`);
    }
    const path = resolveSource(ctx.workspace, ctx.scope.stateDir, value);
    requireInput(path, "any");
    return path;
}

/** Destination path, honoring --out only when the user named one. */
function output(ctx: FeatureContext, command: string, extension: string): string {
    const named = str(ctx, "out");
    const base = named
        ? resolve(isAbsolute(named) ? named : join(ctx.workspace, named))
        : join(ctx.scope.exportsDir, `${Ids.slug(command)}-${Ids.short()}.${extension}`);
    mkdirSync(Paths.resolve(resolve(base, ".."), "."), { recursive: true });
    return base;
}

/** Records checks and returns the result data. */
function done(ctx: FeatureContext, command: string, checks: Check[], inputs: string[], data: Record<string, unknown>, summary: string, ok = true): CommandResult {
    recordStep(ctx.scope, command, checks, inputs, summary);
    return { ok, command, summary, data: { ...data, checks } };
}

/** Output duration measured with ffprobe. */
async function duration(path: string): Promise<number> {
    const caps = await import("../ffmpeg/Capabilities").then((module) => module.probe(path));
    return caps.duration ?? 0;
}

/** Digits of a file for the review page. */
function fileCheck(name: string, path: string): Check {
    return existsSync(path) ? check(name, Paths.posix(path)) : fail(name, "missing", `Expected file at ${path}`);
}

/** doctor: detect external tools and filters. */
export async function doctor(ctx: FeatureContext): Promise<CommandResult> {
    const tools = await toolsAvailable();
    const transcribers = await detectTranscribers();
    const filters = await run("ffmpeg", ["-hide_banner", "-filters"]).catch(() => null);
    const filterOutput = filters?.stdout ?? "";
    const needed = ["silencedetect", "loudnorm", "ass", "showwavespic", "drawtext"];
    const checks: Check[] = [
        { name: "ffmpeg", ok: tools.ffmpeg, measured: tools.ffmpeg ? "available" : "missing" },
        { name: "ffprobe", ok: tools.ffprobe, measured: tools.ffprobe ? "available" : "missing" }
    ];

    for (const filter of needed) {
        checks.push({
            name: `filter:${filter}`,
            ok: filterOutput.includes(filter),
            measured: filterOutput.includes(filter) ? "available" : "missing"
        });
    }
    for (const tool of transcribers) {
        checks.push({ name: `transcriber:${tool.name}`, ok: tool.available, measured: tool.detail });
    }
    checks.push(...await motionDoctorChecks());
    const fontCandidates = [
        "C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    ];
    const font = fontCandidates.find((path) => existsSync(path));
    checks.push({ name: "font", ok: Boolean(font), measured: font ?? "no common system font found" });

    return done(ctx, "doctor", checks, [], {
        tools: { ...tools, transcribers: transcribers.filter((tool) => tool.available).map((tool) => tool.name) }
    }, `Doctor: ${checks.filter((item) => item.ok).length}/${checks.length} checks available.`);
}

/** tools: print the machine readable contract. */
export function tools(ctx: FeatureContext): CommandResult {
    return done(ctx, "tools", [check("tool count", Tools.length)], [], {
        tools: Tools,
        stabilityLevels: ["stable", "experimental"]
    }, `${Tools.length} tools in the contract.`);
}

/** cut: trim between two times and measure the result. */
export async function cut(ctx: FeatureContext): Promise<CommandResult> {
    await requireTool("ffmpeg");
    await requireTool("ffprobe");
    const path = source(ctx);
    const start = num(ctx, "start");
    const end = num(ctx, "end");

    if (start === undefined || end === undefined || end <= start || start < 0) {
        throw VideoErrors.spec("cut needs --start <sec> and --end <sec> with end greater than start.");
    }

    const target = output(ctx, "cut", "mp4");
    const result = await run("ffmpeg", [
        "-y", "-hide_banner", "-loglevel", "error", "-ss", String(start), "-t", String(round(end - start)),
        "-i", path, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", target
    ]);

    if (result.code !== 0) {
        throw VideoErrors.ffmpeg(`cut failed: ${tail(result.stderr)}`);
    }

    const actual = await probe(target);
    const measured = actual.duration ?? 0;
    const checks = [
        check("source", Paths.posix(path)),
        compareCheck("requested duration", round(end - start), round(measured), {
            tolerance: 0.35, detail: "ffprobe duration of the written file"
        }),
        compareCheck("output duration", round(end - start), round(measured), {
            tolerance: 0.35, detail: "expected length compared with ffprobe"
        }),
        compareCheck("duration delta", 0, round(Math.abs(measured - (end - start))), { tolerance: 0.35 }),
        compareCheck("codec", "h264", actual.videoCodec ?? "unknown"),
        fileCheck("output", target)
    ];

    return done(ctx, "cut", checks, [path], { path: target, start, end, duration: measured }, `Cut ${start}s to ${end}s into ${target}.`);
}

/** trim-silence: detect silence, remove it, and report the ranges. */
export async function trimSilence(ctx: FeatureContext): Promise<CommandResult> {
    await requireTool("ffmpeg");
    await requireTool("ffprobe");
    const path = source(ctx);
    const noise = num(ctx, "noise") ?? -40;
    const minimum = num(ctx, "min") ?? 0.2;
    const before = await duration(path);
    const ranges = await detectSilence(path, noise, minimum);

    if (ranges.length === 0) {
        const checks = [check("source", Paths.posix(path)), check("silence ranges", 0), check("duration", round(before))];
        return done(ctx, "trim-silence", checks, [path], { path: null, removed: [], duration: before }, "No silence found above the threshold; nothing to trim.");
    }

    const keep = keepRanges(before, ranges);
    const target = output(ctx, "trim-silence", "mp4");
    const filters: string[] = [];
    const maps: string[] = [];

    keep.forEach((range, index) => {
        filters.push(`[0:v]trim=start=${round(range.start)}:end=${round(range.end)},setpts=PTS-STARTPTS,fps=30,setsar=1,settb=AVTB[v${index}]`);
        filters.push(`[0:a]atrim=start=${round(range.start)}:end=${round(range.end)},asetpts=PTS-STARTPTS[a${index}]`);
        maps.push(`[v${index}][a${index}]`);
    });
    filters.push(`${maps.join("")}concat=n=${keep.length}:v=1:a=1[vout][aout]`);

    const result = await run("ffmpeg", [
        "-y", "-hide_banner", "-loglevel", "error", "-i", path,
        "-filter_complex", filters.join(";"), "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", target
    ]);

    if (result.code !== 0) {
        throw VideoErrors.ffmpeg(`trim-silence failed: ${tail(result.stderr)}`);
    }

    const after = await duration(target);
    const removed = round(ranges.reduce((sum, range) => sum + range.duration, 0));
    const checks = [
        check("source", Paths.posix(path)),
        check("threshold", `${noise}dB / ${minimum}s`),
        check("removed ranges", ranges.length, ranges.map((range) => `${range.start.toFixed(2)}-${range.end.toFixed(2)}`).join(", ")),
        check("removed seconds", removed),
        check("duration before", round(before)),
        check("duration after", round(after)),
        fileCheck("output", target)
    ];

    return done(ctx, "trim-silence", checks, [path], {
        path: target, removed: ranges, durationBefore: before, durationAfter: after
    }, `Removed ${ranges.length} silent range(s), ${removed}s total.`);
}

/** speed: change playback speed and warn outside the safe range. */
export async function speed(ctx: FeatureContext): Promise<CommandResult> {
    await requireTool("ffmpeg");
    await requireTool("ffprobe");
    const path = source(ctx);
    const rate = num(ctx, "rate");

    if (rate === undefined || rate <= 0) {
        throw VideoErrors.spec("speed needs --rate <positive number>.");
    }
    const before = await duration(path);
    const target = output(ctx, "speed", "mp4");
    const filters = [`[0:v]setpts=PTS/${rate},fps=30,setsar=1[v]`];
    const maps = ["[v]"];
    const av = await avDurations(path);

    if (av.audio !== null) {
        filters.push(`[0:a]${atempoChain(rate)}[a]`);
        maps.push("[a]");
    }

    const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", path, "-filter_complex", filters.join(";")];
    maps.forEach((map, index) => args.push("-map", map));
    args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p");
    if (av.audio !== null) {
        args.push("-c:a", "aac", "-b:a", "192k");
    } else {
        args.push("-an");
    }
    args.push("-movflags", "+faststart", target);
    const result = await run("ffmpeg", args);

    if (result.code !== 0) {
        throw VideoErrors.ffmpeg(`speed failed: ${tail(result.stderr)}`);
    }

    const after = await duration(target);
    const checks = [
        check("source", Paths.posix(path)),
        check("rate", rate),
        { name: "speed range", ok: rate >= 0.5 && rate <= 2, measured: rate, expected: "0.5x to 2x", detail: rate < 0.5 || rate > 2 ? "Outside the safe range; expect audio artifacts or heavy frame duplication." : undefined } as Check,
        check("duration before", round(before)),
        check("duration after", round(after)),
        check("measured ratio", before > 0 ? round(after / before) : 0),
        fileCheck("output", target)
    ];

    return done(ctx, "speed", checks, [path], { path: target, rate, durationBefore: before, durationAfter: after }, `Speed ${rate}x, ${round(before)}s to ${round(after)}s.`);
}

/** Crop geometry used by reframe and export. */
export function reframeGeometry(sourceWidth: number, sourceHeight: number, aspect: string) {
    const [aw, ah] = aspect.split(":").map(Number);

    if (!aw || !ah || !Number.isFinite(aw) || !Number.isFinite(ah)) {
        throw VideoErrors.spec(`Invalid aspect "${aspect}". Use W:H, for example 9:16.`);
    }
    const ratio = aw / ah;
    const even = (value: number): number => Math.max(2, Math.round(value / 2) * 2);

    let cropWidth: number;
    let cropHeight: number;

    if (sourceWidth / sourceHeight > ratio) {
        cropHeight = even(sourceHeight);
        cropWidth = even(sourceHeight * ratio);
    } else {
        cropWidth = even(sourceWidth);
        cropHeight = even(sourceWidth / ratio);
    }
    cropWidth = Math.min(cropWidth, even(sourceWidth));
    cropHeight = Math.min(cropHeight, even(sourceHeight));
    // Keep the short side at 1080 for portrait and square, the long side at
    // 1920 for landscape, then round to even so every preset is a real aspect.
    const outputWidth = ratio <= 1 ? 1080 : 1920;
    const outputHeight = even(ratio <= 1 ? 1080 / ratio : 1920 / ratio);
    const x = Math.floor((sourceWidth - cropWidth) / 2);
    const y = Math.floor((sourceHeight - cropHeight) / 2);
    const croppedPixels = Math.max(0, sourceWidth * sourceHeight - cropWidth * cropHeight);
    const croppedPercent = sourceWidth * sourceHeight > 0
        ? round((croppedPixels / (sourceWidth * sourceHeight)) * 100) : 0;

    return {
        source: { width: sourceWidth, height: sourceHeight },
        crop: { width: cropWidth, height: cropHeight, x, y },
        output: { width: outputWidth, height: outputHeight },
        croppedPixels,
        croppedPercent,
        placement: { x, y, width: cropWidth, height: cropHeight, anchor: "center" }
    };
}

/** reframe: crop to an aspect and report exactly what left the frame. */
export async function reframe(ctx: FeatureContext): Promise<CommandResult> {
    await requireTool("ffmpeg");
    await requireTool("ffprobe");
    const path = source(ctx);
    const presetName = str(ctx, "preset");
    const aspect = str(ctx, "aspect") ?? (presetName && isPreset(presetName) ? ExportPresets[presetName].aspect : undefined);

    if (!aspect) {
        throw VideoErrors.spec("reframe needs --aspect W:H or a --preset.");
    }
    const caps = await import("../ffmpeg/Capabilities").then((module) => module.probe(path));

    if (!caps.width || !caps.height) {
        throw VideoErrors.input(`Cannot read dimensions for ${path}.`);
    }
    const geometry = reframeGeometry(caps.width, caps.height, aspect);
    const target = output(ctx, "reframe", "mp4");
    const filter = `crop=${geometry.crop.width}:${geometry.crop.height}:${geometry.crop.x}:${geometry.crop.y},` +
        `scale=${geometry.output.width}:${geometry.output.height},fps=30,setsar=1`;
    const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", path, "-vf", filter,
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p"];
    if (caps.hasAudio) {
        args.push("-c:a", "aac", "-b:a", "192k");
    } else {
        args.push("-an");
    }
    args.push("-movflags", "+faststart", target);
    const result = await run("ffmpeg", args);

    if (result.code !== 0) {
        throw VideoErrors.ffmpeg(`reframe failed: ${tail(result.stderr)}`);
    }

    const actual = await probe(target);
    const [expectedWidth, expectedHeight] = aspect.split(":").map(Number);
    const expectedRatio = (expectedWidth ?? 1) / (expectedHeight ?? 1);
    const measuredRatio = aspectOf(actual);
    const checks = [
        check("source", `${caps.width}x${caps.height}`),
        check("aspect", aspect),
        check("crop box", `${geometry.crop.width}x${geometry.crop.height} at ${geometry.crop.x},${geometry.crop.y}`),
        check("cropped pixels", geometry.croppedPixels),
        check("cropped percent", geometry.croppedPercent),
        check("placement", `${geometry.placement.anchor} x=${geometry.placement.x} y=${geometry.placement.y}`),
        compareCheck("output size", `${geometry.output.width}x${geometry.output.height}`, sizeOf(actual), {
            detail: "ffprobe on the written file"
        }),
        compareCheck("output aspect", Math.round(expectedRatio * 10000) / 10000, Math.round(measuredRatio * 10000) / 10000, {
            tolerance: expectedRatio * 0.01,
            detail: "1% tolerance on the ffprobe size ratio"
        }),
        compareCheck("fps", 30, fpsNumber(actual.fps), { tolerance: 0.05 }),
        compareCheck("codec", "h264", actual.videoCodec ?? "unknown"),
        compareCheck("duration", round(caps.duration ?? 0), round(actual.duration ?? 0), { tolerance: 0.35 }),
        fileCheck("output", target)
    ];

    return done(ctx, "reframe", checks, [path], { path: target, aspect, ...geometry }, `Reframed to ${aspect}; removed ${geometry.croppedPercent}% of the frame.`);
}

/** loudness: two-pass loudnorm and audio/video duration delta. */
export async function loudness(ctx: FeatureContext): Promise<CommandResult> {
    await requireTool("ffmpeg");
    await requireTool("ffprobe");
    const path = source(ctx);
    const targetLufs = num(ctx, "target") ?? -14;
    const target = output(ctx, "loudness", "mp4");
    const result = await normalizeLoudness(path, target, targetLufs);
    const checks = [
        check("source", Paths.posix(path)),
        check("measured LUFS", round(result.measured.inputI)),
        check("target LUFS", targetLufs),
        check("true peak", round(result.measured.inputTP)),
        check("loudness range", round(result.measured.inputLRA)),
        check("A/V duration delta before", result.before.delta === null ? "n/a" : round(result.before.delta)),
        check("A/V duration delta after", result.after.delta === null ? "n/a" : round(result.after.delta)),
        fileCheck("output", target)
    ];

    return done(ctx, "loudness", checks, [path], {
        path: target, measuredLUFS: round(result.measured.inputI), targetLUFS: targetLufs,
        avDeltaBefore: result.before.delta, avDeltaAfter: result.after.delta
    }, `Loudness ${round(result.measured.inputI)} LUFS measured, normalized to ${targetLufs} LUFS.`);
}

/** export: apply a named platform preset. */
export async function exportPreset(ctx: FeatureContext): Promise<CommandResult> {
    await requireTool("ffmpeg");
    await requireTool("ffprobe");
    const path = source(ctx);
    const name = str(ctx, "preset");

    if (!name || !isPreset(name)) {
        throw VideoErrors.spec("export needs --preset reels|shorts|tiktok|youtube.");
    }
    const preset: ExportPreset = ExportPresets[name];
    const measuredTarget = output(ctx, `export-${name}-loudness`, "mp4");
    const normalized = await normalizeLoudness(path, measuredTarget, preset.loudnessTarget);
    const caps = await import("../ffmpeg/Capabilities").then((module) => module.probe(measuredTarget));

    if (!caps.width || !caps.height) {
        throw VideoErrors.input(`Cannot read dimensions of ${measuredTarget}.`);
    }
    const geometry = reframeGeometry(caps.width, caps.height, preset.aspect);
    const target = output(ctx, `export-${name}`, "mp4");
    const filter = `crop=${geometry.crop.width}:${geometry.crop.height}:${geometry.crop.x}:${geometry.crop.y},` +
        `scale=${preset.width}:${preset.height},fps=${preset.fps},setsar=1`;
    const result = await run("ffmpeg", [
        "-y", "-hide_banner", "-loglevel", "error", "-i", measuredTarget, "-vf", filter,
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", target
    ]);

    if (result.code !== 0) {
        throw VideoErrors.ffmpeg(`export failed: ${tail(result.stderr)}`);
    }
    Json.write(join(ctx.scope.stateDir, "preset.json"), preset);

    const actual = await probe(target);
    const [presetWidth, presetHeight] = preset.aspect.split(":").map(Number);
    const expectedRatio = (presetWidth ?? 1) / (presetHeight ?? 1);
    const checks = [
        check("preset", preset.name),
        compareCheck("size", `${preset.width}x${preset.height}`, sizeOf(actual), {
            detail: "ffprobe on the written file"
        }),
        compareCheck("aspect", Math.round(expectedRatio * 10000) / 10000, Math.round(aspectOf(actual) * 10000) / 10000, {
            tolerance: expectedRatio * 0.01,
            detail: "1% tolerance on the ffprobe size ratio"
        }),
        compareCheck("fps", preset.fps, fpsNumber(actual.fps), { tolerance: 0.05 }),
        compareCheck("codec", preset.codec, actual.videoCodec ?? "unknown"),
        compareCheck("audio codec", preset.audioCodec, actual.audioCodec ?? "unknown"),
        check("loudness target", `${preset.loudnessTarget} LUFS`),
        check("measured source LUFS", round(normalized.measured.inputI)),
        check("safe area bottom", `${Math.round(preset.safeBottom * 100)}%`),
        check("cropped percent", geometry.croppedPercent),
        compareCheck("duration", round(caps.duration ?? 0), round(actual.duration ?? 0), { tolerance: 0.35 }),
        fileCheck("output", target)
    ];

    return done(ctx, "export", checks, [path], {
        path: target, preset, measuredLUFS: round(normalized.measured.inputI), croppedPercent: geometry.croppedPercent
    }, `Exported ${preset.name}: ${preset.width}x${preset.height}, ${preset.fps} fps, ${preset.loudnessTarget} LUFS.`);
}

/** waveform: render a waveform PNG around a cut point. */
export async function waveform(ctx: FeatureContext): Promise<CommandResult> {
    await requireTool("ffmpeg");
    const path = source(ctx);
    const at = num(ctx, "at");
    const window = num(ctx, "window") ?? 2;

    if (at === undefined || at < 0) {
        throw VideoErrors.spec("waveform needs --at <seconds>.");
    }
    const target = output(ctx, "waveform", "png");
    const start = Math.max(0, at - window / 2);
    const result = await run("ffmpeg", [
        "-y", "-hide_banner", "-loglevel", "error", "-ss", String(start), "-t", String(window), "-i", path,
        "-filter_complex", "showwavespic=s=1200x320:split_channels=1", "-frames:v", "1", target
    ]);

    if (result.code !== 0) {
        throw VideoErrors.ffmpeg(`waveform failed: ${tail(result.stderr)}`);
    }
    const checks = [check("source", Paths.posix(path)), check("at", at), check("window", window), fileCheck("output", target)];
    return done(ctx, "waveform", checks, [path], { path: target, at, window }, `Waveform around ${at}s written to ${target}.`);
}

/** frame: extract one frame, or two side by side. */
export async function frame(ctx: FeatureContext): Promise<CommandResult> {
    await requireTool("ffmpeg");
    const path = source(ctx);
    const at = num(ctx, "at");
    const compare = num(ctx, "compare-at");

    if (at === undefined || at < 0) {
        throw VideoErrors.spec("frame needs --at <seconds>.");
    }
    const target = output(ctx, "frame", "png");
    const first = join(ctx.scope.stateDir, "frame-a.png");
    await run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(at), "-i", path, "-frames:v", "1", first]);

    if (compare === undefined) {
        writeFileSync(target, readFileSync(first));
        const checks = [check("source", Paths.posix(path)), check("at", at), fileCheck("output", target)];
        return done(ctx, "frame", checks, [path], { path: target, at }, `Frame at ${at}s written to ${target}.`);
    }

    const second = join(ctx.scope.stateDir, "frame-b.png");
    await run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(compare), "-i", path, "-frames:v", "1", second]);
    const result = await run("ffmpeg", [
        "-y", "-hide_banner", "-loglevel", "error", "-i", first, "-i", second,
        "-filter_complex", "[0:v][1:v]hstack=inputs=2", "-frames:v", "1", target
    ]);

    if (result.code !== 0) {
        throw VideoErrors.ffmpeg(`frame compare failed: ${tail(result.stderr)}`);
    }
    const checks = [check("source", Paths.posix(path)), check("at", at), check("compare at", compare), fileCheck("output", target)];
    return done(ctx, "frame", checks, [path], { path: target, at, compareAt: compare }, `Side by side frames at ${at}s and ${compare}s written to ${target}.`);
}

/** Escape a path used inside an ffmpeg filter option. */
function filterPath(path: string): string {
    return path.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
}

/** captions: import or transcribe, then burn styled ASS captions. */
export async function captions(ctx: FeatureContext): Promise<CommandResult> {
    await requireTool("ffmpeg");
    await requireTool("ffprobe");
    const path = source(ctx);
    const srtFlag = str(ctx, "srt") ?? str(ctx, "vtt");
    const language = str(ctx, "language");
    const styleName = str(ctx, "style") ?? "default";
    const presetName = str(ctx, "preset");
    const safeBottom = num(ctx, "safe") ?? (presetName && isPreset(presetName) ? ExportPresets[presetName].safeBottom : 0.15);
    const cues = srtFlag
        ? importSubtitles(resolve(isAbsolute(srtFlag) ? srtFlag : join(ctx.workspace, srtFlag)))
        : (await transcribe(path, ctx.scope.stateDir, language)).cues;

    if (cues.length === 0) {
        throw VideoErrors.input("No captions were produced from the subtitle file or transcription.");
    }
    const caps = await import("../ffmpeg/Capabilities").then((module) => module.probe(path));

    if (!caps.width || !caps.height) {
        throw VideoErrors.input(`Cannot read dimensions of ${path}.`);
    }
    const ass = writeAss(ctx.scope.stateDir, cues, caps.width, caps.height, styleName, safeBottom);
    const target = output(ctx, "captions", "mp4");
    const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", path,
        "-vf", `ass=filename='${filterPath(ass)}'`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p"];
    if (caps.hasAudio) {
        args.push("-c:a", "copy");
    } else {
        args.push("-an");
    }
    args.push("-movflags", "+faststart", target);
    const result = await run("ffmpeg", args);

    if (result.code !== 0) {
        throw VideoErrors.ffmpeg(`caption burn failed: ${tail(result.stderr)}`);
    }
    const timing = cues[0]?.timing ?? "estimated";
    Json.write(join(ctx.scope.stateDir, "captions.json"), {
        style: styleName, cueCount: cues.length, timing, language: language ?? "auto", safeBottom, cues
    });
    const actual = await probe(target);
    const checks = [
        check("source", Paths.posix(path)),
        check("caption source", srtFlag ? Paths.posix(srtFlag) : "transcription"),
        check("cues", cues.length),
        check("word timing", timing),
        check("style", styleName),
        check("safe area bottom", `${Math.round(safeBottom * 100)}%`),
        compareCheck("output size", sizeOf(caps), sizeOf(actual), {
            detail: "must match the source after burning"
        }),
        compareCheck("fps", fpsNumber(caps.fps), fpsNumber(actual.fps), { tolerance: 0.05 }),
        compareCheck("codec", "h264", actual.videoCodec ?? "unknown"),
        compareCheck("duration", round(caps.duration ?? 0), round(actual.duration ?? 0), { tolerance: 0.35 }),
        fileCheck("ass", ass),
        fileCheck("output", target)
    ];

    return done(ctx, "captions", checks, [path], {
        path: target, ass, cues: cues.length, timing, style: styleName
    }, `Burned ${cues.length} captions with style ${styleName}.`);
}

/** Collects inputs, checks, and timeline items for the review page. */
export function buildReviewData(scope: ProjectScope): ReviewData {
    const spec: TimelineSpec = existsSync(scope.specPath)
        ? Json.read<TimelineSpec>(scope.specPath)
        : { version: 1, scenes: [] };
    const captionData = Json.maybe<{ style: string; cueCount: number; timing: string }>(join(scope.stateDir, "captions.json"));
    const preset = Json.maybe<ExportPreset>(join(scope.stateDir, "preset.json"));
    const renders = existsSync(scope.exportsDir)
        ? readdirSync(scope.exportsDir).filter((name) => /\.(mp4|webm|mov|gif)$/i.test(name)).map((name) => join(scope.exportsDir, name)).sort()
        : [];

    return {
        title: `Video Editor review - ${spec.name ?? scope.request}`,
        request: scope.request,
        inputs: collectInputs(scope),
        steps: readSteps(scope),
        scenes: spec.scenes as Scene[],
        music: spec.music ?? [],
        renders,
        captions: captionData ? { style: captionData.style, cueCount: captionData.cueCount, timing: captionData.timing } : null,
        preset,
        motion: spec.overlays ?? []
    };
}

/** review: write a static HTML page with no server required. */
export function review(ctx: FeatureContext): CommandResult {
    const named = str(ctx, "out");
    const target = named
        ? resolve(isAbsolute(named) ? named : join(ctx.workspace, named))
        : join(ctx.scope.exportsDir, "review.html");
    mkdirSync(Paths.resolve(resolve(target, ".."), "."), { recursive: true });
    const data = buildReviewData(ctx.scope);
    writeFileSync(target, renderReviewHtml(data), "utf8");
    const checks = [
        check("inputs", data.inputs.length),
        check("steps", data.steps.length),
        check("renders", data.renders.length),
        check("sections", "inputs, checks, phone preview, timeline, notes")
    ];
    return done(ctx, "review", checks, data.inputs, {
        path: target, inputs: data.inputs.length, steps: data.steps.length
    }, `Static review written to ${target}.`);
}
