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

    it("finds headings and short text that repeat the heading above them", async () => {
        const findings = (await probeFixture("headings.html")).filter((finding) => finding.rule === "repeated-heading");
        const actual = findings.map((finding) => finding.actual).join(" | ");
        assert.equal(findings.length, 3, actual);
        assert.match(actual, /restates the heading above it \(shared: leilao\)/);
        assert.match(actual, /"So participantes"|"Só participantes"/);
        assert.match(actual, /two headings read "Regras"/);
        assert.doesNotMatch(actual, /caneca|poster|pôster/);
    });

    it("leaves a page title, its card titles, and distinct headings alone", async () => {
        const findings = await probeFixture("headings-clean.html");
        assert.ok(!findings.some((finding) => finding.rule === "repeated-heading"), JSON.stringify(findings.filter((finding) => finding.rule === "repeated-heading")));
    });

    it("finds a large block with different space above and below it", async () => {
        const findings = (await probeFixture("map-gap.html")).filter((finding) => finding.rule === "uneven-gap");
        assert.equal(findings.length, 1, JSON.stringify(findings));
        assert.match(findings[0].actual, /^56px above the block and 12px below it$/);
        assert.match(findings[0].items[1].selector, /section#broken > div\.map-card/);
    });

    it("finds list text repeated in every item, underlined chips and metadata, and filters that outweigh the list", async () => {
        const findings = await probeFixture("list-noise.html");
        const rules = (rule) => findings.filter((finding) => finding.rule === rule);
        assert.equal(rules("repeated-item-text").length, 1);
        assert.match(rules("repeated-item-text")[0].actual, /"attendees only"/);
        assert.match(rules("repeated-item-text")[0].actual, /"this auction is for attendees/);
        assert.doesNotMatch(rules("repeated-item-text")[0].actual, /current bid/);
        assert.deepEqual(rules("underlined-control").map((finding) => finding.actual.split(" ").slice(1, 3).join(" ")), ["chip(s) or", "short underlined"]);
        assert.match(rules("filters-outweigh-items")[0]?.actual ?? "", /^5 filter chips or links for 2 item\(s\)$/);
    });

    it("leaves a list with one notice, plain metadata, and no filters alone", async () => {
        const findings = await probeFixture("list-calm.html");
        const noisy = findings.filter((finding) => ["repeated-item-text", "underlined-control", "filters-outweigh-items"].includes(finding.rule));
        assert.deepEqual(noisy, []);
    });

    it("finds duplicate filters, filters that repeat the sections, and filter links inside items", async () => {
        const findings = await probeFixture("filters-dup.html");
        const duplicates = findings.filter((finding) => finding.rule === "duplicate-filter").map((finding) => finding.actual);
        assert.equal(duplicates.length, 2, duplicates.join(" | "));
        assert.match(duplicates[0], /"Online" and "Pagamento online"/);
        assert.match(duplicates[1], /"Só participantes"/);
        const links = findings.filter((finding) => finding.rule === "filter-link-in-item");
        assert.equal(links.length, 1, JSON.stringify(links));
        assert.match(links[0].actual, /^2 link/);
    });

    it("allows a compact row of select filters on a short list, but still finds duplicates in it", async () => {
        const findings = await probeFixture("filters-selects.html");
        assert.ok(!findings.some((finding) => finding.rule === "filters-outweigh-items"));
        const duplicates = findings.filter((finding) => finding.rule === "duplicate-filter").map((finding) => finding.actual);
        assert.equal(duplicates.length, 2, duplicates.join(" | "));
        assert.match(duplicates[0], /"Online" and "Pagamento online"/);
        assert.match(duplicates[1], /"Só participantes"/);
        assert.match(findings.find((finding) => finding.rule === "duplicate-filter").items[0].selector, /select/);
    });

    it("leaves a full-bleed band inside a card off the lane check", async () => {
        const findings = await probeFixture("card-band.html");
        assert.deepEqual(findings.filter((finding) => finding.rule === "off-lane"), []);
    });

    it("closes the browser", async () => {
        await browser.close();
    });
});
