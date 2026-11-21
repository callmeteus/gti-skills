import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { VideoErrors } from "../core/Errors";
import { run } from "../ffmpeg/Runner";

/** Install hint returned by doctor and render failures. */
export const InstallHint = "npm install && npx playwright install chromium";

/** Playwright availability, detected without throwing. */
export interface BrowserStatus {
    playwright: boolean;
    chromium: boolean;
    detail: string;
}

/** Loads Playwright when installed, otherwise null. */
async function loadPlaywright(): Promise<any | null> {
    try {
        return await import("playwright");
    } catch {
        return null;
    }
}

/** Detects Playwright and a launchable Chromium. */
export async function browserStatus(): Promise<BrowserStatus> {
    const playwright = await loadPlaywright();

    if (!playwright) {
        return { playwright: false, chromium: false, detail: `playwright not installed (${InstallHint})` };
    }

    try {
        const browser = await playwright.chromium.launch({ headless: true });
        await browser.close();
        return { playwright: true, chromium: true, detail: "playwright and chromium ready" };
    } catch (error) {
        return {
            playwright: true,
            chromium: false,
            detail: `chromium not installed (${InstallHint}): ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`
        };
    }
}

/** Options for rendering a composition. */
export interface RenderOptions {
    composition: string;
    output: string;
    fps: number;
    duration: number;
    width: number;
    height: number;
    /** WebM with an alpha channel, for overlays. */
    alpha?: boolean;
}

/** Result of a render, including measured properties. */
export interface RenderResult {
    path: string;
    fps: number;
    duration: number;
    width: number;
    height: number;
    frames: number;
    codec: string;
    framesDir: string;
}

/** Reads the number of decoded frames with ffprobe. */
async function frameCount(path: string): Promise<number> {
    const result = await run("ffprobe", [
        "-v", "error", "-count_frames", "-select_streams", "v:0",
        "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", path
    ]);
    const count = Number(result.stdout.trim().split(/\r?\n/)[0]);
    return Number.isFinite(count) ? count : 0;
}

/** Reads width, height, fps and codec from a rendered file. */
async function measure(path: string): Promise<{ width: number; height: number; fps: number; codec: string; duration: number }> {
    const result = await run("ffprobe", [
        "-v", "error",
        "-show_entries", "stream=codec_name,width,height,r_frame_rate:format=duration",
        "-of", "json", path
    ]);

    if (result.code !== 0) {
        throw VideoErrors.ffmpeg(`ffprobe could not read the render: ${result.stderr.trim()}`);
    }

    const parsed = JSON.parse(result.stdout) as {
        streams?: Array<{ codec_name?: string; width?: number; height?: number; r_frame_rate?: string }>;
        format?: { duration?: string };
    };
    const video = (parsed.streams ?? []).find((stream) => stream.width && stream.height);
    const [numerator, denominator] = (video?.r_frame_rate ?? "0/1").split("/").map(Number);
    return {
        width: video?.width ?? 0,
        height: video?.height ?? 0,
        fps: denominator ? Number(numerator) / Number(denominator) : Number(numerator),
        codec: video?.codec_name ?? "unknown",
        duration: Number(parsed.format?.duration ?? 0)
    };
}

/** Seeks a composition frame by frame, screenshots it, and encodes with ffmpeg. */
export async function renderComposition(options: RenderOptions): Promise<RenderResult> {
    const status = await browserStatus();

    if (!status.playwright || !status.chromium) {
        throw VideoErrors.render(`Motion render needs Playwright and Chromium. ${InstallHint}`);
    }

    if (!existsSync(options.composition)) {
        throw VideoErrors.input(`Composition not found: ${options.composition}`);
    }
    if (options.fps <= 0 || options.duration <= 0) {
        throw VideoErrors.spec("Render needs positive --fps and --duration.");
    }

    const playwright = await loadPlaywright();
    const framesDir = join(resolve(options.output, ".."), `.${options.fps}f-${Math.random().toString(36).slice(2, 8)}`);
    mkdirSync(framesDir, { recursive: true });
    let browser: any | null = null;
    let page: any | null = null;

    try {
        browser = await playwright.chromium.launch({ headless: true });
        page = await browser.newPage({
            viewport: { width: options.width, height: options.height },
            deviceScaleFactor: 1
        });
        await page.goto(pathToFileURL(resolve(options.composition)).href);
        await page.waitForFunction(
            "window.__ready === true && typeof window.__seek === 'function'",
            null,
            { timeout: 10000 }
        );

        const total = Math.max(1, Math.round(options.fps * options.duration));

        // Each seek writes one PNG straight to disk. Frames are never held in
        // memory as a group, so a long render is bounded by one frame plus
        // ffmpeg's own buffers.
        for (let index = 0; index < total; index += 1) {
            const time = index / options.fps;
            await page.evaluate((t: number) => (window as any).__seek(t), time);
            await page.screenshot({
                path: join(framesDir, `frame-${String(index).padStart(6, "0")}.png`),
                omitBackground: Boolean(options.alpha)
            });
        }

        const framePattern = join(framesDir, "frame-%06d.png");
        const args = options.alpha
            ? [
                "-y", "-framerate", String(options.fps), "-i", framePattern,
                "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0",
                "-b:v", "0", "-crf", "24", options.output
            ]
            : [
                "-y", "-framerate", String(options.fps), "-i", framePattern,
                "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart", options.output
            ];
        const encoded = await run("ffmpeg", args);

        if (encoded.code !== 0) {
            throw VideoErrors.ffmpeg(`Motion encode failed: ${encoded.stderr.trim().slice(-500)}`);
        }
    } finally {
        // Close the page before the browser so no renderer process lingers
        // after a render or a failure, which is what exhausts memory in a
        // shared test run.
        if (page) {
            await page.close().catch(() => undefined);
        }
        if (browser) {
            await browser.close().catch(() => undefined);
        }
    }

    const measured = await measure(options.output);
    const frames = await frameCount(options.output);
    return {
        path: options.output,
        fps: measured.fps,
        duration: measured.duration,
        width: measured.width,
        height: measured.height,
        frames,
        codec: measured.codec,
        framesDir
    };
}

/** Removes a render's temporary frame folder. */
export function cleanupFrames(framesDir: string): void {
    if (existsSync(framesDir) && readdirSync(framesDir).length >= 0) {
        rmSync(framesDir, { recursive: true, force: true });
    }
}
