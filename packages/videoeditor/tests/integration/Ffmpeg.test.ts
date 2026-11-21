import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runCli } from "../../src/cli/Cli";
import type { CommandResult } from "../../src/core/Types";
import { probe } from "../../src/ffmpeg/Capabilities";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { windowsHide: true }).status === 0;

if (!hasFfmpeg) {
    console.log("Skipping ffmpeg integration tests: ffmpeg is not on PATH.");
}

const SRT = [
    "1",
    "00:00:00,200 --> 00:00:01,200",
    "Hello from the integration test",
    "",
    "2",
    "00:00:01,300 --> 00:00:02,300",
    "Second caption line here",
    ""
].join("\n");

describe.skipIf(!hasFfmpeg)("ffmpeg integration", () => {
    let dir: string;
    let previousHome: string | undefined;
    const common: string[] = [];

    beforeAll(async () => {
        dir = mkdtempSync(join(tmpdir(), "videoeditor-integration-"));
        previousHome = process.env.GTI_HOME;
        process.env.GTI_HOME = join(dir, "state");
        common.push("--root", dir, "--session", "integration", "--json");

        const clip = join(dir, "clip.mp4");
        const generated = spawnSync("ffmpeg", [
            "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", "testsrc=duration=3:size=640x360:rate=25",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
            "-c:v", "libx264", "-threads", "2", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", clip
        ], { windowsHide: true });

        expect(generated.status, generated.stderr.toString()).toBe(0);
        expect(existsSync(clip)).toBe(true);

        const wide = join(dir, "wide.mp4");
        const wideGenerated = spawnSync("ffmpeg", [
            "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", "testsrc=duration=2:size=1280x720:rate=25",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
            "-c:v", "libx264", "-threads", "2", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", wide
        ], { windowsHide: true });
        expect(wideGenerated.status, wideGenerated.stderr.toString()).toBe(0);
        expect(existsSync(wide)).toBe(true);

        writeFileSync(join(dir, "captions.srt"), SRT, "utf8");
        writeFileSync(join(dir, "empty.mp4"), "", "utf8");
        writeFileSync(join(dir, "notes.txt"), "not media", "utf8");
        await runCli(["init", "--name", "Integration", ...common]);
    }, 60000);

    afterAll(() => {
        if (previousHome === undefined) {
            delete process.env.GTI_HOME;
        } else {
            process.env.GTI_HOME = previousHome;
        }
        rmSync(dir, { recursive: true, force: true });
    });

    /** Runs a feature command and returns its data with checks. */
    async function run(...args: string[]): Promise<Record<string, any>> {
        const result = await runCli([...args, ...common]) as CommandResult;
        expect(result.ok).toBe(true);
        expect(Array.isArray(result.data?.checks)).toBe(true);
        return result.data ?? {};
    }

    it("cuts a source and reports measured duration", async () => {
        const data = await run("cut", "--source", "clip.mp4", "--start", "0.5", "--end", "2");
        expect(existsSync(data.path)).toBe(true);
        expect(data.duration).toBeGreaterThan(1.3);
        expect(data.duration).toBeLessThan(1.7);
        expect(data.checks.some((item: any) => item.name === "duration delta")).toBe(true);
    }, 60000);

    it("reframes to 9:16 and reports cropped pixels and placement", async () => {
        const data = await run("reframe", "--source", "clip.mp4", "--aspect", "9:16");
        expect(existsSync(data.path)).toBe(true);
        expect(data.croppedPixels).toBeGreaterThan(0);
        expect(data.croppedPercent).toBeGreaterThan(0);
        expect(data.placement.anchor).toBe("center");
        expect(data.checks.some((item: any) => item.name === "cropped pixels")).toBe(true);
        expect(data.checks.some((item: any) => item.name === "placement")).toBe(true);
    }, 60000);

    it("reframes a 1280x720 source to the correct size for 9:16, 4:5, and 1:1", async () => {
        const cases = [
            { aspect: "9:16", expected: "1080x1920" },
            { aspect: "4:5", expected: "1080x1350" },
            { aspect: "1:1", expected: "1080x1080" }
        ];

        for (const item of cases) {
            const data = await run("reframe", "--source", "wide.mp4", "--aspect", item.aspect);
            const written = await probe(data.path);
            expect(`${written.width}x${written.height}`, `${item.aspect} ffprobe size`).toBe(item.expected);
            const sizeCheck = data.checks.find((entry: any) => entry.name === "output size");
            expect(sizeCheck.ok, `${item.aspect} output size check`).toBe(true);
            expect(sizeCheck.measured).toBe(item.expected);
            const aspectCheck = data.checks.find((entry: any) => entry.name === "output aspect");
            expect(aspectCheck.ok, `${item.aspect} aspect check`).toBe(true);
        }
    }, 120000);

    it("measures loudness and the audio/video duration delta", async () => {
        const data = await run("loudness", "--source", "clip.mp4", "--target", "-14");
        expect(existsSync(data.path)).toBe(true);
        expect(Number.isFinite(data.measuredLUFS)).toBe(true);
        expect(data.checks.some((item: any) => item.name === "A/V duration delta before")).toBe(true);
    }, 90000);

    it("exports the reels preset with size, fps, codec, and loudness target", async () => {
        const data = await run("export", "--source", "clip.mp4", "--preset", "reels");
        expect(existsSync(data.path)).toBe(true);
        const names = data.checks.map((item: any) => item.name);
        expect(names).toContain("size");
        expect(names).toContain("fps");
        expect(names).toContain("codec");
        expect(names).toContain("loudness target");
        expect(data.checks.find((item: any) => item.name === "size").measured).toBe("1080x1920");
    }, 90000);

    it("imports an SRT fixture and burns styled captions", async () => {
        const data = await run("captions", "--source", "clip.mp4", "--srt", "captions.srt", "--style", "reels-bold");
        expect(existsSync(data.path)).toBe(true);
        expect(existsSync(data.ass)).toBe(true);
        expect(data.cues).toBe(2);
        expect(data.timing).toBe("estimated");
        expect(data.checks.some((item: any) => item.name === "word timing")).toBe(true);
    }, 90000);

    it("refuses empty and unsupported inputs before ffmpeg runs", async () => {
        await expect(runCli(["probe", "--source", "empty.mp4", ...common])).rejects.toMatchObject({ code: "INPUT" });
        await expect(runCli(["probe", "--source", "notes.txt", ...common])).rejects.toMatchObject({ code: "INPUT" });
        await expect(runCli(["cut", "--source", "notes.txt", "--start", "0", "--end", "1", ...common])).rejects.toMatchObject({ code: "INPUT" });
    });
});
