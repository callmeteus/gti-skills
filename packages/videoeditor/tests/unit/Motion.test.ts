import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { DefaultBrand, brandCss, fillTokens } from "../../src/motion/brand";
import { StyleGuides, styleById } from "../../src/motion/styles";
import { Templates, compose, templateById } from "../../src/motion/templates";
import { build } from "../../src/ffmpeg/Planner";
import { defaultSpec } from "../../src/session/Spec";

const canvas = { width: 1080, height: 1920, duration: 1, fps: 30 };

describe("motion templates", () => {
    it("ships at least six original parameterized templates", () => {
        expect(Templates.length).toBeGreaterThanOrEqual(6);
        expect(templateById("lower-third")).toBeDefined();
        expect(templateById("vertical-hook")).toBeDefined();
    });

    it("produces a deterministic composition with a seek function", () => {
        const html = compose("lower-third", { TEXT: "Ada" }, DefaultBrand, canvas);

        expect(html).toContain("window.__seek");
        expect(html).toContain("window.__ready=true");
        expect(html).toContain("Ada");
        expect(html).toContain(`data-width="${canvas.width}"`);
        expect(html).toContain(`data-duration="${canvas.duration}"`);
        expect(compose("lower-third", { TEXT: "Ada" }, DefaultBrand, canvas)).toBe(html);
    });

    it("escapes copy and injects brand variables", () => {
        const html = compose("title-card", { TITLE: "<script>x</script>" }, DefaultBrand, canvas);

        expect(html).not.toContain("<script>x</script>");
        expect(html).toContain("&lt;script&gt;");
        expect(brandCss(DefaultBrand)).toContain("--brand-primary:");
        expect(fillTokens("Hi {{NAME}}", { NAME: "Ada" })).toBe("Hi Ada");
    });

    it("rejects an unknown template", () => {
        expect(() => compose("nope", {}, DefaultBrand, canvas)).toThrow(/Unknown motion template/);
    });
});

describe("motion style guides", () => {
    it("ships at least six guides with frontmatter and do and dont rules", () => {
        expect(StyleGuides.length).toBeGreaterThanOrEqual(6);
        for (const guide of StyleGuides) {
            expect(guide.content.startsWith("---\n")).toBe(true);
            expect(guide.content).toContain("## Do");
            expect(guide.content).toContain("## Do not");
            expect(guide.easing).not.toBe("");
        }
    });

    it("finds a guide by id", () => {
        expect(styleById("kinetic-type")?.name).toBe("Kinetic Type");
    });
});

describe("motion overlay planning", () => {
    it("composites a timed overlay onto the scene output", () => {
        const spec = defaultSpec("motion");
        spec.scenes = [{ id: "s1", source: "a.mp4", duration: 3, volume: 0 }];
        spec.overlays = [{ id: "m1", source: "overlay.webm", at: 1, duration: 1.5 }];
        const caps = new Map([
            [resolve("a.mp4"), { path: resolve("a.mp4"), exists: true, kind: "video" as const, hasVideo: true, hasAudio: false }],
            [resolve("overlay.webm"), { path: resolve("overlay.webm"), exists: true, kind: "video" as const, hasVideo: true, hasAudio: false }]
        ]);
        const plan = build(spec, caps, resolve("out.mp4"), process.cwd(), process.cwd());

        expect(plan.filterGraph).toContain("format=rgba");
        expect(plan.filterGraph).toContain("overlay=");
        expect(plan.filterGraph).toContain("between(t,1,2.5)");
        expect(plan.videoMap).toBe("[mout0]");
    });
});
