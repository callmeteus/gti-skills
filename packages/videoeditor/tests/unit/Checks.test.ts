import { describe, expect, it } from "vitest";

import { aspectOf, compareCheck, fpsNumber, sizeOf } from "../../src/core/Checks";

describe("compareCheck", () => {
    it("reports ok when expected and measured match", () => {
        const result = compareCheck("size", "1080x1920", "1080x1920");
        expect(result.ok).toBe(true);
        expect(result.measured).toBe("1080x1920");
    });

    it("reports ok false when expected and measured differ", () => {
        const result = compareCheck("output size", "1080x1920", "608x1920");
        expect(result.ok).toBe(false);
        expect(result.expected).toBe("1080x1920");
        expect(result.measured).toBe("608x1920");
    });

    it("applies numeric tolerance for durations and aspects", () => {
        expect(compareCheck("duration", 3, 3.1, { tolerance: 0.35 }).ok).toBe(true);
        expect(compareCheck("duration", 3, 3.5, { tolerance: 0.35 }).ok).toBe(false);
        expect(compareCheck("aspect", 0.5625, 0.5626, { tolerance: 0.005625 }).ok).toBe(true);
        expect(compareCheck("aspect", 0.5625, 0.58, { tolerance: 0.005625 }).ok).toBe(false);
    });

    it("parses ffprobe values for size, fps, and aspect", () => {
        const caps = { width: 1280, height: 720, fps: "30000/1001", videoCodec: "h264" };
        expect(sizeOf(caps)).toBe("1280x720");
        expect(fpsNumber(caps.fps)).toBeCloseTo(29.97, 2);
        expect(aspectOf(caps)).toBeCloseTo(1.7778, 3);
    });
});
