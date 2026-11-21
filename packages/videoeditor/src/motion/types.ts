/** A brand kit read by compositions through CSS variables. */
export interface BrandKit {
    name: string;
    colors: Record<string, string>;
    fonts: Record<string, string>;
    logo?: string;
    tone: string;
}

/** An original starter Motion.md style guide. */
export interface StyleGuide {
    id: string;
    name: string;
    mood: string;
    paletteRoles: string[];
    type: string;
    easing: string;
    durations: string;
    /** paragraphs: two or three bullet lines. */
    do: string[];
    dont: string[];
    content: string;
}

/** A parameterized HTML composition template. */
export interface MotionTemplate {
    id: string;
    title: string;
    description: string;
    /** Tokens the template accepts, for example TEXT, ACCENT. */
    tokens: string[];
    build: (values: Record<string, string>, brand: BrandKit, canvas: { width: number; height: number; duration: number; fps: number }) => string;
}

/** What motion analyze measured from a reference video. */
export interface MotionBrief {
    source: string;
    fps: number;
    duration: number;
    width: number;
    height: number;
    cuts: Array<{ at: number; shot: number; length: number }>;
    motionIntensity: number;
    palette: Array<{ hex: string; share: number }>;
    textHeavy: number[];
    keyframes: string[];
    markdownPath: string;
}
