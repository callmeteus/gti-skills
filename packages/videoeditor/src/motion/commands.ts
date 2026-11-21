import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import { check, compareCheck, recordStep, type Check } from "../core/Checks";
import { VideoErrors } from "../core/Errors";
import { Ids } from "../core/Ids";
import { Json } from "../core/Json";
import { Paths } from "../core/Paths";
import type { CommandResult, MotionOverlay, Scene, TimelineSpec } from "../core/Types";
import { probe } from "../ffmpeg/Capabilities";
import { requireTool } from "../ffmpeg/Runner";
import { ExportPresets, isPreset } from "../presets";
import { Project } from "../session";
import type { FeatureContext } from "../features";
import { analyze } from "./analyze";
import { readBrand, escapeHtml } from "./brand";
import { browserStatus, cleanupFrames, renderComposition } from "./renderer";
import { StyleGuides, styleById } from "./styles";
import { templateById, Templates, compose } from "./templates";

/** Motion state written to the request folder. */
interface MotionState {
    lastComposition: string | null;
    lastRender: string | null;
    renders: string[];
}

/** Where motion state lives. */
function motionPaths(ctx: FeatureContext): { dir: string; statePath: string } {
    const dir = join(ctx.scope.stateDir, "motion");
    return { dir, statePath: join(dir, "motion.json") };
}

/** Reads motion state, tolerating an empty request. */
function readState(ctx: FeatureContext): MotionState {
    const { statePath } = motionPaths(ctx);
    return Json.maybe<MotionState>(statePath) ?? { lastComposition: null, lastRender: null, renders: [] };
}

/** Appends motion state. */
function writeState(ctx: FeatureContext, state: MotionState): void {
    const { dir, statePath } = motionPaths(ctx);
    mkdirSync(dir, { recursive: true });
    Json.write(statePath, state);
}

/** Flag helpers. */
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

/** Records checks and returns a result. */
function done(ctx: FeatureContext, command: string, checks: Check[], inputs: string[], data: Record<string, unknown>, summary: string): CommandResult {
    recordStep(ctx.scope, command, checks, inputs, summary);
    return { ok: true, command, summary, data: { ...data, checks } };
}

/** Resolves a --size WxH flag or a platform preset. */
function canvas(ctx: FeatureContext): { width: number; height: number; fps: number; preset: string | null } {
    const presetName = str(ctx, "preset");
    let width = 1080;
    let height = 1920;
    let fps = 30;

    if (presetName) {
        if (!isPreset(presetName)) {
            throw VideoErrors.spec(`Unknown preset "${presetName}". Use reels, shorts, tiktok, or youtube.`);
        }
        const preset = ExportPresets[presetName];
        width = preset.width;
        height = preset.height;
        fps = preset.fps;
    }
    const size = str(ctx, "size");

    if (size) {
        const match = size.match(/^(\d+)x(\d+)$/i);

        if (!match) {
            throw VideoErrors.spec(`Invalid --size "${size}". Use WxH, for example 1080x1920.`);
        }
        width = Number(match[1]);
        height = Number(match[2]);
    }
    fps = num(ctx, "fps") ?? fps;
    return { width, height, fps, preset: presetName ?? null };
}

/** motion styles: list the starter style guides. */
export function motionStyles(ctx: FeatureContext): CommandResult {
    return done(ctx, "motion styles", [
        check("style guides", StyleGuides.length),
        check("format", "Motion.md with frontmatter")
    ], [], {
        styles: StyleGuides.map((guide) => ({
            id: guide.id, name: guide.name, mood: guide.mood,
            paletteRoles: guide.paletteRoles, type: guide.type,
            easing: guide.easing, durations: guide.durations
        }))
    }, `${StyleGuides.length} starter Motion.md guides.`);
}

