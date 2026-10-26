import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { Auth, Ids, Paths } from "../../src/core";
import { parseArgv } from "../../src/cli";
import { TemplateApply } from "../../src/templates";
import { Directions } from "../../src/design";
import { Techniques } from "../../src/techniques";
import { ArtworkCategory, VisualDirection } from "../../src/core";
import { HtmlDocument } from "../../src/renderer";
import { ProjectContext } from "../../src/session";
import { Commands } from "../../src/commands";
import { QualityStandard } from "../../src/design";

const temps: string[] = [];

afterEach(() => {
    temps.length = 0;
});

describe("Ids and paths", () => {
    it("slugs titles and confines paths", () => {
        expect(Ids.slug("The Quiet Issue!")).toBe("the-quiet-issue");
        const root = mkdtempSync(join(tmpdir(), "ad-"));
        temps.push(root);
        expect(() => Paths.confine(root, join(root, "..", "escape"))).toThrow();
        expect(Paths.confine(root, "ok.html")).toContain("ok.html");
    });

    it("creates a studio token", () => {
        const root = mkdtempSync(join(tmpdir(), "ad-"));
        const token = Auth.loadOrCreate(root);
        expect(token.length).toBeGreaterThan(16);
        expect(Auth.loadOrCreate(root)).toBe(token);
        expect(() => Auth.assert(root, "nope")).toThrow();
        Auth.assert(root, token);
    });
});

describe("CLI parse", () => {
    it("reads command and flags", () => {
        const parsed = parseArgv(["export", "--id", "editorial", "--format=png", "--json"]);
        expect(parsed.command).toBe("export");
        expect(parsed.flags.id).toBe("editorial");
        expect(parsed.flags.format).toBe("png");
        expect(parsed.flags.json).toBe(true);
    });
});

describe("templates and techniques", () => {
    it("fills tokens and picks infographic techniques", () => {
        const html = TemplateApply.fill("<h1>{{title}}</h1>", { title: "Hello" });
        expect(html).toBe("<h1>Hello</h1>");
        expect(Techniques.forBrief(ArtworkCategory.INFOGRAPHIC).id).toBe("infographic");
        expect(Directions.suggest("promotion")[0]?.id).toBe(VisualDirection.BOLD_PROMOTIONAL);
    });
});

describe("HTML document", () => {
    it("reads artboard dimensions", () => {
        const html = HtmlDocument.artboard({
            title: "t",
            width: 1200,
            height: 630,
            css: "",
            body: "<h1>Hi</h1>"
        });
        expect(HtmlDocument.dimensions(html)).toEqual({
            width: 1200,
            height: 630
        });
        expect(HtmlDocument.fragments(html).html).toContain("Hi");
    });
});

describe("project context", () => {
    it("init, brief, shape, variants, resume", () => {
        const root = mkdtempSync(join(tmpdir(), "ad-"));
        const ctx = ProjectContext.create({
            name: "Northfold",
            root,
            brief: { goal: "Poster" }
        });
        ctx.patchBrief({ audience: "members" });
        ctx.selectDirection(VisualDirection.EDITORIAL_TYPOGRAPHIC);
        const htmlPath = ".artdirector/variants/a/artwork.html";
        mkdirSync(join(root, ".artdirector", "variants", "a"), { recursive: true });
        writeFileSync(join(root, ".artdirector", "variants", "a", "artwork.html"), "<html></html>");
        ctx.upsertVariant({
            id: "a",
            title: "A",
            direction: VisualDirection.EDITORIAL_TYPOGRAPHIC,
            status: "draft" as never,
            createdAt: new Date().toISOString(),
            htmlPath,
            width: 100,
            height: 100
        });
        const opened = ProjectContext.open(root);
        expect(opened.project().brief.audience).toBe("members");
        expect(opened.project().selectedDirection).toBe(VisualDirection.EDITORIAL_TYPOGRAPHIC);
        expect(opened.variants()).toHaveLength(1);
        expect(Commands.isCommand("live")).toBe(true);
    });
});

describe("quality floor", () => {
    it("forbids generative image APIs", () => {
        expect(QualityStandard.never.join(" ")).toMatch(/Generative image/);
        expect(QualityStandard.never.join(" ")).not.toMatch(/use DALL-E to fill/);
    });
});
