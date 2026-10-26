import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { Paths } from "../../src/core";
import { DemoWorkflow } from "../../src/demo";
import { TemplateCatalog } from "../../src/templates";

describe("skill", () => {
    it("ships one unified skill that forbids generative images", () => {
        const text = readFileSync(join(Paths.skillDir(), "SKILL.md"), "utf8");
        expect(text).toContain("name: artdirector");
        expect(text.toLowerCase()).toContain("never call dall-e");
        expect(text).toMatch(/scripts[/\\]artdirector\.cmd/);
        expect(text).toContain("Do not search npm");
        expect(text).toContain("Ship first");
        expect(text).toContain("Do not audit");
        expect(text).toContain("Story (1080×1920)");
        expect(text).not.toMatch(/```(?:bash|powershell)\n(?:npx artdirector)/);
        expect(text).not.toContain("/ht-infographic");
    });

    it("runs the skill wrapper without searching npm", () => {
        const out = execFileSync(process.execPath, [
            join(Paths.skillDir(), "scripts", "artdirector.mjs"),
            "help"
        ], {
            encoding: "utf8"
        });
        expect(out).toContain("ArtDirector");
        expect(out).toContain("studio");
    });

    it("requires the language Core Rule and links every reference", () => {
        const text = readFileSync(join(Paths.skillDir(), "SKILL.md"), "utf8");
        expect(text).toMatch(/respond in the user's language/i);

        for (const match of text.matchAll(/\]\((references\/[^)#]+)\)/g)) {
            expect(existsSync(join(Paths.skillDir(), match[1] ?? ""))).toBe(true);
        }
    });
});

describe("templates", () => {
    it("loads the library catalog", () => {
        const ids = TemplateCatalog.list().map((item) => item.id);
        expect(ids).toContain("social-post");
        expect(ids).toContain("infographic");
        expect(ids).toContain("cover");
        expect(ids).toContain("story");
        expect(TemplateCatalog.read("story").formatId).toBe("story");
        expect(TemplateCatalog.read("story").html).toMatch(/font-size:\s*200px/);
        expect(TemplateCatalog.read("story").html).toContain("flex-direction: column");
    });
});

describe("demo workflow", () => {
    it("runs init through accept without rasterizing", async () => {
        const dest = mkdtempSync(join(tmpdir(), "ad-demo-"));
        const result = await DemoWorkflow.run(dest, false);
        expect(result.variants).toHaveLength(3);
        expect(result.acceptedId).toBe("editorial");
        expect(result.liveEdit).toMatch(/Kicker/);
        const html = readFileSync(result.variants[0]?.htmlPath ?? "", "utf8");
        expect(html).toContain("accepted live");
        expect(html).toContain("data-artdirector-root");
        expect(html.toLowerCase()).not.toContain("dall-e");
    });
});
