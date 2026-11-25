import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { measureDashboard } from "../scripts/dashboard.mjs";
import { DEFAULTS, loadPlaywright } from "../scripts/probe.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const playwright = await loadPlaywright(join(here, ".."), join(here, "..", ".."));

let browser = null;
try {
    browser = await playwright?.chromium.launch();
} catch {
    browser = null;
}

describe("dashboard probe", { skip: browser ? false : "Chromium for Playwright is not installed" }, () => {
    const probe = async (name) => {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.goto(pathToFileURL(join(here, "fixtures", name)).href);
        const findings = await page.evaluate(measureDashboard, { ignore: DEFAULTS.ignore });
        await page.close();
        return findings;
    };

    it("finds bare KPI cards, too many KPIs, an unlabeled chart, arrow suffixes, and an accented word", async () => {
        const findings = await probe("dashboard-slop.html");
        const rule = (name) => findings.find((finding) => finding.rule === name);
        assert.match(rule("kpi-without-context")?.actual ?? "", /^9 of 9 KPI card/);
        assert.match(rule("too-many-kpis")?.actual ?? "", /^9 KPI cards/);
        assert.match(rule("chart-without-labels")?.items[0].selector ?? "", /svg#bars/);
        assert.match(rule("arrow-suffix")?.actual ?? "", /^2 links/);
        assert.match(rule("accent-word")?.items[0].selector ?? "", /h1/);
        assert.equal(findings.length, 5);
    });

    it("leaves KPI cards with comparisons, a labeled chart, and plain links alone", async () => {
        assert.deepEqual(await probe("dashboard-clean.html"), []);
    });

    it("closes the browser", async () => {
        await browser.close();
    });
});
