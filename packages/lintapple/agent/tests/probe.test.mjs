import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { DEFAULTS, loadPlaywright, measurePage } from "../scripts/probe.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = pathToFileURL(join(here, "fixtures", "city-guide.html")).href;
const playwright = await loadPlaywright(join(here, ".."), join(here, "..", ".."));

let browser = null;
try {
    browser = await playwright?.chromium.launch();
} catch {
    browser = null;
}

describe("layout probe", { skip: browser ? false : "Chromium for Playwright is not installed" }, () => {
    const probe = async () => {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.goto(fixture);
        const result = await page.evaluate(measurePage, { near: DEFAULTS.near, lane: DEFAULTS.lane, ignore: DEFAULTS.ignore });
        await page.close();
        return result.findings;
    };
    const ids = (finding) => finding.items.map((item) => item.selector);

    it("finds each planted layout problem once", async () => {
        const findings = await probe();
        const count = (rule) => findings.filter((finding) => finding.rule === rule).length;
        assert.equal(count("near-miss-edge"), 1);
        assert.equal(count("off-lane"), 1);
        assert.equal(count("ragged-wrap"), 1);
        assert.equal(count("curved-accent"), 2);
        assert.equal(count("nested-accent"), 1);
        assert.match(ids(findings.find((finding) => finding.rule === "near-miss-edge")).join(" "), /div#map/);
        assert.match(ids(findings.find((finding) => finding.rule === "off-lane"))[0], /div\.price/);
        assert.match(ids(findings.find((finding) => finding.rule === "ragged-wrap"))[0], /div#chips/);
    });

    it("leaves aligned blocks, chips, and plain cards alone", async () => {
        const findings = await probe();
        const flagged = findings.flatMap(ids).join(" ");
        assert.doesNotMatch(flagged, /div#clean/);
        assert.doesNotMatch(flagged, /div\.search/);
        assert.ok(!findings.some((finding) => finding.rule === "off-lane" && /div\.chip/.test(ids(finding)[0])));
    });

    it("flags rendered colors that match no token, and only those", async () => {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.goto(pathToFileURL(join(here, "fixtures", "tokens.html")).href);
        const result = await page.evaluate(measurePage, { near: DEFAULTS.near, lane: DEFAULTS.lane, ignore: DEFAULTS.ignore });
        await page.close();
        const colors = result.findings.filter((finding) => finding.rule === "off-token-color");
        assert.equal(result.tokens, 7);
        assert.deepEqual(colors.map((finding) => finding.actual.split(" ")[0]), ["rgb(124,58,237)", "rgb(249,115,22)"]);
    });

    it("skips the color check with a note when the page defines no tokens", async () => {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.goto(fixture);
        const result = await page.evaluate(measurePage, { near: DEFAULTS.near, lane: DEFAULTS.lane, ignore: DEFAULTS.ignore });
        await page.close();
        assert.ok(!result.findings.some((finding) => finding.rule === "off-token-color"));
        assert.match(result.notes.join(" "), /No color tokens/);
    });

    const probeFixture = async (name) => {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.goto(pathToFileURL(join(here, "fixtures", name)).href);
        const result = await page.evaluate(measurePage, { near: DEFAULTS.near, lane: DEFAULTS.lane, ignore: DEFAULTS.ignore });
        await page.close();
        return result.findings;
    };

    it("finds parts of side by side instances at different heights, and names the cause", async () => {
        const findings = await probeFixture("auction.html");
        const parts = findings.filter((finding) => finding.rule === "misaligned-parts");
        assert.equal(parts.length, 1);
        assert.match(parts[0].items[0].selector, /div#broken > div\.lot > div\.bid/);
        assert.match(parts[0].actual, /div\.tags/);
        assert.doesNotMatch(findings.flatMap(ids).join(" "), /div#fixed/);
    });

    it("finds forms repeated in list items and competing filled buttons", async () => {
        const findings = await probeFixture("bidding.html");
        const forms = findings.filter((finding) => finding.rule === "repeated-form");
        const primaries = findings.filter((finding) => finding.rule === "competing-primaries");
        assert.equal(forms.length, 1);
        assert.match(forms[0].actual, /^3 items/);
        assert.equal(primaries.length, 1);
        assert.doesNotMatch(findings.flatMap(ids).join(" "), /div#calm/);
        assert.ok(!findings.some((finding) => finding.rule === "off-lane"));
    });

    it("closes the browser", async () => {
        await browser.close();
    });
});
