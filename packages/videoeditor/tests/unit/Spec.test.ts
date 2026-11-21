import { describe, expect, it } from "vitest";

import { VideoEditorError } from "../../src/core/Errors";
import { addMusic, addScene, assertValid, defaultSpec, totalDuration, validate } from "../../src/session/Spec";

describe("timeline spec", () => {
    it("starts empty and adds scenes and music without mutating", () => {
        const base = defaultSpec("demo");
        const withScene = addScene(base, { source: "a.mp4", duration: 4, text: "Hello" });
        const withMusic = addMusic(withScene, { source: "m.mp3", volume: 0.4 });

        expect(base.scenes).toHaveLength(0);
        expect(withScene.scenes[0]?.duration).toBe(4);
        expect(withScene.scenes[0]?.text?.[0]?.value).toBe("Hello");
        expect(withMusic.music?.[0]?.volume).toBe(0.4);
        expect(totalDuration(withMusic)).toBe(4);
        expect(validate(withMusic)).toEqual([]);
    });

    it("reports invalid scenes instead of throwing from validate", () => {
        const spec = defaultSpec();
        spec.scenes = [{ id: "x", source: "", duration: 0 }];

        expect(validate(spec).length).toBeGreaterThan(1);
        expect(() => assertValid(spec)).toThrow(VideoEditorError);
    });

    it("rejects an empty timeline when asserting", () => {
        expect(() => assertValid(defaultSpec())).toThrow(/no scenes/);
    });
});
