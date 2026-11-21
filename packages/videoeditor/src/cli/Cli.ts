import { execFile } from "node:child_process";
import * as fs from "node:fs";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import { check, recordStep } from "../core/Checks";
import { GtiHome } from "../core/GtiHome";
import { Json } from "../core/Json";
import { Ids } from "../core/Ids";
import { VideoErrors } from "../core/Errors";
import type { CommandResult, EditPlan, ProjectScope, TimelineSpec } from "../core/Types";
import {
    captions, cut, doctor, exportPreset, featureScope, frame, loudness, reframe,
    review, speed, tools, trimSilence, waveform
} from "../features";
import { forSpec, probe, resolveSource } from "../ffmpeg/Capabilities";
import { build } from "../ffmpeg/Planner";
import { requireTool, run, toolsAvailable } from "../ffmpeg/Runner";
import { requireInput } from "../input";
import { startStudio, stopStudio } from "../server/Studio";
import { Project, type ProjectRef } from "../session/Project";
import { addMusic, addScene, assertValid, defaultSpec, totalDuration, validate } from "../session/Spec";
import { helpText } from "./Help";
import { flagBool, flagNumber, flagString, parseArgv } from "./ParseFlags";

/**
 * Dispatches Video Editor CLI commands. Agents pass `--json`.
 *
 * @param argv Arguments after the binary name
 * @returns Command result
 */
