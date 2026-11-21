import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { run } from "../../src/ffmpeg/Runner";
import { DefaultBrand } from "../../src/motion/brand";
import { browserStatus, cleanupFrames, renderComposition } from "../../src/motion/renderer";
import { compose } from "../../src/motion/templates";

const ffmpeg = spawnSync("ffmpeg", ["-version"], { windowsHide: true }).status === 0;
const chromium = await browserStatus().then((status) => status.chromium).catch(() => false);
const available = ffmpeg && chromium;

if (!available) {
    console.log(`Skipping motion render test: ${!ffmpeg ? "ffmpeg" : ""}${!ffmpeg && !chromium ? " and " : ""}${!chromium ? "Chromium" : ""} not available.`);
}

describe.skipIf(!available)("motion render integration", () => {
    let dir: string;
    let output: string;
    let measured: { width: number; height: number; fps: number; frames: number; codec: string };

    beforeAll(async () => {
        dir = mkdtempSync(join(tmpdir(), "videoeditor-motion-"));
        const composition = join(dir, "composition.html");
        const html = compose("lower-third", { TEXT: "Ada Lovelace" }, DefaultBrand, {
            width: 360, height: 640, duration: 1, fps: 30
        });
        writeFileSync(composition, html, "utf8");
        output = join(dir, "motion.mp4");
        const result = await renderComposition({
            composition, output, fps: 30, duration: 1, width: 360, height: 640
        });
        cleanupFrames(result.framesDir);
        measured = {
            width: result.width, height: result.height, fps: result.fps,
            frames: result.frames, codec: result.codec
        };
    }, 120000);

    afterAll(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it("renders a one second template at 30 fps with the expected size and frames", async () => {
        expect(existsSync(output)).toBe(true);
        expect(measured.width).toBe(360);
        expect(measured.height).toBe(640);
        expect(Math.round(measured.fps)).toBe(30);
        expect(measured.frames).toBe(30);
        expect(measured.codec).toBe("h264");
    });

    it("matches an independent ffprobe frame count", async () => {
        const result = await run("ffprobe", [
            "-v", "error", "-count_frames", "-select_streams", "v:0",
            "-show_entries", "stream=nb_read_frames,width,height,r_frame_rate",
            "-of", "json", output
        ]);
        expect(result.code).toBe(0);
        const stream = (JSON.parse(result.stdout).streams ?? [])[0];
        expect(stream.nb_read_frames).toBe("30");
        expect(`${stream.width}x${stream.height}`).toBe("360x640");
    });
});