/** motion new: write an editable composition from a template and brand kit. */
export function motionNew(ctx: FeatureContext): CommandResult {
    const id = str(ctx, "template");

    if (!id || !templateById(id)) {
        throw VideoErrors.spec(`motion new needs --template <id>. Use one of: ${Templates.map((item) => item.id).join(", ")}.`);
    }
    const brandPath = str(ctx, "brand");
    const brand = readBrand(brandPath);
    const dimensions = canvas(ctx);
    const compositionDir = join(motionPaths(ctx).dir, Ids.slug(id) || id, Ids.short());
    mkdirSync(compositionDir, { recursive: true });
    const html = compose(id, {
        TITLE: str(ctx, "title") ?? "Your title here",
        TEXT: str(ctx, "text") ?? "Write something short",
        ACCENT: str(ctx, "accent") ?? "Make it matter",
        LABEL: str(ctx, "label") ?? "CHAPTER 01",
        NUMBER: str(ctx, "number") ?? "42"
    }, brand, {
        width: dimensions.width,
        height: dimensions.height,
        duration: num(ctx, "duration") ?? 1,
        fps: dimensions.fps
    });
    const path = join(compositionDir, "composition.html");
    writeFileSync(path, html, "utf8");
    writeState(ctx, {
        ...readState(ctx),
        lastComposition: path
    });

    const checks = [
        check("template", id),
        check("brand", brand.name),
        check("canvas", `${dimensions.width}x${dimensions.height} @ ${dimensions.fps} fps`),
        check("seek contract", /window\.__seek/.test(html) ? "present" : "missing"),
        existsSync(path) ? check("composition", Paths.posix(path)) : failCheck("composition", path)
    ];
    return done(ctx, "motion new", checks, brandPath ? [resolve(ctx.workspace, brandPath)] : [], {
        path, template: id, brand: brand.name, canvas: dimensions
    }, `Wrote ${id} composition to ${path}.`);
}

/** Local fail helper avoids another import. */
function failCheck(name: string, path: string): Check {
    return { name, ok: false, measured: "missing", detail: `Expected ${path}` };
}

/** motion render: seek a composition and encode it with ffmpeg. */
export async function motionRender(ctx: FeatureContext): Promise<CommandResult> {
    await requireTool("ffmpeg");
    const state = readState(ctx);
    const value = str(ctx, "source") ?? str(ctx, "composition") ?? state.lastComposition;

    if (!value) {
        throw VideoErrors.spec("motion render needs --source <composition.html> or run motion new first.");
    }
    const composition = resolve(isAbsolute(value) ? value : join(ctx.workspace, value));

    if (!existsSync(composition)) {
        throw VideoErrors.input(`Composition not found: ${composition}`);
    }
    const dimensions = canvas(ctx);
    const duration = num(ctx, "duration") ?? 1;
    const extension = ctx.flags.alpha ? "webm" : "mp4";
    const named = str(ctx, "out");
    const output = named
        ? resolve(isAbsolute(named) ? named : join(ctx.workspace, named))
        : join(ctx.scope.exportsDir, `${Ids.slug(str(ctx, "template") ?? "motion")}-${Ids.short()}.${extension}`);
    mkdirSync(Paths.resolve(resolve(output, ".."), "."), { recursive: true });

    const render = await renderComposition({
        composition,
        output,
        fps: dimensions.fps,
        duration,
        width: dimensions.width,
        height: dimensions.height,
        alpha: Boolean(ctx.flags.alpha)
    });
    cleanupFrames(render.framesDir);
    writeState(ctx, {
        lastComposition: composition,
        lastRender: output,
        renders: [...state.renders, output].slice(-40)
    });

    const checks = [
        check("source", Paths.posix(composition)),
        compareCheck("size", `${dimensions.width}x${dimensions.height}`, `${render.width}x${render.height}`),
        compareCheck("fps", dimensions.fps, Math.round(render.fps * 100) / 100, { tolerance: 0.05 }),
        compareCheck("duration", Math.round(duration * 100) / 100, Math.round(render.duration * 100) / 100, { tolerance: 0.2 }),
        compareCheck("frame count", Math.round(duration * dimensions.fps), render.frames, { tolerance: 1 }),
        compareCheck("codec", ctx.flags.alpha ? "vp9" : "h264", render.codec),
        existsSync(output) ? check("output", Paths.posix(output)) : failCheck("output", output)
    ];
    return done(ctx, "motion render", checks, [composition], {
        path: output, width: render.width, height: render.height,
        fps: render.fps, duration: render.duration, frames: render.frames, codec: render.codec
    }, `Rendered ${render.width}x${render.height} motion at ${render.fps} fps, ${render.frames} frames.`);
}

