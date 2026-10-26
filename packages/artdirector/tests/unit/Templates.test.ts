import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { DefaultBrandColors, DefaultProjectName, type BrandContext, type CreativeBrief } from "../../src/core";
import { HtmlDocument } from "../../src/renderer";
import { Effects, TemplateApply } from "../../src/templates";

const Brand: BrandContext = {
    name: DefaultProjectName,
    logos: [],
    references: [],
    fonts: { display: "Fraunces", body: "IBM Plex Sans" },
    colors: { ...DefaultBrandColors, extra: [] }
};

const Brief: CreativeBrief = { goal: "", constraints: [], copy: {} };

describe("effects", () => {
    it("lists every effect with a summary", () => {
        const effects = Effects.list();
        const ids = effects.map((item) => item.id);

        for (const id of ["artboard", "grain", "paper", "smoke", "duotone", "scrim", "halftone", "cutout", "type-fx", "ornaments", "svg-defs", "fit-text"]) {
            expect(ids).toContain(id);
        }

        for (const effect of effects) {
            expect(effect.summary, effect.id).not.toBe(effect.id);
            expect(effect.source, effect.id).not.toMatch(/<\/style/i);
        }
    });

    it("expands each include once and drops repeats", () => {
        const html = "<style>{{> grain}}\n{{> grain}}</style>";
        const expanded = Effects.expand(html);
        expect(expanded).toContain(".fx-grain::after");
        expect(expanded.match(/\.fx-grain::after/g)).toHaveLength(1);
        expect(Effects.used("{{> grain}} {{> duotone}} {{> grain}}")).toEqual(["grain", "duotone"]);
    });

    it("rejects unknown effects", () => {
        expect(() => Effects.expand("{{> nope}}")).toThrow(/Unknown effect/);
    });
});

describe("template tokens", () => {
    it("uses defaults when a token is missing or empty", () => {
        expect(TemplateApply.fill("{{title|Olá}} {{color|#fff}} {{empty}}", { title: "", color: "#000" })).toBe("Olá #000 ");
        expect(TemplateApply.fill("{{> grain}}", {})).toBe("{{> grain}}");
    });

    it("lists slots with their defaults", () => {
        expect(TemplateApply.slots("{{title|Olá}} {{kicker}} {{title}}")).toEqual({ title: "Olá", kicker: "" });
    });

    it("keeps the template palette and copy until the user sets brand or brief values", () => {
        const untouched = TemplateApply.tokens({ brand: Brand, brief: Brief, formatId: "story" });
        expect(untouched).toEqual({ width: "1080", height: "1920" });

        const custom = TemplateApply.tokens({
            brand: { ...Brand, name: "Loja Aurora", colors: { ...Brand.colors, accent: "#00aa55" } },
            brief: { ...Brief, copy: { title: "Promoção", price: "R$ 49" } },
            formatId: "instagram-square",
            extra: { photo: "x.jpg" }
        });
        expect(custom).toMatchObject({ brandName: "Loja Aurora", accent: "#00aa55", title: "Promoção", price: "R$ 49", photo: "x.jpg" });
        expect(custom.ink).toBeUndefined();
    });
});

describe("local images", () => {
    it("copies referenced photos into the variant and rewrites the paths", () => {
        const workspace = mkdtempSync(join(tmpdir(), "ad-ws-"));
        const variantDir = join(workspace, "variant");
        mkdirSync(join(workspace, "pics"));
        mkdirSync(variantDir);
        writeFileSync(join(workspace, "me.jpg"), "jpg");
        writeFileSync(join(workspace, "pics", "me.jpg"), "other");
        const html = TemplateApply.materialize(
            `<img src="me.jpg"><div style="background: url('pics/me.jpg')"></div><img src="https://x.dev/a.png"><i style="filter: url(#fx-rough)"></i><img src="missing.jpg">`,
            variantDir,
            workspace
        );

        expect(html).toContain(`src="assets/me.jpg"`);
        expect(html).toContain(`url('assets/me-2.jpg')`);
        expect(html).toContain("https://x.dev/a.png");
        expect(html).toContain("url(#fx-rough)");
        expect(html).toContain(`src="missing.jpg"`);
        expect(readFileSync(join(variantDir, "assets", "me-2.jpg"), "utf8")).toBe("other");
        expect(existsSync(join(variantDir, "assets", "me.jpg"))).toBe(true);
    });

    it("copies photos given as absolute paths or file URLs", () => {
        const outside = mkdtempSync(join(tmpdir(), "ad-out-"));
        const variantDir = mkdtempSync(join(tmpdir(), "ad-var-"));
        writeFileSync(join(outside, "a.png"), "a");
        writeFileSync(join(outside, "b.png"), "b");
        const html = TemplateApply.materialize(
            `<img src="${join(outside, "a.png")}"><img src="${pathToFileURL(join(outside, "b.png")).href}">`,
            variantDir,
            variantDir
        );

        expect(html).toBe(`<img src="assets/a.png"><img src="assets/b.png">`);
        expect(readFileSync(join(variantDir, "assets", "b.png"), "utf8")).toBe("b");
    });

    it("inlines local images and effects for rendering, and refuses files outside the root", () => {
        const root = mkdtempSync(join(tmpdir(), "ad-root-"));
        mkdirSync(join(root, "art", "assets"), { recursive: true });
        writeFileSync(join(root, "art", "assets", "p.png"), "png");
        writeFileSync(join(root, "secret.png"), "nope");
        const html = HtmlDocument.prepare(
            `<style>{{> grain}}</style><img src="assets/p.png"><img src="../secret.png">`,
            join(root, "art"),
            join(root, "art")
        );

        expect(html).toContain(`src="data:image/png;base64,${Buffer.from("png").toString("base64")}"`);
        expect(html).toContain(`src="../secret.png"`);
        expect(html).toContain(".fx-grain::after");
    });

    it("maps only relative references", () => {
        const mapped = HtmlDocument.mapLocalReferences(`<img src="a/b.jpg"><img src="/abs.jpg"><img src="data:x">`, (ref) => `/x/${ref}`);
        expect(mapped).toBe(`<img src="/x/a/b.jpg"><img src="/abs.jpg"><img src="data:x">`);
    });
});
