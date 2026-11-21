import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { VideoErrors } from "../core/Errors";
import { run } from "../ffmpeg/Runner";

/** One word with its own timing. */
export interface Word {
    text: string;
    start: number;
    end: number;
}

/** One subtitle cue. */
export interface Cue {
    start: number;
    end: number;
    text: string;
    words: Word[];
    /** `imported`, `estimated`, or `transcribed`. */
    timing: "imported" | "estimated" | "transcribed";
}

/** Named caption style. Colors are ASS &HAABBGGRR values. */
export interface CaptionStyle {
    name: string;
    fontSize: number;
    primary: string;
    secondary: string;
    outline: string;
    bold: boolean;
}

export const CaptionStyles: Record<string, CaptionStyle> = {
    "default": {
        name: "videoeditor-default", fontSize: 64, primary: "&H00FFFFFF",
        secondary: "&H0000FFFF", outline: "&H00000000", bold: true
    },
    "reels-bold": {
        name: "videoeditor-reels", fontSize: 78, primary: "&H00FFFFFF",
        secondary: "&H0000FFFF", outline: "&H00000000", bold: true
    },
    "shorts-clean": {
        name: "videoeditor-shorts", fontSize: 62, primary: "&H00FFFFFF",
        secondary: "&H00FFFFFF", outline: "&H00222222", bold: false
    },
    "tiktok-pop": {
        name: "videoeditor-tiktok", fontSize: 72, primary: "&H00FFFFFF",
        secondary: "&H0000FFFF", outline: "&H00105B9E", bold: true
    }
};

/** Parses `00:00:01,500` or `00:00:01.500` into seconds. */
export function parseTimestamp(value: string): number {
    const match = value.trim().match(/(\d+):(\d{2}):(\d{2})[.,](\d{1,3})/);

    if (!match) {
        throw VideoErrors.spec(`Invalid subtitle timestamp: ${value}`);
    }

    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

/** Distributes a cue's time evenly across its words. */
export function estimateWords(start: number, end: number, text: string): Word[] {
    const parts = text.split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
        return [];
    }
    const step = (end - start) / parts.length;

    return parts.map((part, index) => ({
        text: part,
        start: start + step * index,
        end: start + step * (index + 1)
    }));
}

/** Parses SRT or VTT text into cues with estimated word timings. */
export function parseSubtitles(text: string): Cue[] {
    const blocks = text.replace(/^\uFEFF/, "").split(/\r?\n\r?\n/);
    const cues: Cue[] = [];

    for (const block of blocks) {
        const lines = block.split(/\r?\n/).filter((line) => line.trim() !== "");
        const timeIndex = lines.findIndex((line) => line.includes("-->"));

        if (timeIndex < 0) {
            continue;
        }

        const [fromRaw, toRaw] = lines[timeIndex]?.split("-->") ?? [];
        const from = (fromRaw ?? "").trim();
        const to = (toRaw ?? "").trim();

        if (!from || !to) {
            continue;
        }

        const start = parseTimestamp(from);
        const end = parseTimestamp(to.split(/\s+/)[0] ?? to);
        const value = lines.slice(timeIndex + 1).join(" ").trim().replace(/<[^>]+>/g, "");

        if (!value || end <= start) {
            continue;
        }

        cues.push({ start, end, text: value, words: estimateWords(start, end, value), timing: "estimated" });
    }

    return cues.sort((left, right) => left.start - right.start);
}

/** Reads an SRT or VTT file, refusing the same bad inputs as other commands. */
export function importSubtitles(path: string): Cue[] {
    if (!existsSync(path)) {
        throw VideoErrors.input(`Subtitle file does not exist: ${path}`);
    }
    const text = readFileSync(path, "utf8");

    if (text.trim() === "") {
        throw VideoErrors.input(`Subtitle file is empty: ${path}`);
    }

    const cues = parseSubtitles(text);

    if (cues.length === 0) {
        throw VideoErrors.input(`No subtitle cues found in ${path}. Use .srt or .vtt with HH:MM:SS,mmm --> HH:MM:SS,mmm.`);
    }

    return cues;
}