/** motion analyze: measure a reference video without any model. */
export async function motionAnalyze(ctx: FeatureContext): Promise<CommandResult> {
    const value = str(ctx, "source");

    if (!value) {
        throw VideoErrors.spec("motion analyze needs --source <ref.mp4>.");
    }
    const path = resolve(isAbsolute(value) ? value : join(ctx.workspace, value));
    const brief = await analyze(path, ctx.scope.stateDir);

    const checks = [
        check("source", Paths.posix(path)),
        check("source size", `${brief.width}x${brief.height}`),
        check("cuts", brief.cuts.length),
        check("motion intensity", brief.motionIntensity),
        check("palette colors", brief.palette.length),
        check("keyframes", brief.keyframes.length),
        check("text-heavy frames", brief.textHeavy.length),
        existsSync(brief.markdownPath) ? check("brief", Paths.posix(brief.markdownPath)) : failCheck("brief", brief.markdownPath)
    ];
    return done(ctx, "motion analyze", checks, [path], {
        brief: brief.markdownPath, cuts: brief.cuts, palette: brief.palette,
        motionIntensity: brief.motionIntensity, textHeavy: brief.textHeavy,
        keyframes: brief.keyframes
    }, `Analyzed ${brief.cuts.length} cuts and ${brief.keyframes.length} keyframes into ${brief.markdownPath}.`);
}

/** motion add: add a rendered motion clip to the project timeline. */
export async function motionAdd(ctx: FeatureContext): Promise<CommandResult> {
    await requireTool("ffprobe");
    const state = readState(ctx);
    const value = str(ctx, "source") ?? state.lastRender;

    if (!value) {
        throw VideoErrors.spec("motion add needs --source <motion.mp4> or run motion render first.");
    }
    const path = resolve(isAbsolute(value) ? value : join(ctx.workspace, value));

    if (!existsSync(path)) {
        throw VideoErrors.input(`Motion clip not found: ${path}`);
    }
    const as = str(ctx, "as") ?? "clip";

    if (as !== "clip" && as !== "overlay") {
        throw VideoErrors.spec(`motion add --as must be clip or overlay, got "${as}".`);
    }
    const at = num(ctx, "at") ?? 0;
    const caps = await probe(path);
    const spec = Project.spec(ctx.scope);
    const duration = num(ctx, "duration") ?? caps.duration ?? 1;

    if (as === "clip") {
        const scene: Scene = {
            id: `motion-${Ids.short()}`,
            source: Paths.posix(path),
            in: 0,
            duration,
            fit: "contain",
            volume: 0
        };
        const updated: TimelineSpec = { ...spec, scenes: [...spec.scenes, scene] };
        Project.saveSpec(ctx.scope, updated);
        const checks = [
            check("mode", "clip"),
            check("size", `${caps.width}x${caps.height}`),
            check("duration", duration)
        ];
        return done(ctx, "motion add", checks, [path], { added: scene, scenes: updated.scenes.length }, `Added motion clip at the end of the timeline.`);
    }

    const overlay: MotionOverlay = {
        id: `motion-${Ids.short()}`,
        source: Paths.posix(path),
        at,
        duration,
        x: "(w-ow)/2",
        y: "(h-oh)/2"
    };
    const updated: TimelineSpec = { ...spec, overlays: [...(spec.overlays ?? []), overlay] };
    Project.saveSpec(ctx.scope, updated);
    const checks = [
        check("mode", "overlay"),
        check("at", at),
        check("duration", duration),
        existsSync(path) ? check("source", Paths.posix(path)) : failCheck("source", path)
    ];
    return done(ctx, "motion add", checks, [path], {
        added: overlay, overlays: updated.overlays?.length ?? 0
    }, `Added motion overlay at ${at}s for ${duration}s.`);
}

/** doctor additions: Playwright and Chromium. */
export async function motionDoctorChecks(): Promise<Check[]> {
    const status = await browserStatus();
    return [
        { name: "playwright", ok: status.playwright, measured: status.playwright ? "available" : "missing", detail: status.detail },
        { name: "chromium", ok: status.chromium, measured: status.chromium ? "available" : "missing", detail: status.detail }
    ];
}

/** Reads a style guide body for the skill docs and tests. */
export function styleMarkdown(id: string): string {
    const guide = styleById(id);

    if (!guide) {
        throw VideoErrors.spec(`Unknown style guide "${id}".`);
    }

    return guide.content;
}

/** Escapes a value in a brief note, kept for HTML contexts in docs. */
export const motionEscape = escapeHtml;
