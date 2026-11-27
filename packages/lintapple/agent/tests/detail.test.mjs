import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { measureDetail } from "../scripts/detail.mjs";
import { DEFAULTS, loadPlaywright } from "../scripts/probe.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const playwright = await loadPlaywright(join(here, ".."), join(here, "..", ".."));

let browser = null;
try {
    browser = await playwright?.chromium.launch();
} catch {
    browser = null;
}

describe("detail page probe", { skip: browser ? false : "Chromium for Playwright is not installed" }, () => {
    const probe = async (name) => {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.goto(pathToFileURL(join(here, "fixtures", name)).href);
        const findings = await page.evaluate(measureDetail, { ignore: DEFAULTS.ignore });
        await page.close();
        return findings;
    };

    it("finds status actions apart, controls under the title, a refresh note, repeated values, stacked empty panels, and cut values", async () => {
        const findings = await probe("detail-slop.html");
        const rule = (name) => findings.find((finding) => finding.rule === name);
        assert.match(rule("status-actions-apart")?.actual ?? "", /\(Concluir, Cancelar\)/);
        assert.match(rule("header-controls-below-title")?.actual ?? "", /^4 status or action controls/);
        assert.match(rule("behavior-footnote")?.actual ?? "", /a cada 5 segu/);
        assert.match(rule("repeated-value")?.actual ?? "", /"paseo-pentest-local" 3x, "paseo-pentest-coordinator" 2x/);
        assert.match(rule("stacked-output-panels")?.actual ?? "", /Resultado, Atualizações da tarefa/);
        assert.match(rule("truncated-without-tooltip")?.actual ?? "", /^2 value/);
        assert.equal(findings.length, 6);
    });

    it("leaves a one-row header with an actions menu, tabs, one card per fact, and full values alone", async () => {
        assert.deepEqual(await probe("detail-clean.html"), []);
    });

    it("does not count a per-item fact in list cards as a repeated value", async () => {
        for (const name of ["auction.html", "bidding.html", "list-noise.html", "filters-dup.html"]) {
            assert.ok(!(await probe(name)).some((finding) => finding.rule === "repeated-value"), name);
        }
    });

    it("finds empty states written in different patterns, and accepts one pattern", async () => {
        const slop = (await probe("empty-copy.html")).find((finding) => finding.rule === "inconsistent-empty-copy");
        assert.match(slop?.actual ?? "", /2 openings \("sem", "nenhum"\); lengths from 3 to 6 words/);
        assert.ok(!(await probe("empty-copy-clean.html")).some((finding) => finding.rule === "inconsistent-empty-copy"));
    });

    it("finds a text field whose allowed values are listed under it, and leaves a select alone", async () => {
        const enums = (await probe("enum-field.html")).filter((finding) => finding.rule === "enum-as-text");
        assert.equal(enums.length, 1);
        assert.match(enums[0].actual, /play_pause · next · previous · volume_up/);
        assert.match(enums[0].items[0].selector, /input#key/);
    });

    it("finds a form result left as a loose line of text, and leaves a tied field error and a toast alone", async () => {
        const errors = (await probe("login-error.html")).filter((finding) => finding.rule === "loose-form-error");
        assert.equal(errors.length, 1);
        assert.match(errors[0].actual, /"E-mail ou senha incorretos\."/);
        assert.match(errors[0].items[0].selector, /form#slop/);
        assert.equal(errors[0].items.length, 1);
    });

    it("closes the browser", async () => {
        await browser.close();
    });
});