export async function runCli(argv: string[]): Promise<CommandResult> {
    const parsed = parseArgv(argv);
    const json = flagBool(parsed.flags, "json") || process.env.VIDEOEDITOR_JSON === "1";
    const workspace = resolve(flagString(parsed.flags, "root") ?? process.cwd());
    const ref: ProjectRef = {
        workspace,
        session: flagString(parsed.flags, "session"),
        request: flagString(parsed.flags, "request"),
        permanent: flagBool(parsed.flags, "permanent") || process.env.VIDEOEDITOR_STORAGE === "repository"
    };
    const command = parsed.command;

    if (command === "help" || command === "--help" || command === "-h") {
        return finish({ ok: true, command: "help", summary: helpText() }, json);
    }

    if (command === "status" || command === "resume") {
        const tools = await toolsAvailable();
        let state: Record<string, unknown> = { active: false };

        try {
            const ctx = Project.open(ref);
            const spec = Project.spec(ctx.scope);
            state = {
                active: true,
                project: ctx.project,
                scope: ctx.scope,
                scenes: spec.scenes.length,
                duration: totalDuration(spec),
                renders: listRenders(ctx.scope)
            };
        } catch {
            state = { active: false, hint: "Run `videoeditor init` first." };
        }

        return finish({
            ok: true,
            command,
            summary: command === "status"
                ? `ffmpeg ${tools.ffmpeg ? "ready" : "missing"}, ffprobe ${tools.ffprobe ? "ready" : "missing"}.`
                : "Active request summary.",
            data: { tools, state, storage: ref.permanent ? "permanent" : "session" }
        }, json);
    }

    if (command === "init") {
        const result = Project.init(
            ref,
            flagString(parsed.flags, "name") ?? "untitled",
            flagBool(parsed.flags, "new")
        );

        return finish({
            ok: true,
            command: "init",
            summary: `${result.created ? "Initialized" : "Reused"} request ${result.scope.request} at ${result.scope.stateDir}`,
            data: {
                project: result.project,
                scope: result.scope,
                spec: result.spec,
                next: "Add a scene with `scene add --source <path> --duration <sec>`, then `plan --json`."
            }
        }, json);
    }

    if (command === "history") {
        return finish({
            ok: true,
            command: "history",
            summary: `${Project.history(ref).length} request(s)`,
            data: { requests: Project.history(ref) }
        }, json);
    }

    if (command === "demo") {
        return finish(await demo(parsed.flags, workspace), json);
    }

    const FeatureCommands = new Set([
        "doctor", "tools", "cut", "trim-silence", "speed", "reframe", "loudness",
        "export", "waveform", "frame", "captions", "review"
    ]);

    if (FeatureCommands.has(command)) {
        const ctx = { ref, workspace, flags: parsed.flags, scope: featureScope(ref, workspace) };

        switch (command) {
            case "doctor": return finish(await doctor(ctx), json);
            case "tools": return finish(tools(ctx), json);
            case "cut": return finish(await cut(ctx), json);
            case "trim-silence": return finish(await trimSilence(ctx), json);
            case "speed": return finish(await speed(ctx), json);
            case "reframe": return finish(await reframe(ctx), json);
            case "loudness": return finish(await loudness(ctx), json);
            case "export": return finish(await exportPreset(ctx), json);
            case "waveform": return finish(await waveform(ctx), json);
            case "frame": return finish(await frame(ctx), json);
            case "captions": return finish(await captions(ctx), json);
            case "review": return finish(review(ctx), json);
            default: throw VideoErrors.project(`Unknown feature command: ${command}.`);
        }
    }

    if (command === "studio") {
        if (parsed.rest[0] === "stop") {
            const closed = stopStudio();
            return finish({ ok: true, command: "studio stop", summary: `${closed} studio(s) stopped.`, data: { closed } }, json);
        }

        const ctx = Project.open(ref);
        const started = await startStudio({
            scope: ctx.scope,
            port: flagNumber(parsed.flags, "port"),
            bind: flagString(parsed.flags, "bind") ?? "127.0.0.1"
        });
        Project.setPhase(ctx.scope, "review");
        recordStep(ctx.scope, "studio", [check("bind", started.bind), check("token path", started.tokenPath)], [], "Review studio state.");

        if (flagBool(parsed.flags, "open") && !started.reused) {
            openUrl(started.url);
        }

        return finish({
            ok: true,
            command: "studio",
            summary: `${started.reused ? "Reused" : "Started"} review studio on ${started.url}`,
            data: { studio: started, scope: ctx.scope }
        }, json);
    }

    if (command === "probe") {
        const source = flagString(parsed.flags, "source");
        const all = flagBool(parsed.flags, "all") || !source;
        let stateDir = workspace;

        try {
            stateDir = Project.open(ref).scope.stateDir;
        } catch {
            // Single-source probing works before init.
        }

        if (all) {
            const spec = await loadSpec(ref, parsed.flags, workspace);
            const paths = [
                ...spec.spec.scenes.map((scene) => resolveSource(workspace, stateDir, scene.source)),
                ...(spec.spec.music ?? []).map((track) => resolveSource(workspace, stateDir, track.source))
            ];
            paths.forEach((path) => requireInput(path, "any"));
            await requireTool("ffprobe");
            const caps = await forSpec(spec.spec, workspace, stateDir);
            const checks = [...caps.values()].map((item) => check(item.path, item.kind, `audio: ${item.hasAudio}`));
            return finish({
                ok: true,
                command: "probe",
                summary: `${caps.size} source(s) probed.`,
                data: { sources: [...caps.values()], checks }
            }, json);
        }

        const path = resolveSource(workspace, stateDir, source ?? "");
        const report = requireInput(path, "any");
        await requireTool("ffprobe");
        const caps = await probe(path);
        const checks = [check("input", report.kind, `${report.size} bytes`), check("streams", caps.kind, `audio: ${caps.hasAudio}`)];

        if (!caps.exists) {
            throw VideoErrors.input(`Source does not exist: ${path}`);
        }

        return finish({ ok: true, command: "probe", summary: `${caps.kind}: ${path}`, data: { source: caps, checks } }, json);
    }

    if (command === "scene" || command === "music") {
        const action = parsed.rest[0] ?? "add";

        if (action !== "add") {
            throw VideoErrors.project(`Unsupported ${command} action "${action}". Use "add".`);
        }

        const ctx = Project.open(ref);
        const spec = Project.spec(ctx.scope);
        const source = flagString(parsed.flags, "source");
        const duration = flagNumber(parsed.flags, "duration");

        if (!source) {
            throw VideoErrors.spec(`${command} add needs --source <path>.`);
        }
        if (command === "scene" && (duration === undefined || duration <= 0)) {
            throw VideoErrors.spec("scene add needs --duration <seconds> greater than 0.");
        }

        const resolvedSource = resolveSource(workspace, ctx.scope.stateDir, source);
        const report = requireInput(resolvedSource, command === "music" ? "audio" : "any");
        recordStep(ctx.scope, `${command} add`, [check("input", report.kind, `${report.size} bytes`)], [resolvedSource], "Validated source.");

        const updated = command === "scene"
            ? addScene(spec, {
                source,
                duration: duration ?? 0,
                in: flagNumber(parsed.flags, "in"),
                fit: flagString(parsed.flags, "fit") as TimelineSpec["scenes"][number]["fit"],
                text: flagString(parsed.flags, "text"),
                fontSize: flagNumber(parsed.flags, "font-size"),
                fontColor: flagString(parsed.flags, "font-color"),
                fontFile: flagString(parsed.flags, "font-file"),
                fadeIn: flagNumber(parsed.flags, "fade-in"),
                fadeOut: flagNumber(parsed.flags, "fade-out"),
                volume: flagNumber(parsed.flags, "volume")
            })
            : addMusic(spec, {
                source,
                in: flagNumber(parsed.flags, "in"),
                volume: flagNumber(parsed.flags, "volume"),
                fadeIn: flagNumber(parsed.flags, "fade-in"),
                fadeOut: flagNumber(parsed.flags, "fade-out")
            });

        assertValid(updated);
        Project.saveSpec(ctx.scope, updated);
        Project.setPhase(ctx.scope, "edit");
        const added = command === "scene"
            ? updated.scenes[updated.scenes.length - 1]
            : updated.music?.[(updated.music?.length ?? 1) - 1];

        return finish({
            ok: true,
            command: `${command} add`,
            summary: `Added ${command} ${added && "id" in added ? added.id : ""} to ${ctx.scope.request}.`,
            data: { added, scenes: updated.scenes.length, duration: totalDuration(updated), problems: validate(updated) }
        }, json);
    }

    if (command === "plan" || command === "render") {
        const loaded = await loadSpec(ref, parsed.flags, workspace);
        const spec = loaded.spec;
        const format = flagString(parsed.flags, "format");

        if (format) {
            spec.output = { ...spec.output, format: format as NonNullable<TimelineSpec["output"]>["format"] };
        }

        const scope = loaded.scope;
        const extension = spec.output?.format ?? "mp4";
        const outFlag = flagString(parsed.flags, "out");
        const outputPath = outFlag
            ? resolve(isAbsolute(outFlag) ? outFlag : join(workspace, outFlag))
            : scope
                ? join(scope.exportsDir, `${Ids.slug(spec.name ?? "video") || "video"}-${scope.request}.${extension}`)
                : join(GtiHome.rootForSkill(), "exports", `${Ids.slug(spec.name ?? "video") || "video"}.${extension}`);

        await requireTool("ffprobe");
        const stateDir = scope?.stateDir ?? workspace;
        const inputPaths = [
            ...spec.scenes.map((scene) => resolveSource(workspace, stateDir, scene.source)),
            ...(spec.music ?? []).map((track) => resolveSource(workspace, stateDir, track.source))
        ];
        inputPaths.forEach((path) => requireInput(path, "any"));
        const caps = await forSpec(spec, workspace, stateDir);
        const plan = build(spec, caps, outputPath, workspace, stateDir);
        const planChecks = [
            check("scenes", spec.scenes.length),
            check("duration", plan.duration),
            check("output", `${plan.width}x${plan.height} @ ${plan.fps} fps`),
            check("warnings", plan.warnings.length, plan.warnings.join("; "))
        ];

        if (scope) {
            recordStep(scope, command, planChecks, inputPaths, plan.commandDisplay);
        }

        if (command === "plan") {
            return finish({
                ok: true,
                command: "plan",
                summary: `Plan for ${plan.duration}s, ${plan.width}x${plan.height} @ ${plan.fps} fps.`,
                data: { plan, checks: planChecks }
            }, json);
        }

        await requireTool("ffmpeg");
        const result = await run("ffmpeg", plan.command);

        if (result.code !== 0) {
            throw VideoErrors.ffmpeg(`ffmpeg failed with exit code ${result.code}: ${tail(result.stderr)}`);
        }
        if (!existsSync(outputPath)) {
            throw VideoErrors.render(`ffmpeg finished but ${outputPath} is missing.`);
        }

        if (scope) {
            const recordPath = join(scope.stateDir, "project.json");
            const record = Json.read<Record<string, unknown>>(recordPath);
            record.lastRender = outputPath;
            record.phase = "render";
            Json.write(recordPath, record);
        }

        return finish({
            ok: true,
            command: "render",
            summary: `Rendered ${outputPath}`,
            data: {
                path: outputPath,
                duration: plan.duration,
                format: spec.output?.format ?? "mp4",
                plan,
                warnings: plan.warnings,
                checks: [...planChecks, check("output exists", existsSync(outputPath))],
                ffmpeg: tail(result.stderr)
            }
        }, json);
    }

    throw VideoErrors.project(`Unknown command: ${command}. See \`videoeditor help\`.`);
}