/** ASS timestamp. */
function assTime(seconds: number): string {
    const total = Math.max(0, seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = Math.floor(total % 60);
    const centis = Math.floor((total % 1) * 100);
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

/** Builds ASS with karaoke word highlighting inside a bottom safe area. */
export function toAss(
    cues: Cue[],
    width: number,
    height: number,
    styleName = "default",
    safeBottom = 0.15
): { content: string; style: CaptionStyle; marginV: number } {
    const style = CaptionStyles[styleName] ?? CaptionStyles.default ?? {
        name: "videoeditor-default", fontSize: 64, primary: "&H00FFFFFF",
        secondary: "&H0000FFFF", outline: "&H00000000", bold: true
    };
    const marginV = Math.max(24, Math.round(height * safeBottom));
    const events = cues.map((cue) => {
        const parts = cue.words.length > 0 ? cue.words : estimateWords(cue.start, cue.end, cue.text);
        const karaoke = parts.map((word) => {
            const duration = Math.max(1, Math.round((word.end - word.start) * 100));
            return `{\\kf${duration}}${word.text.replace(/\{/g, "(").replace(/\}/g, ")")}`;
        }).join(" ");
        return `Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},${style.name},,0,0,0,,${karaoke}`;
    });

    return {
        content: [
            "[Script Info]",
            "ScriptType: v4.00+",
            `PlayResX: ${width}`,
            `PlayResY: ${height}`,
            "WrapStyle: 2",
            "ScaledBorderAndShadow: yes",
            "",
            "[V4+ Styles]",
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
            `Style: ${style.name},Arial,${style.fontSize},${style.primary},${style.secondary},${style.outline},&H80000000,${style.bold ? -1 : 0},0,0,0,100,100,0,0,1,3,0,2,40,40,${marginV},1`,
            "",
            "[Events]",
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
            ...events,
            ""
        ].join("\n"),
        style,
        marginV
    };
}

/** Writes the ASS file next to the request state. */
export function writeAss(stateDir: string, cues: Cue[], width: number, height: number, style: string, safeBottom: number): string {
    const { content } = toAss(cues, width, height, style, safeBottom);
    const path = join(stateDir, "captions.ass");
    writeFileSync(path, content, "utf8");
    return path;
}

/** Transcribers that may be installed on this machine. */
export interface Transcriber {
    name: string;
    available: boolean;
    detail: string;
}

const TranscriberCommands = ["faster-whisper", "whisper-cli", "whisper"];

/** Detects local speech to text tools without assuming any are installed. */
export async function detectTranscribers(): Promise<Transcriber[]> {
    return Promise.all(TranscriberCommands.map(async (name) => {
        const result = await run(name, ["--help"]).catch(() => null);
        return {
            name,
            available: result !== null && result.code === 0,
            detail: result && result.code === 0 ? "on PATH" : "not installed"
        };
    }));
}

/** Whisper JSON segment shape used by both transcribers. */
interface WhisperSegment {
    start?: number;
    end?: number;
    text?: string;
    words?: Array<{ word?: string; start?: number; end?: number }>;
}

/** Converts whisper JSON segments into cues with word timings. */
export function whisperSegmentsToCues(segments: WhisperSegment[]): Cue[] {
    return segments.map((segment) => {
        const start = Number(segment.start ?? 0);
        const end = Number(segment.end ?? start);
        const text = (segment.text ?? "").trim();
        const words = (segment.words ?? []).map((word) => ({
            text: (word.word ?? "").trim(),
            start: Number(word.start ?? start),
            end: Number(word.end ?? end)
        })).filter((word) => word.text !== "");

        return {
            start,
            end,
            text,
            words: words.length > 0 ? words : estimateWords(start, end, text),
            timing: words.length > 0 ? "transcribed" as const : "estimated" as const
        };
    }).filter((cue) => cue.text !== "" && cue.end > cue.start);
}

/**
 * Transcribes locally when a transcriber is installed. No language is assumed:
 * omitting `--language` asks the tool to auto detect it.
 */
export async function transcribe(source: string, stateDir: string, language?: string): Promise<{ cues: Cue[]; tool: string; language: string }> {
    const available = await detectTranscribers();
    const chosen = available.find((tool) => tool.available);

    if (!chosen) {
        throw VideoErrors.input(
            "No local transcriber found (faster-whisper, whisper-cli, or whisper). Install one or import an SRT/VTT file with --srt."
        );
    }

    if (chosen.name === "faster-whisper") {
        const args = [source, "--model", "tiny", "--word_timestamps", "True", "--output_format", "json", "--output_dir", stateDir];
        if (language) {
            args.push("--language", language);
        }
        const result = await run("faster-whisper", args);

        if (result.code !== 0) {
            throw VideoErrors.ffmpeg(`faster-whisper failed: ${result.stderr.trim().slice(-400)}`);
        }

        const path = join(stateDir, `${basename(source).replace(/\.[^.]+$/, "")}.json`);

        if (!existsSync(path)) {
            throw VideoErrors.input(`faster-whisper did not write its JSON next to ${path}.`);
        }

        const parsed = JSON.parse(readFileSync(path, "utf8")) as { segments?: WhisperSegment[] };
        return { cues: whisperSegmentsToCues(parsed.segments ?? []), tool: chosen.name, language: language ?? "auto" };
    }

    const prefix = join(stateDir, "transcript");
    const args = ["-f", source, "-l", language ?? "auto", "-oj", "-of", prefix, "--word_timestamps"];
    const result = await run(chosen.name, args);

    if (result.code !== 0) {
        throw VideoErrors.ffmpeg(`${chosen.name} failed: ${result.stderr.trim().slice(-400)}`);
    }

    const path = `${prefix}.json`;

    if (!existsSync(path)) {
        throw VideoErrors.input(`${chosen.name} did not write its JSON next to ${path}.`);
    }

    const parsed = JSON.parse(readFileSync(path, "utf8")) as { transcription?: WhisperSegment[]; segments?: WhisperSegment[] };
    return {
        cues: whisperSegmentsToCues(parsed.transcription ?? parsed.segments ?? []),
        tool: chosen.name,
        language: language ?? "auto"
    };
}
