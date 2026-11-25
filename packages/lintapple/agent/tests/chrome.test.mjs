import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { measureChrome } from "../scripts/chrome.mjs";
import { DEFAULTS, loadPlaywright } from "../scripts/probe.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const playwright = await loadPlaywright(join(here, ".."), join(here, "..", ".."));

let browser = null;
try {
    browser = await playwright?.chromium.launch();
} catch {
    browser = null;
}

describe("app shell probe", { skip: browser ? false : "Chromium for Playwright is not installed" }, () => {
    const probe = async (name) => {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.goto(pathToFileURL(join(here, "fixtures", name)).href);
        const findings = await page.evaluate(measureChrome, { ignore: DEFAULTS.ignore });
        await page.close();
        return findings;
    };

    it("finds a create row styled as an item, the user as text, and hand-drawn icons as a suggestion", async () => {
        const findings = await probe("chrome-slop.html");
        const rule = (name) => findings.find((finding) => finding.rule === name);
        assert.match(rule("create-as-item")?.actual ?? "", /^"Novo perfil" is styled like the 3 items/);
        assert.match(rule("user-as-text")?.actual ?? "", /the name "Gio" and a "Sair" text link/);
        assert.equal(rule("icon-source")?.suggestion, true);
        assert.equal(findings.length, 3);
    });

    it("leaves a + button in the list header, an avatar with an icon sign-out, and library icons alone", async () => {
        assert.deepEqual(await probe("chrome-clean.html"), []);
    });

    it("closes the browser", async () => {
        await browser.close();
    });
});
