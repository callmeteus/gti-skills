import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { measureHover } from "../scripts/hover.mjs";
import { DEFAULTS, loadPlaywright } from "../scripts/probe.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const playwright = await loadPlaywright(join(here, ".."), join(here, "..", ".."));

let browser = null;
try {
    browser = await playwright?.chromium.launch();
} catch {
    browser = null;
}

describe("hover probe", { skip: browser ? false : "Chromium for Playwright is not installed" }, () => {
    const probe = async (name, viewport = { width: 1440, height: 900 }) => {
        const page = await browser.newPage({ viewport });
        await page.goto(pathToFileURL(join(here, "fixtures", name)).href);
        const findings = await page.evaluate(measureHover, { ignore: DEFAULTS.ignore });
        await page.close();
        return findings;
    };

    it("finds clickable elements with no hover change and with the arrow cursor", async () => {
        const findings = await probe("hover-slop.html");
        const hover = findings.find((finding) => finding.rule === "no-hover-state");
        const cursor = findings.find((finding) => finding.rule === "no-pointer-cursor");
        assert.match(hover?.actual ?? "", /^3 of 4 clickable/);
        assert.ok(!hover.items.some((item) => /Docs/.test(item.selector)), "a link with a hover rule is not flagged");
        assert.match(cursor?.actual ?? "", /^2 clickable element\(s\) keep the arrow cursor/);
        assert.deepEqual(cursor.items.map((item) => item.selector.split(" ")[0]).sort(), ["button#save", "div#tile"]);
    });

    it("accepts hover rules in media queries, on a hovered parent, and in escaped utility classes", async () => {
        assert.deepEqual(await probe("hover-clean.html"), []);
    });

    it("does not check hover on a phone-sized viewport", async () => {
        assert.deepEqual(await probe("hover-slop.html", { width: 390, height: 844 }), []);
    });

    it("closes the browser", async () => {
        await browser.close();
    });
});
