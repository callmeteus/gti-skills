import { VideoErrors } from "../core/Errors";
import { run } from "./Runner";

/** Per stream durations from ffprobe. */
export interface AvDurations {
    video: number | null;
    audio: number | null;
    delta: number | null;
}

interface StreamEntry {
    codec_type?: string;
    duration?: string;
}

/** Reads video and audio stream durations and their absolute difference. */
export async function avDurations(path: string): Promise<AvDurations> {
    const result = await run("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,duration", "-of", "json", path]);

    if (result.code !== 0) {
        throw VideoErrors.input(`ffprobe could not read ${path}: ${result.stderr.trim()}`);
    }

    let streams: StreamEntry[] = [];

    try {
        streams = (JSON.parse(result.stdout) as { streams?: StreamEntry[] }).streams ?? [];
    } catch {
        throw VideoErrors.input(`ffprobe returned invalid JSON for ${path}.`);
    }

    const number = (value: string | undefined): number | null => {
        const parsed = Number(value);
        return value && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    };
    const video = number(streams.find((stream) => stream.codec_type === "video")?.duration);
    const audio = number(streams.find((stream) => stream.codec_type === "audio")?.duration);
    const delta = video !== null && audio !== null ? Math.abs(video - audio) : null;

    return { video, audio, delta };
}

/** First pass loudnorm measurement. */
export interface LoudnessMeasurement {
    inputI: number;
    inputTP: number;
    inputLRA: number;
    inputThresh: number;
    offset: number;
}

/** Result of a two pass loudnorm render. */
export interface LoudnessResult {
    measured: LoudnessMeasurement;
    filter: string;
    before: AvDurations;
    after: AvDurations;
}

/** Parses the JSON block printed by loudnorm print_format=json. */
export function parseLoudnormJson(stderr: string): LoudnessMeasurement {
    const match = stderr.match(/\{\s*"input_i"[\s\S]*?\}/);

    if (!match) {
        throw VideoErrors.ffmpeg("loudnorm did not return a measurement. Does the source have an audio stream?");
    }

    try {
        const raw = JSON.parse(match[0]) as Record<string, string>;
        const value = (key: string, fallback: number): number => {
            const parsed = Number(raw[key]);
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        return {
            inputI: value("input_i", -14),
            inputTP: value("input_tp", -1.5),
            inputLRA: value("input_lra", 11),
            inputThresh: value("input_thresh", -70),
            offset: value("offset", 0)
        };
    } catch {
        throw VideoErrors.ffmpeg("loudnorm measurement was not valid JSON.");
    }
}

/** Runs loudnorm twice and renders the normalized file. */
export async function normalizeLoudness(
    source: string,
    output: string,
    target = -14
): Promise<LoudnessResult> {
    const first = `loudnorm=I=${target}:TP=-1.5:LRA=11:print_format=json`;
    const measuredRun = await run("ffmpeg", [
        "-hide_banner", "-nostats", "-i", source, "-vn", "-af", first, "-f", "null", "-"
    ]);

    if (measuredRun.code !== 0) {
        throw VideoErrors.ffmpeg(`loudnorm analysis failed: ${tail(measuredRun.stderr)}`);
    }

    const measured = parseLoudnormJson(measuredRun.stderr);
    const before = await avDurations(source);
    const filter = [
        `loudnorm=I=${target}:TP=-1.5:LRA=11:linear=true`,
        `measured_I=${measured.inputI}`,
        `measured_TP=${measured.inputTP}`,
        `measured_LRA=${measured.inputLRA}`,
        `measured_thresh=${measured.inputThresh}`,
        `offset=${measured.offset}`,
        "print_format=summary"
    ].join(":");
    const result = await run("ffmpeg", [
        "-y", "-hide_banner", "-loglevel", "error", "-i", source,
        "-af", filter, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", output
    ]);

    if (result.code !== 0) {
        throw VideoErrors.ffmpeg(`loudnorm render failed: ${tail(result.stderr)}`);
    }

    return { measured, filter, before, after: await avDurations(output) };
}

/** A detected silent range. */
export interface SilenceRange {
    start: number;
    end: number;
    duration: number;
}

/** Parses silencedetect lines from ffmpeg stderr. */
export function parseSilence(stderr: string): SilenceRange[] {
    const ranges: SilenceRange[] = [];
    let start: number | null = null;

    for (const line of stderr.split(/\r?\n/)) {
        const begin = line.match(/silence_start:\s*([\d.]+)/);
        const end = line.match(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/);

        if (begin) {
            start = Number(begin[1]);
        } else if (end && start !== null) {
            ranges.push({ start, end: Number(end[1]), duration: Number(end[2]) });
            start = null;
        }
    }

    return ranges;
}

/** Detects silent ranges with the silencedetect filter. */
export async function detectSilence(
    source: string,
    noiseDb = -40,
    minDuration = 0.2
): Promise<SilenceRange[]> {
    const result = await run("ffmpeg", [
        "-hide_banner", "-nostats", "-i", source, "-vn",
        "-af", `silencedetect=noise=${noiseDb}dB:d=${minDuration}`, "-f", "null", "-"
    ]);

    if (result.code !== 0) {
        throw VideoErrors.ffmpeg(`silencedetect failed: ${tail(result.stderr)}`);
    }

    return parseSilence(result.stderr);
}

/** Complement of the silent ranges inside a timeline. */
export function keepRanges(total: number, silence: SilenceRange[]): Array<{ start: number; end: number }> {
    const keep: Array<{ start: number; end: number }> = [];
    let cursor = 0;

    for (const range of silence) {
        if (range.start > cursor) {
            keep.push({ start: cursor, end: range.start });
        }
        cursor = Math.max(cursor, range.end);
    }
    if (cursor < total) {
        keep.push({ start: cursor, end: total });
    }

    return keep.filter((range) => range.end - range.start > 0.01);
}

/** Chains atempo filters so factors outside 0.5 to 2 still work. */
export function atempoChain(rate: number): string {
    if (rate <= 0 || !Number.isFinite(rate)) {
        throw VideoErrors.spec("Speed rate must be a positive number.");
    }

    const factors: number[] = [];
    let remaining = rate;

    while (remaining > 2) {
        factors.push(2);
        remaining /= 2;
    }
    while (remaining < 0.5) {
        factors.push(0.5);
        remaining /= 0.5;
    }
    factors.push(remaining);

    return factors.map((factor) => `atempo=${round(factor)}`).join(",");
}

/** Round to three decimals for stable commands. */
export function round(value: number): number {
    return Math.round(value * 1000) / 1000;
}

/** Last eight non-empty lines of tool output. */
export function tail(text: string, lines = 8): string {
    return text.split(/\r?\n/).filter(Boolean).slice(-lines).join("\n");
}