/** Loads a timeline from `--spec` or from the active request. */
async function loadSpec(
    ref: ProjectRef,
    flags: Record<string, string | boolean>,
    workspace: string
): Promise<{ spec: TimelineSpec; scope: ProjectScope | null }> {
    const specFlag = flagString(flags, "spec");

    if (specFlag) {
        const path = resolve(isAbsolute(specFlag) ? specFlag : join(workspace, specFlag));
        return { spec: Json.read<TimelineSpec>(path), scope: null };
    }

    const ctx = Project.open(ref);
    return { spec: Project.spec(ctx.scope), scope: ctx.scope };
}

/** Render file names for `status`. */
function listRenders(scope: ProjectScope): string[] {
    if (!existsSync(scope.exportsDir)) {
        return [];
    }
    const { readdirSync } = fs;
    return readdirSync(scope.exportsDir).filter((name) => /\.(mp4|webm|mov|gif)$/i.test(name)).sort();
}

/** Last lines of ffmpeg output, for errors and the render result. */
function tail(text: string, lines = 8): string {
    return text.split(/\r?\n/).filter(Boolean).slice(-lines).join("\n");
}

/** Writes a standalone sample timeline and plan, without calling ffmpeg. */
async function demo(flags: Record<string, string | boolean>, workspace: string): Promise<CommandResult> {
    const outFlag = flagString(flags, "out");
    const out = resolve(isAbsolute(outFlag ?? "") ? outFlag ?? "" : join(workspace, outFlag ?? "video-editor-demo"));
    mkdirSync(out, { recursive: true });

    const spec = defaultSpec("demo");
    spec.scenes = [
        { id: "scene-1", source: "clip-a.mp4", duration: 4, fit: "cover", fadeIn: 0.5, volume: 1 },
        {
            id: "scene-2",
            source: "photo.png",
            duration: 3,
            fit: "contain",
            fadeOut: 0.5,
            text: [{ value: "The end", fontSize: 96, fontColor: "white" }]
        }
    ];
    spec.music = [{ id: "music-1", source: "music.mp3", volume: 0.3, fadeOut: 1.5 }];

    const first = join(out, "clip-a.mp4");
    const second = join(out, "photo.png");
    const third = join(out, "music.mp3");
    const capabilities = new Map([
        [first, { path: first, exists: true, kind: "video" as const, hasVideo: true, hasAudio: true }],
        [second, { path: second, exists: true, kind: "image" as const, hasVideo: true, hasAudio: false }],
        [third, { path: third, exists: true, kind: "audio" as const, hasVideo: false, hasAudio: true }]
    ]);
    const plan = build(spec, capabilities, join(out, "demo.mp4"), out, out);

    Json.write(join(out, "timeline.json"), spec);
    Json.write(join(out, "plan.json"), plan);
    writeFileSync(join(out, "command.txt"), `${plan.commandDisplay}\n`, "utf8");

    return {
        ok: true,
        command: "demo",
        summary: `Wrote a sample timeline, plan, and command under ${out}`,
        data: { dir: out, timeline: join(out, "timeline.json"), plan: join(out, "plan.json"), command: plan.commandDisplay }
    };
}

/** Prints JSON or the summary line and returns the result. */
function finish(result: CommandResult, json: boolean): CommandResult {
    if (json) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log(result.summary);
    }
    return result;
}

/** Opens a URL with the platform opener. Failure is non-fatal. */
function openUrl(url: string): void {
    const cmd = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
    execFile(cmd, args, () => undefined);
}
