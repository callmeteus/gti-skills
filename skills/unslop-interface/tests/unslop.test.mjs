import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { readRequest, scanText } from "../scripts/unslop/rules.mjs";
import { checkReport } from "../scripts/unslop/unslop.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "..", "scripts", "unslop", "unslop.mjs");
const screen = join(here, "fixtures", "repo", "src", "views", "OrderDetailView.vue");

function rules(findings) {
    return new Set(findings.map((f) => f.rule));
}

test("a number of passes in the request is a number of rounds of all eight passes", () => {
    for (const request of ["use o unslop em 5 passagens", "faz umas cinco passadas", "unslop this in 5 passes"]) {
        const { rounds, passes } = readRequest(request);
        assert.equal(rounds, 5, request);
        assert.equal(passes.length, 8, request);
    }
});

test("named passes limit the run only when the request says only", () => {
    assert.deepEqual(readRequest("just spacing and color").passes, ["spacing", "color"]);
    assert.equal(readRequest("fix the spacing and everything else").passes.length, 8);
});

test("the scan finds the detail page tells a class grep misses", () => {
    const found = rules(scanText(screen, readFileSync(screen, "utf8"), { hasCheckboxComponent: true }));
    for (const rule of [
        "status-restated",
        "narrating-caption",
        "id-fallback",
        "dash-placeholder",
        "value-repeated",
        "raw-enum-shown",
        "raw-id-shown",
        "raw-json-shown",
        "empty-count-badge",
        "native-checkbox",
        "truncated-path",
        "copy-everywhere",
        "equal-card-grid",
        "refresh-on-live-page",
        "destructive-not-danger",
        "async-no-loading",
        "decorative-gradient",
        "tracked-caps",
        "exclamation",
    ]) {
        assert.ok(found.has(rule), `missing ${rule}`);
    }
});

test("the scan stays quiet on a clean screen", () => {
    const clean = `<template>\n  <UiButton variant="danger" :disabled="deleting" @click="remove">Delete</UiButton>\n  <p :title="row.path" class="truncate">{{ row.path }}</p>\n</template>\n<script setup>\nasync function remove() {}\n</script>\n`;
    assert.deepEqual(scanText("Clean.vue", clean), []);
});

const fullReport = (rounds, rows) => `# Unslop report: orders

## Coverage

- **Screens:** src/views/OrderDetailView.vue, from its template
- **Rounds:** ${rounds} of ${rounds} asked

| Pass | Ran | Reason when skipped |
|------|-----|---------------------|
${rows}
`;

const allRan = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `| ${n}. Pass | yes | |`).join("\n");
const run = { rounds: 5, passes: ["spacing", "radius", "color", "icons", "copy", "data", "structure", "states"], screens: [{ path: "src/views/OrderDetailView.vue", kind: "screen" }] };

test("check passes a report that covers every pass, round, and screen", () => {
    assert.deepEqual(checkReport(fullReport(5, allRan), run).errors, []);
});

test("check fails a report that ran only the first five passes", () => {
    const rows = [1, 2, 3, 4, 5].map((n) => `| ${n}. Pass | yes | |`).join("\n") +
        "\n| 6. Data display | no | user asked for 5 passes |\n| 7. Actions and structure | no | user asked for 5 passes |\n| 8. States and feel | no | |";
    const { errors } = checkReport(fullReport(1, rows), run, [{ pass: 7, rule: "equal-card-grid" }]);
    assert.ok(errors.some((e) => e.includes("number of rounds")));
    assert.ok(errors.some((e) => e.includes("Pass 8") && e.includes("no reason")));
    assert.ok(errors.some((e) => e.includes("scan found")));
    assert.ok(errors.some((e) => e.includes("5 round")));
});

test("check fails a report with no coverage section or a missing screen", () => {
    assert.ok(checkReport("# Report\n", run).errors[0].includes("Coverage"));
    const other = { ...run, screens: [{ path: "src/views/Missing.vue", kind: "screen" }] };
    assert.ok(checkReport(fullReport(5, allRan), other).errors.some((e) => e.includes("Missing.vue")));
});

test("start writes the run under GTI_HOME, and check exits non-zero on an incomplete report", () => {
    const home = mkdtempSync(join(tmpdir(), "unslop-"));
    const repo = join(here, "fixtures", "repo");
    const env = { ...process.env, GTI_HOME: home };
    const out = execFileSync("node", [cli, "start", "--repo", repo, "--paths", join(repo, "src"), "--request", "5 passagens"], { env, encoding: "utf8" });
    assert.match(out, /5 round\(s\) of 8 pass\(es\)/);
    const runFile = readdirSync(home, { recursive: true }).find((f) => f.endsWith("run.json"));
    const report = join(home, "report.md");
    writeFileSync(report, "# Report\n");
    const res = spawnSync("node", [cli, "check", report, "--run", join(home, runFile)], { env, encoding: "utf8" });
    assert.equal(res.status, 1);
});
