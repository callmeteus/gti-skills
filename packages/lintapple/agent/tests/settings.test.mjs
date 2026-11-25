import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { DEFAULTS, loadPlaywright } from "../scripts/probe.mjs";
import { measureSettings } from "../scripts/settings.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const playwright = await loadPlaywright(join(here, ".."), join(here, "..", ".."));

let browser = null;
try {
    browser = await playwright?.chromium.launch();
} catch {
    browser = null;
}

describe("settings page probe", { skip: browser ? false : "Chromium for Playwright is not installed" }, () => {
    const probe = async (name) => {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.goto(pathToFileURL(join(here, "fixtures", name)).href);
        const findings = await page.evaluate(measureSettings, { ignore: DEFAULTS.ignore });
        await page.close();
        return findings;
    };

    it("finds sections of different widths, a language picker of buttons, and a device set up in another card", async () => {
        const findings = await probe("settings-slop.html");
        const rule = (name) => findings.filter((finding) => finding.rule === name);
        assert.equal(rule("ragged-stack").length, 1);
        assert.match(rule("ragged-stack")[0].actual, /^4 boxed sections stacked in one column/);
        assert.equal(rule("language-as-buttons").length, 1);
        assert.match(rule("language-as-buttons")[0].actual, /English, Português \(Brasil\)/);
        assert.equal(rule("option-apart-from-settings").length, 1);
        assert.match(rule("option-apart-from-settings")[0].actual, /"Stream Deck Mobile" is chosen in one place and set up in a separate "Stream Deck Mobile" section/);
        assert.equal(findings.length, 3);
    });

    it("leaves a settings grid with equal sections, a language select, and one device row alone", async () => {
        assert.deepEqual(await probe("settings-clean.html"), []);
    });

    it("closes the browser", async () => {
        await browser.close();
    });
});
