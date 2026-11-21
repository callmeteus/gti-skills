import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { defaultConfig, loadConfig, mergeConfigs } from "../src/config.mjs";
import { makeContext } from "../src/log.mjs";

function fixture() {
    const root = mkdtempSync(join(tmpdir(), "lg-config-"));
    const stateDir = join(root, "state");
    mkdirSync(stateDir, { recursive: true });

    return {
        root,
        stateDir,
        ctx: { cwd: root, home: join(root, "home"), stateDir, env: {} }
    };
}

test("project config overrides user config and severity keys merge", () => {
    const { root, stateDir, ctx } = fixture();
    try {
        writeFileSync(join(stateDir, "config.json"), JSON.stringify({
            mode: "log-only",
            severity: { high: "ask" },
            disable: ["env_file_to_network"]
        }));
        writeFileSync(join(root, ".leakguard.json"), JSON.stringify({
            mode: "enforce",
            severity: { medium: "deny" },
            allowHosts: ["example.com"]
        }));

        const { config, warnings } = loadConfig(ctx);
        assert.equal(config.mode, "enforce");
        assert.equal(config.severity.high, "ask");
        assert.equal(config.severity.medium, "deny");
        assert.equal(config.severity.low, "allow");
        assert.deepEqual(config.disable, ["env_file_to_network"]);
        assert.deepEqual(config.allowHosts, ["example.com"]);
        assert.deepEqual(warnings, []);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("invalid JSON never crashes and falls back to the other source", () => {
    const { root, stateDir, ctx } = fixture();
    try {
        writeFileSync(join(stateDir, "config.json"), JSON.stringify({ mode: "log-only" }));
        writeFileSync(join(root, ".leakguard.json"), "{ this is not json");

        const { config, warnings } = loadConfig(ctx);
        assert.equal(config.mode, "log-only");
        assert.ok(warnings.some((warning) => warning.message.toLowerCase().includes("json")));
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("invalid keys are skipped with warnings and defaults stay intact", () => {
    const source = {
        mode: "nonsense",
        severity: { high: "block", low: "allow" },
        rules: [{ id: "bad", severity: "high", title: "Bad", pattern: "[" }]
    };
    const warnings = [];
    const config = mergeConfigs([source], warnings, ["config"]);

    assert.deepEqual(config, defaultConfig());
    assert.ok(warnings.some((warning) => warning.message.includes("invalid mode")));
    assert.ok(warnings.some((warning) => warning.message.includes("invalid decision")));
    assert.ok(warnings.some((warning) => warning.message.includes("invalid extra rule")));
});

test("valid extra rules survive config loading", () => {
    const { root, stateDir, ctx } = fixture();
    try {
        writeFileSync(join(stateDir, "config.json"), JSON.stringify({
            rules: [{ id: "extra", severity: "medium", title: "Extra", pattern: "TOKEN", requires: "LEAK" }]
        }));

        const { config } = loadConfig(ctx);
        assert.equal(config.rules.length, 1);
        assert.equal(config.rules[0].requires, "LEAK");
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("GTI_HOME and LEAKGUARD_HOME_OVERRIDE are honored", () => {
    const root = mkdtempSync(join(tmpdir(), "lg-env-"));
    try {
        const byGti = makeContext({ env: { GTI_HOME: join(root, "gti") } });
        assert.equal(byGti.stateDir, join(root, "gti", "leak-guard"));

        const byHome = makeContext({ env: { LEAKGUARD_HOME_OVERRIDE: join(root, "home") } });
        assert.equal(byHome.home, join(root, "home"));
        assert.equal(byHome.stateDir, join(root, "home", ".gti", "leak-guard"));
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
