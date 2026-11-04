#!/usr/bin/env node
"use strict";

/**
 * Converts a validated findings.json into a SARIF 2.1.0 log for code-scanning
 * tools such as GitHub code scanning, GitLab, or an IDE SARIF viewer.
 *
 * Usage: node findings-to-sarif.cjs <findings.json> [--out <file.sarif>]
 *                                   [--include-needs-validation]
 *
 * Only `confirmed` records become results by default. With
 * --include-needs-validation, unresolved leads are added as `note` results
 * with kind `review`, so a reviewer sees them without a severity. `rejected`
 * records are never exported. The input must pass validate-findings.cjs first;
 * an invalid document is refused, never repaired.
 */

const fs = require("node:fs");
const path = require("node:path");
const {
  SCHEMA_PATH,
  SafeInputError,
  enforceJsonTextLimits,
  loadSchema,
  readFileWithinLimit,
  validateDocument,
} = require("../validate/validate-findings.cjs");

const TOOL_NAME = "security-audit";
const TOOL_URI = "https://github.com/cloudflare/security-audit-skill";
const FINGERPRINT_KEY = "securityAuditFingerprint/v1";

// GitHub maps security-severity to its own labels: >= 9.0 critical,
// >= 7.0 high, >= 4.0 medium, otherwise low.
const SECURITY_SEVERITY = {
  critical: "9.5",
  high: "8.0",
  medium: "5.5",
  low: "3.0",
  informational: "0.0",
};

const LEVEL = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "note",
  informational: "note",
};

function physicalLocation(entry) {
  return {
    artifactLocation: { uri: entry.file.split(path.sep).join("/"), uriBaseId: "%SRCROOT%" },
    region: { startLine: entry.line },
  };
}

function primaryEntry(record) {
  const trace = record.trace;
  const sink = trace.filter((entry) => entry.kind === "sink");
  if (sink.length > 0) return sink[sink.length - 1];
  if (trace.length > 0) return trace[trace.length - 1];
  return record.evidence[0];
}

function codeFlows(record) {
  if (record.trace.length < 2) return undefined;
  return [{
    threadFlows: [{
      locations: record.trace.map((entry) => ({
        location: {
          physicalLocation: physicalLocation(entry),
          message: { text: `${entry.kind}: ${entry.description}` },
        },
      })),
    }],
  }];
}

function ruleFor(record) {
  const confirmed = record.verdict === "confirmed";
  const rule = {
    id: record.fingerprint,
    name: record.fingerprint,
    shortDescription: { text: record.title },
    fullDescription: { text: record.description },
    help: {
      text: confirmed
        ? `Root cause: ${record.root_cause}\nIntended behavior: ${record.intended_behavior}\nFix: ${record.remediation.strategy}`
        : `Claimed root cause: ${record.claimed_root_cause}\nBlockers: ${record.blockers.join("; ")}`,
    },
    properties: { tags: ["security"], precision: confirmed ? record.confidence.score : "low" },
  };
  if (confirmed) {
    rule.properties["security-severity"] = SECURITY_SEVERITY[record.severity.overall_severity];
    rule.defaultConfiguration = { level: LEVEL[record.severity.overall_severity] };
  } else {
    rule.defaultConfiguration = { level: "note" };
  }
  return rule;
}

function resultFor(record, ruleIndex) {
  const confirmed = record.verdict === "confirmed";
  const result = {
    ruleId: record.fingerprint,
    ruleIndex,
    kind: confirmed ? "fail" : "review",
    level: confirmed ? LEVEL[record.severity.overall_severity] : "note",
    message: {
      text: confirmed
        ? `${record.title}. Observed: ${record.execution.observed_result}`
        : `${record.title}. Needs validation: ${record.blockers.join("; ")}`,
    },
    locations: [{ physicalLocation: physicalLocation(primaryEntry(record)) }],
    partialFingerprints: { [FINGERPRINT_KEY]: record.fingerprint },
    properties: { verdict: record.verdict },
  };
  if (confirmed) {
    result.properties.severity = record.severity.overall_severity;
    result.properties.confidence = record.confidence.score;
  }
  const flows = codeFlows(record);
  if (flows) result.codeFlows = flows;
  return result;
}

/**
 * Builds a SARIF log from validated findings.
 *
 * @param {object[]} findings Records that already passed validateDocument
 * @param {{ includeNeedsValidation?: boolean }} [options] Export options
 * @returns {object} SARIF 2.1.0 log
 */
function toSarif(findings, options = {}) {
  const exported = findings.filter((record) =>
    record.verdict === "confirmed" || (options.includeNeedsValidation && record.verdict === "needs_validation"));
  const rules = exported.map(ruleFor);
  const results = exported.map((record, index) => resultFor(record, index));
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: TOOL_NAME, informationUri: TOOL_URI, rules } },
      originalUriBaseIds: { "%SRCROOT%": { description: { text: "Root of the audited repository" } } },
      results,
    }],
  };
}

function parseArgs(argv) {
  const options = { input: null, out: null, includeNeedsValidation: false };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === "--out") options.out = argv[++index] ?? null;
    else if (value === "--include-needs-validation") options.includeNeedsValidation = true;
    else if (!options.input) options.input = value;
    else throw new Error(`unexpected argument: ${value}`);
  }
  if (!options.input) throw new Error("missing <findings.json>");
  if (options.out === null && argv.includes("--out")) throw new Error("--out needs a file path");
  return options;
}

function run(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`${error.message}\nUsage: node findings-to-sarif.cjs <findings.json> [--out <file.sarif>] [--include-needs-validation]`);
    return 2;
  }

  let findings;
  try {
    const contents = readFileWithinLimit(options.input);
    enforceJsonTextLimits(contents);
    findings = JSON.parse(contents);
  } catch (error) {
    const reason = error instanceof SafeInputError ? error.message : "input is not readable, bounded JSON";
    console.error(`Failed to read findings JSON: ${reason}`);
    return 1;
  }

  const errors = validateDocument(findings, loadSchema(SCHEMA_PATH));
  if (errors.length > 0) {
    console.error(`Refusing to export: findings.json has ${errors.length} validation error(s). Run validate-findings.cjs and fix them first.`);
    return 1;
  }

  const sarif = JSON.stringify(toSarif(findings, options), null, 2) + "\n";
  if (options.out) {
    try {
      fs.writeFileSync(options.out, sarif, { flag: "wx" });
    } catch (error) {
      const reason = error && error.code === "EEXIST" ? "the file already exists; choose a new path" : "the file could not be created";
      console.error(`Failed to write SARIF: ${reason}`);
      return 1;
    }
    const count = JSON.parse(sarif).runs[0].results.length;
    console.log(`Wrote ${count} result(s) to ${options.out}`);
  } else {
    process.stdout.write(sarif);
  }
  return 0;
}

module.exports = { toSarif, SECURITY_SEVERITY, FINGERPRINT_KEY };

if (require.main === module) process.exit(run(process.argv.slice(2)));
