import { describe, expect, it } from "vitest";
import { resolve } from "node:path";

import { VideoEditorError } from "../../src/core/Errors";
import type { SourceCapabilities, TimelineSpec } from "../../src/core/Types";
import { build } from "../../src/ffmpeg/Planner";
import { defaultSpec } from "../../src/session/Spec";

const workspace = "C:/work/edit";

function caps(kind: "video" | "image" | "audio", hasAudio: boolean): SourceCapabilities {
    return {
        path: "unused",
        exists: true,
        kind,
        hasVideo: kind === "video" || kind === "image",
        hasAudio
    };
}

describe("Planner.build", () => {
    it("builds a two scene timeline with text, fades, and mixed music", () => {
        const spec: TimelineSpec = {
            ...defaultSpec("clip"),
            scenes: [
                { id: "a", source: "a.mp4", duration: 4, in: 1, fadeIn: 0.5, volume: 1 },
                {
                    id: "b",
                    source: "b.png",
                    duration: 3,
                    fit: "contain",
                    fadeOut: 0.5,
                    volume: 0,
                    text: [{ value: "The end", x: "(w-text_w)/2", y: "h-120" }]
                }
            ],
            music: [{ id: "m", source: "m.mp3", volume: 0.3, fadeOut: 1 }]
        };
        const capabilities = new Map<string, SourceCapabilities>([
            [resolve(workspace, "a.mp4"), caps("video", true)],
            [resolve(workspace, "b.png"), caps("image", false)],
            [resolve(workspace, "m.mp3"), caps("audio", true)]
        ]);

        const plan = build(spec, capabilities, `${workspace}/out.mp4`, workspace, workspace);

        expect(plan.duration).toBe(7);
        expect(plan.filterGraph).toContain("trim=start=1:duration=4");
        expect(plan.filterGraph).toContain("force_original_aspect_ratio=increase,crop=1920:1080");
        expect(plan.filterGraph).toContain("force_original_aspect_ratio=decrease,pad=1920:1080");
        expect(plan.filterGraph).toContain("drawtext=");
        expect(plan.filterGraph).toContain("text='The end'");
        expect(plan.filterGraph).toContain("fade=t=in:st=0:d=0.5");
        expect(plan.filterGraph).toContain("concat=n=2:v=1:a=0[vout]");
        expect(plan.audioMap).toBe("[aout]");
        expect(plan.command).toContain("-t");
        expect(plan.command).toContain("7");
        expect(plan.commandDisplay).toContain("-filter_complex");
        expect(plan.warnings).toEqual([]);
    });

    it("keeps a single scene simple and does not add a concat", () => {
        const spec: TimelineSpec = {
            ...defaultSpec("one"),
            scenes: [{ id: "a", source: "a.mp4", duration: 2, volume: 0 }]
        };
        const capabilities = new Map<string, SourceCapabilities>([
            [resolve(workspace, "a.mp4"), caps("video", true)]
        ]);

        const plan = build(spec, capabilities, resolve(workspace, "out.mp4"), workspace, workspace);

        expect(plan.filterGraph).not.toContain("concat=");
        expect(plan.videoMap).toBe("[v0]");
        expect(plan.audioMap).toBeNull();
        expect(plan.command).toContain("-an");
        expect(plan.warnings).toContain("Scene 1 audio is muted.");
    });

    it("drops audio for GIF output", () => {
        const spec: TimelineSpec = {
            ...defaultSpec("gif"),
            output: { format: "gif" },
            scenes: [{ id: "a", source: "a.mp4", duration: 2, volume: 1 }]
        };
        const capabilities = new Map<string, SourceCapabilities>([
            [resolve(workspace, "a.mp4"), caps("video", true)]
        ]);

        const plan = build(spec, capabilities, resolve(workspace, "out.gif"), workspace, workspace);

        expect(plan.audioMap).toBeNull();
        expect(plan.command).toContain("-an");
        expect(plan.warnings).toContain("GIF output drops the audio track.");
    });

    it("escapes colons in filter values so Windows font paths and text with times work", () => {
        const spec: TimelineSpec = {
            ...defaultSpec("colons"),
            scenes: [{
                id: "a",
                source: "a.mp4",
                duration: 2,
                text: [{ value: "12:30", fontFile: "C:/Fonts/arial.ttf" }]
            }]
        };
        const capabilities = new Map<string, SourceCapabilities>([
            [resolve(workspace, "a.mp4"), caps("video", true)]
        ]);

        const plan = build(spec, capabilities, resolve(workspace, "out.mp4"), workspace, workspace);

        expect(plan.filterGraph).toContain("fontfile='C\\:/Fonts/arial.ttf'");
        expect(plan.filterGraph).toContain("text='12\\:30'");
    });

    it("fails clearly when a source is missing from the capabilities", () => {
        const spec: TimelineSpec = {
            ...defaultSpec("bad"),
            scenes: [{ id: "a", source: "missing.mp4", duration: 2 }]
        };

        expect(() => build(spec, new Map(), `${workspace}/out.mp4`, workspace, workspace))
            .toThrow(VideoEditorError);
    });
});
