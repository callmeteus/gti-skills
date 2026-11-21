/** Platform export preset. Targets follow common short-video delivery guidance. */
export interface ExportPreset {
    name: "reels" | "shorts" | "tiktok" | "youtube";
    width: number;
    height: number;
    fps: number;
    aspect: string;
    codec: string;
    audioCodec: string;
    loudnessTarget: number;
    /** Fraction of the frame reserved for platform UI, measured from the bottom. */
    safeBottom: number;
    note: string;
}

export const ExportPresets: Record<ExportPreset["name"], ExportPreset> = {
    reels: {
        name: "reels", width: 1080, height: 1920, fps: 30, aspect: "9:16",
        codec: "h264", audioCodec: "aac", loudnessTarget: -14, safeBottom: 0.18,
        note: "Instagram Reels: 9:16, keep captions above the bottom UI."
    },
    shorts: {
        name: "shorts", width: 1080, height: 1920, fps: 30, aspect: "9:16",
        codec: "h264", audioCodec: "aac", loudnessTarget: -14, safeBottom: 0.18,
        note: "YouTube Shorts: 9:16, leave room for the title and controls."
    },
    tiktok: {
        name: "tiktok", width: 1080, height: 1920, fps: 30, aspect: "9:16",
        codec: "h264", audioCodec: "aac", loudnessTarget: -14, safeBottom: 0.22,
        note: "TikTok: 9:16, reserve more height for the caption and buttons."
    },
    youtube: {
        name: "youtube", width: 1920, height: 1080, fps: 30, aspect: "16:9",
        codec: "h264", audioCodec: "aac", loudnessTarget: -14, safeBottom: 0.08,
        note: "YouTube landscape: 16:9, -14 LUFS integrated."
    }
};

/** True when a value is one of the four preset names. */
export function isPreset(value: string): value is ExportPreset["name"] {
    return value in ExportPresets;
}
