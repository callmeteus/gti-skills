import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadPlaywright } from "../scripts/probe.mjs";
import { capturePage, compare, summarize } from "../scripts/snapshot.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const playwright = await loadPlaywright(join(here, ".."), join(here, "..", ".."));

let browser = null;
try {
    browser = await playwright?.chromium.launch();
} catch {
    browser = null;
}

describe("before and after snapshot", { skip: browser ? false : "Chromium for Playwright is not installed" }, () => {
    const capture = async (name) => {
        const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
        await page.goto(pathToFileURL(join(here, "fixtures", `snap-${name}.html`)).href);
        const result = await page.evaluate(capturePage);
        await page.close();
        return result;
    };

    it("lists the changed properties of matching elements, even after class names change", async () => {
        const diff = compare(await capture("before"), await capture("after"));
        const save = diff.changed.find((item) => item.key === 'button "Save"');
        assert.ok(save, summarize(diff));
        assert.deepEqual(save.changes.filter((change) => ["radius", "width"].includes(change.property)), [
            { property: "width", before: 72, after: 120 },
            { property: "radius", before: 6, after: 14 },
        ]);
        assert.ok(!diff.changed.some((item) => item.key === 'h2 "Murat Alpay"'));
        assert.deepEqual(diff.removed, []);
        assert.match(summarize(diff), /button "Save": width 72 -> 120; radius 6 -> 14/);
    });

    it("closes the browser", async () => {
        await browser.close();
    });
});
