/** Stability levels reported by `tools --json`. */
export type Stability = "stable" | "experimental";

/** One declared input or output of a tool. */
export interface ToolIO {
    name: string;
    type: "path" | "number" | "string" | "flag" | "json";
    required: boolean;
    description: string;
}

/** Machine readable contract for one CLI tool. */
export interface ToolContract {
    name: string;
    stability: Stability;
    summary: string;
    inputs: ToolIO[];
    outputs: ToolIO[];
}

const input = (name: string, type: ToolIO["type"], required: boolean, description: string): ToolIO =>
    ({ name, type, required, description });
const output = (name: string, type: ToolIO["type"], description: string): ToolIO =>
    ({ name, type, required: true, description });

/** Complete tool contract. Ideas ported from kajisho5/ffmpeg-skill (MIT) and OpenMotion (Apache-2.0). */
export const Tools: ToolContract[] = [
    {
        name: "doctor",
        stability: "stable",
        summary: "Detect external tools, filters, and fonts before editing.",
        inputs: [],
        outputs: [output("checks", "json", "One check per tool with version or path"), output("tools", "json", "Available tool names")]
    },
    {
        name: "tools",
        stability: "stable",
        summary: "List this contract: inputs, outputs, and stability for every tool.",
        inputs: [],
        outputs: [output("tools", "json", "Tool contracts")]
    },
    {
        name: "probe",
        stability: "stable",
        summary: "Refuse bad inputs, then report streams and duration with ffprobe.",
        inputs: [input("source", "path", false, "One file, or --all for the timeline"), input("all", "flag", false, "Probe every source in the timeline")],
        outputs: [output("source", "json", "Kind, streams, width, height, duration"), output("checks", "json", "Measured results")]
    },
    {
        name: "cut",
        stability: "stable",
        summary: "Cut a source between two times and measure the result.",
        inputs: [input("source", "path", true, "Video or audio file"), input("start", "number", true, "Start in seconds"), input("end", "number", true, "End in seconds")],
        outputs: [output("path", "path", "Rendered clip"), output("checks", "json", "Requested and measured duration")]
    },
    {
        name: "trim-silence",
        stability: "experimental",
        summary: "Detect silence and render a version with those ranges removed.",
        inputs: [input("source", "path", true, "Video with audio"), input("noise", "number", false, "Silence threshold in dB, default -40"), input("min", "number", false, "Minimum silence length, default 0.2s")],
        outputs: [output("path", "path", "Rendered clip"), output("checks", "json", "Removed ranges and duration delta")]
    },
    {
        name: "speed",
        stability: "stable",
        summary: "Change playback speed with setpts and atempo, and warn outside 0.5x to 2x.",
        inputs: [input("source", "path", true, "Video file"), input("rate", "number", true, "Speed factor")],
        outputs: [output("path", "path", "Rendered clip"), output("checks", "json", "Rate, duration, and warning")]
    },
    {
        name: "reframe",
        stability: "stable",
        summary: "Crop to an aspect ratio and report exactly what was removed and where the frame sits.",
        inputs: [input("source", "path", true, "Video file"), input("aspect", "string", true, "Target ratio such as 9:16"), input("preset", "string", false, "Platform preset that supplies the aspect")],
        outputs: [output("path", "path", "Reframed video"), output("checks", "json", "Crop pixels, percent, and placement")]
    },
    {
        name: "loudness",
        stability: "stable",
        summary: "Two-pass loudnorm with measured input LUFS and audio/video duration delta.",
        inputs: [input("source", "path", true, "Video with audio"), input("target", "number", false, "Target LUFS, default -14")],
        outputs: [output("path", "path", "Normalized video"), output("checks", "json", "Measured LUFS, TP, LRA, and A/V delta")]
    },
    {
        name: "export",
        stability: "stable",
        summary: "Apply a platform preset: size, fps, codec, and loudness target.",
        inputs: [input("source", "path", true, "Video file"), input("preset", "string", true, "reels, shorts, tiktok, or youtube")],
        outputs: [output("path", "path", "Platform ready file"), output("checks", "json", "Size, fps, codec, and loudness target")]
    },
    {
        name: "waveform",
        stability: "stable",
        summary: "Render a waveform PNG around a cut point.",
        inputs: [input("source", "path", true, "Audio or video with audio"), input("at", "number", true, "Cut point in seconds"), input("window", "number", false, "Seconds around the point, default 2")],
        outputs: [output("path", "path", "Waveform PNG"), output("checks", "json", "Time window and output size")]
    },
    {
        name: "frame",
        stability: "stable",
        summary: "Extract a frame PNG, optionally side by side with a second time.",
        inputs: [input("source", "path", true, "Video file"), input("at", "number", true, "Time in seconds"), input("compare-at", "number", false, "Second time for a side by side image")],
        outputs: [output("path", "path", "Frame PNG"), output("checks", "json", "Times and output size")]
    },
    {
        name: "captions",
        stability: "experimental",
        summary: "Import SRT/VTT or transcribe with word timings, then burn styled ASS captions in the safe area.",
        inputs: [input("source", "path", true, "Video file"), input("srt", "path", false, "SRT or VTT file"), input("language", "string", false, "Language code; auto detect when omitted"), input("style", "string", false, "Named caption style")],
        outputs: [output("path", "path", "Video with burned captions"), output("ass", "path", "Generated ASS file"), output("checks", "json", "Cue count, word timing source, and safe area")]
    },
    {
        name: "motion styles",
        stability: "experimental",
        summary: "List original starter Motion.md style guides with mood, type, easing, and durations.",
        inputs: [],
        outputs: [output("styles", "json", "Style guide summaries"), output("checks", "json", "Guide count and format")]
    },
    {
        name: "motion new",
        stability: "experimental",
        summary: "Write an editable HTML composition from a template and brand kit into the request.",
        inputs: [input("template", "string", true, "Template id"), input("brand", "path", false, "brand.json kit"), input("text", "string", false, "Copy token"), input("title", "string", false, "Title token"), input("accent", "string", false, "Accent token"), input("label", "string", false, "Label token"), input("number", "string", false, "Number token"), input("preset", "string", false, "Platform canvas"), input("size", "string", false, "WxH canvas"), input("fps", "number", false, "Frame rate"), input("duration", "number", false, "Composition duration")],
        outputs: [output("path", "path", "Composition HTML"), output("checks", "json", "Template, brand, canvas, seek contract")]
    },
    {
        name: "motion render",
        stability: "experimental",
        summary: "Seek a composition frame by frame in Chromium and encode MP4 or alpha WebM with ffmpeg.",
        inputs: [input("source", "path", false, "Composition HTML, defaults to the last motion new"), input("preset", "string", false, "Platform canvas"), input("size", "string", false, "WxH canvas"), input("fps", "number", false, "Frame rate"), input("duration", "number", false, "Seconds to render"), input("alpha", "flag", false, "WebM with alpha for overlays"), input("out", "path", false, "Named output")],
        outputs: [output("path", "path", "Rendered video"), output("checks", "json", "ffprobe size, fps, duration, frame count, codec")]
    },
    {
        name: "motion analyze",
        stability: "experimental",
        summary: "Measure a reference video: cuts, pacing, palette, motion intensity, and text-heavy frames. No AI model.",
        inputs: [input("source", "path", true, "Reference video")],
        outputs: [output("brief", "path", "motion-brief.md"), output("checks", "json", "Cut count, palette, keyframes, brief")]
    },
    {
        name: "motion add",
        stability: "experimental",
        summary: "Add a rendered motion clip to the timeline as a clip or a timed overlay.",
        inputs: [input("source", "path", false, "Rendered motion file, defaults to the last render"), input("as", "string", false, "clip or overlay"), input("at", "number", false, "Overlay start time"), input("duration", "number", false, "Clip length")],
        outputs: [output("added", "json", "Scene or overlay record"), output("checks", "json", "Mode, placement, and source")]
    },
    {
        name: "review",
        stability: "stable",
        summary: "Write a static HTML review page with inputs, checks, a phone preview, a timeline, and notes.",
        inputs: [input("out", "path", false, "HTML destination; defaults to exports/review.html")],
        outputs: [output("path", "path", "Static HTML file"), output("checks", "json", "Inputs, steps, and rendered sections")]
    },
    {
        name: "plan",
        stability: "stable",
        summary: "Show the exact ffmpeg command for the timeline without running it.",
        inputs: [input("spec", "path", false, "Timeline file"), input("format", "string", false, "Output container")],
        outputs: [output("plan", "json", "Command, filter graph, and warnings"), output("checks", "json", "Validation results")]
    },
    {
        name: "render",
        stability: "stable",
        summary: "Run the planned ffmpeg command once and write the export.",
        inputs: [input("spec", "path", false, "Timeline file"), input("out", "path", false, "Named destination")],
        outputs: [output("path", "path", "Rendered video"), output("checks", "json", "Duration and warnings")]
    },
    {
        name: "studio",
        stability: "stable",
        summary: "Serve the review page locally; binds to 127.0.0.1 unless --bind is given.",
        inputs: [input("port", "number", false, "Preferred port, default 4870"), input("bind", "string", false, "Explicit bind address"), input("open", "flag", false, "Open the URL")],
        outputs: [output("url", "string", "Token gated URL"), output("checks", "json", "Bind address and token path")]
    },
    {
        name: "status",
        stability: "stable",
        summary: "Report tool availability and the active request.",
        inputs: [],
        outputs: [output("tools", "json", "ffmpeg and ffprobe availability"), output("state", "json", "Active request and paths")]
    },
    {
        name: "init",
        stability: "stable",
        summary: "Create a per chat request folder under ~/.gti/video-editor.",
        inputs: [input("name", "string", false, "Request name"), input("new", "flag", false, "Start another request"), input("permanent", "flag", false, "Keep across chats")],
        outputs: [output("scope", "json", "State and export paths"), output("spec", "json", "Starter timeline")]
    },
    {
        name: "scene add",
        stability: "stable",
        summary: "Append a video or image scene to the timeline.",
        inputs: [input("source", "path", true, "Media file"), input("duration", "number", true, "Scene length")],
        outputs: [output("added", "json", "New scene"), output("checks", "json", "Validation results")]
    },
    {
        name: "music add",
        stability: "stable",
        summary: "Append a music track to the timeline.",
        inputs: [input("source", "path", true, "Audio file")],
        outputs: [output("added", "json", "New track"), output("checks", "json", "Validation results")]
    },
    {
        name: "history",
        stability: "stable",
        summary: "List requests in the session or permanent project.",
        inputs: [],
        outputs: [output("requests", "json", "Request summaries")]
    },
    {
        name: "demo",
        stability: "stable",
        summary: "Write a sample timeline and plan without ffmpeg.",
        inputs: [input("out", "path", false, "Destination folder")],
        outputs: [output("dir", "path", "Folder with sample files")]
    },
    {
        name: "resume",
        stability: "stable",
        summary: "Short summary of the active request.",
        inputs: [],
        outputs: [output("state", "json", "Active request summary")]
    }
];
