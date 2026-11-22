import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { ArtworkAudit } from "../../src/audit";
import { UnifiedRenderer } from "../../src/renderer";

const dir = mkdtempSync(join(tmpdir(), "ad-audit-"));
const renderer = new UnifiedRenderer();

afterAll(async () => {
    await renderer.close();
});

/**
 * Writes a 1080x1080 board with the given body and styles, then audits it.
 */
async function audit(name: string, css: string, body: string) {
    const file = join(dir, `${name}.html`);
    writeFileSync(file, `<!DOCTYPE html><html><head><style>
        @font-face { font-family: Test; src: local("Arial"); }
        body { margin: 0; }
        .artboard { position: relative; width: 1080px; height: 1080px; overflow: hidden; font-family: Arial, sans-serif; }
        ${css}
    </style></head><body><div class="artboard" data-artdirector-root data-width="1080" data-height="1080">${body}</div></body></html>`);
    const report = await ArtworkAudit.run(file, { width: 1080, height: 1080 }, renderer);
    return report.findings;
}

describe("audit: default house moves", () => {
    it("warns when a board stacks the moves that make every piece look alike", async () => {
        const findings = await audit("template", `
            .artboard { background: #0e0b0a; }
            .glow { position: absolute; inset: 0; background: radial-gradient(circle at 80% 20%, #6b2a14, transparent 60%); }
            .ghost { position: absolute; right: 60px; top: 0; font-size: 420px; color: transparent; -webkit-text-stroke: 2px rgba(255,255,255,.2); }
            .pill { position: absolute; left: 64px; top: 64px; height: 48px; padding: 0 24px; border-radius: 999px; background: #ff5a2a; line-height: 48px; }
            .kicker { position: absolute; left: 64px; top: 300px; font: 24px "Courier New", monospace; letter-spacing: .4em; color: #f4b; }
            .side { position: absolute; right: 30px; top: 500px; transform: rotate(90deg); font: 18px Arial; color: #888; }
            .meta { position: absolute; left: 64px; bottom: 80px; font-size: 28px; color: #fff; }
            .ticket { position: absolute; left: 64px; top: 640px; width: 380px; height: 180px; background: #f3efe6; box-shadow: 14px 14px 0 #ff5a2a; }
        `, `<div class="glow"></div><div class="ghost">27</div><div class="pill">LIVE DE VENDAS</div>
            <p class="kicker">VEM PRA</p><p class="side">FURZUÊ 2027</p><p class="meta">link fixado no chat · te vejo lá</p><div class="ticket"></div>`);

        const house = findings.find((item) => item.id === "house-style");
        expect(house?.severity).toBe("warn");
        expect(house?.message).toMatch(/letter-spaced monospace labels/);
        expect(house?.message).toMatch(/small vertical text along a side edge/);
        expect(house?.message).toMatch(/giant faded or outlined word/);
        expect(house?.message).toMatch(/hard offset shadow/);
        expect(house?.message).toMatch(/dot-separated/);
        expect(house?.message).toMatch(/near-black field with a radial glow/);
    });

    it("stays quiet on a board built around a hero image and plain type", async () => {
        const findings = await audit("clean", `
            .artboard { background: #ff3d8b; }
            .hero { position: absolute; right: 0; bottom: 0; width: 620px; height: 760px; background: #ffd23f; }
            h1 { position: absolute; left: 64px; top: 80px; margin: 0; font-size: 150px; color: #fff; }
        `, `<div class="hero"></div><h1>TEMOS<br>O HOTEL</h1>`);

        expect(findings.some((item) => item.id === "house-style")).toBe(false);
    });
});

describe("audit: text inside shapes", () => {
    const star = "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";

    it("fails when a clip-path starburst cuts its own text", async () => {
        const findings = await audit("clipped", `
            .burst { position: absolute; left: 700px; top: 700px; width: 280px; height: 280px; background: #ffe14d; clip-path: ${star};
                display: grid; place-items: center; font: 900 64px Arial; }
        `, `<div class="burst">É OFICIAL!</div>`);

        expect(findings.find((item) => item.id === "shape-clip")?.severity).toBe("error");
    });

    it("warns when text runs past an SVG starburst drawn behind it", async () => {
        const findings = await audit("spill", `
            .seal { position: absolute; left: 700px; top: 700px; width: 280px; height: 280px; }
            .seal svg { position: absolute; inset: 0; }
            .seal p { position: absolute; inset: 0; margin: 0; display: grid; place-items: center; font: 900 60px Arial; }
        `, `<div class="seal"><svg viewBox="0 0 100 100" width="280" height="280"><polygon fill="#ffe14d" points="50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35"/></svg><p>OFICIAL!</p></div>`);

        expect(findings.find((item) => item.id === "shape-spill")?.severity).toBe("warn");
    });

    it("accepts text that sits well inside its shape", async () => {
        const findings = await audit("fits", `
            .seal { position: absolute; left: 640px; top: 640px; width: 360px; height: 360px; border-radius: 50%; background: #ffe14d; clip-path: circle(50%);
                display: grid; place-items: center; font: 900 40px Arial; }
        `, `<div class="seal">É OFICIAL!</div>`);

        expect(findings.some((item) => item.id === "shape-clip" || item.id === "shape-spill")).toBe(false);
    });
});
