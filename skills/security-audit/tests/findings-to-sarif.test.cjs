const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { toSarif, FINGERPRINT_KEY } = require("../scripts/export/findings-to-sarif.cjs");

const scriptPath = path.join(__dirname, "..", "scripts", "export", "findings-to-sarif.cjs");

function confirmed(overrides = {}) {
  return {
    verdict: "confirmed",
    fingerprint: "api-orders-missing-owner-check",
    title: "Missing ownership check on order update",
    description: "Any signed-in user can change another user's order.",
    root_cause: "updateOrder loads the order by id and never compares its owner to the caller.",
    intended_behavior: "Only the order's owner can change it.",
    trace: [
      { kind: "entrypoint", file: "src/routes/orders.ts", line: 12, scope: "router.put", description: "PUT /orders/:id" },
      { kind: "sink", file: "src/services/orders.ts", line: 40, scope: "updateOrder", description: "Writes the order" },
    ],
    evidence: [{ file: "src/services/orders.ts", line: 38, description: "Lookup by id only" }],
    conditions: [{ kind: "authentication_level", description: "A normal account." }],
    execution: {
      attacker_perspective: "A signed-in user.",
      payloads: ["PUT /orders/2 as user 1"],
      instructions: ["Run the local integration test with two dummy users."],
      observed_result: "Order 2 changed although user 1 does not own it.",
    },
    remediation: { strategy: "Compare order.ownerId with the caller before the write." },
    severity: {
      likelihood: { score: "high", reason: "Any account can reach it." },
      impact: { score: "high", reason: "Cross-user write." },
      overall_severity: "high",
    },
    confidence: { score: "high", reason: "Reproduced locally." },
    ...overrides,
  };
}

function needsValidation() {
  return {
    verdict: "needs_validation",
    fingerprint: "edge-cache-key-ignores-auth",
    title: "Cache key may ignore the session",
    description: "Responses could be cached across users if the edge keys only on the path.",
    claimed_root_cause: "The handler sets a public Cache-Control header on a per-user page.",
    trace: [{ kind: "sink", file: "src/routes/account.ts", line: 7, scope: "GET /account", description: "Sets Cache-Control: public" }],
    evidence: [{ file: "src/routes/account.ts", line: 7, description: "Header value" }],
    blockers: ["The CDN cache key configuration is not in the repository."],
    validation_plan: { deployment: "Owner checks whether the CDN varies the cache key on the session cookie." },
  };
}

function rejected() {
  return {
    verdict: "rejected",
    fingerprint: "zz-rejected",
    title: "Suspected SQL injection",
    description: "Disproved.",
    claimed_root_cause: "String concatenation in a query.",
    trace: [{ kind: "sink", file: "src/db.ts", line: 3, scope: "query", description: "Builds SQL" }],
    evidence: [{ file: "src/db.ts", line: 3, description: "Uses a constant" }],
    reason: "The concatenated value is a compile-time constant.",
  };
}

function writeTemp(t, name, contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sarif-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, name);
  fs.writeFileSync(file, contents);
  return { dir, file };
}

test("exports a confirmed finding with severity, sink location, code flow, and fingerprint", () => {
  const sarif = toSarif([confirmed()]);
  const run = sarif.runs[0];
  const result = run.results[0];

  assert.equal(sarif.version, "2.1.0");
  assert.equal(run.tool.driver.rules[0].properties["security-severity"], "8.0");
  assert.equal(result.level, "error");
  assert.equal(result.kind, "fail");
  assert.deepEqual(result.locations[0].physicalLocation, {
    artifactLocation: { uri: "src/services/orders.ts", uriBaseId: "%SRCROOT%" },
    region: { startLine: 40 },
  });
  assert.equal(result.codeFlows[0].threadFlows[0].locations.length, 2);
  assert.equal(result.partialFingerprints[FINGERPRINT_KEY], "api-orders-missing-owner-check");
});

test("leaves out needs_validation unless asked, and never exports rejected records", () => {
  const records = [confirmed(), needsValidation(), rejected()];

  assert.equal(toSarif(records).runs[0].results.length, 1);

  const withLeads = toSarif(records, { includeNeedsValidation: true }).runs[0];
  assert.deepEqual(withLeads.results.map((r) => [r.ruleId, r.level, r.kind]), [
    ["api-orders-missing-owner-check", "error", "fail"],
    ["edge-cache-key-ignores-auth", "note", "review"],
  ]);
  assert.equal(withLeads.tool.driver.rules[1].properties["security-severity"], undefined);
});

test("maps medium and low severities to warning and note", () => {
  const medium = confirmed({ fingerprint: "a-medium" });
  medium.severity = { ...medium.severity, impact: { score: "medium", reason: "x" }, overall_severity: "medium" };
  const low = confirmed({ fingerprint: "b-low" });
  low.severity = { ...low.severity, impact: { score: "low", reason: "x" }, overall_severity: "low" };

  const levels = toSarif([medium, low]).runs[0].results.map((r) => r.level);
  assert.deepEqual(levels, ["warning", "note"]);
});

test("CLI refuses findings that fail validation", (t) => {
  const broken = confirmed();
  delete broken.root_cause;
  const { file } = writeTemp(t, "findings.json", JSON.stringify([broken]));

  const result = spawnSync(process.execPath, [scriptPath, file], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to export/);
});

test("CLI writes a new SARIF file and will not overwrite one", (t) => {
  const { dir, file } = writeTemp(t, "findings.json", JSON.stringify([confirmed(), needsValidation()]));
  const out = path.join(dir, "audit.sarif");

  const first = spawnSync(process.execPath, [scriptPath, file, "--out", out, "--include-needs-validation"], { encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(JSON.parse(fs.readFileSync(out, "utf8")).runs[0].results.length, 2);

  const second = spawnSync(process.execPath, [scriptPath, file, "--out", out], { encoding: "utf8" });
  assert.equal(second.status, 1);
  assert.match(second.stderr, /already exists/);
});
