import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { COMMAND_AGENTS, MARKER, hookCommand, install, status, uninstall } from "../src/install.mjs";

function fixture() {
    const root = mkdtempSync(join(tmpdir(), "lg-install-"));
    const project = join(root, "project");
    const home = join(root, "home");
    const stateDir = join(root, "state");
    mkdirSync(project, { recursive: true });
    mkdirSync(home, { recursive: true });

    return {
        root,
        project,
        home,
        options: { cwd: project, home, stateDir, env: {}, io: { out: () => {}, err: () => {} } }
    };
}

function configPath(agent, scope, project, home) {
    return agent[scope](scope === "project" ? project : home);
}

test("install writes a hook command for every command agent", () => {
    const { root, project, home, options } = fixture();
    try {
        const { actions } = install("all", options);
        const installed = actions.filter((action) => action.action === "install");
        assert.equal(installed.length, COMMAND_AGENTS.length);

        for (const agent of COMMAND_AGENTS) {
            const path = configPath(agent, "project", project, home);
            assert.equal(existsSync(path), true, path);
            assert.ok(readFileSync(path, "utf8").includes(MARKER), path);
        }
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("install is idempotent and does not add a second entry or backup", () => {
    const { root, project, home, options } = fixture();
    try {
        install("all", options);
        const before = readdirSync(join(project, ".cursor"));
        const second = install("all", options);
        const skips = second.actions.filter((action) => action.action === "skip" && action.path);
        assert.equal(skips.length, COMMAND_AGENTS.length);
        assert.deepEqual(readdirSync(join(project, ".cursor")), before);

        const config = JSON.parse(readFileSync(join(project, ".cursor", "hooks.json"), "utf8"));
        assert.equal(config.preToolUse.length, 1);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("install preserves unrelated keys and backs up an existing file", () => {
    const { root, project, home, options } = fixture();
    try {
        const path = join(project, ".cursor", "hooks.json");
        mkdirSync(join(project, ".cursor"), { recursive: true });
        writeFileSync(path, JSON.stringify({ otherKey: 42 }));

        const { actions } = install("cursor", options);
        const action = actions.find((entry) => entry.agent === "cursor");
        assert.equal(action.action, "install");
        assert.ok(existsSync(action.backup));
        assert.ok(action.backup.includes(".leakguard-backup-"));

        const config = JSON.parse(readFileSync(path, "utf8"));
        assert.equal(config.otherKey, 42);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("uninstall removes only leakguard entries", () => {
    const { root, project, home, options } = fixture();
    try {
        const path = join(project, ".cursor", "hooks.json");
        mkdirSync(join(project, ".cursor"), { recursive: true });
        writeFileSync(path, JSON.stringify({
            otherKey: 7,
            preToolUse: [{ type: "command", command: "node /other/tool.mjs" }]
        }));

        install("cursor", options);
        uninstall("cursor", options);

        const config = JSON.parse(readFileSync(path, "utf8"));
        assert.equal(config.otherKey, 7);
        assert.equal(config.preToolUse.length, 1);
        assert.equal(config.preToolUse[0].command.includes(MARKER), false);

        const second = uninstall("cursor", options);
        assert.equal(second.actions[0].action, "skip");
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("dry run writes nothing", () => {
    const { root, project, home, options } = fixture();
    try {
        const { actions } = install("all", { ...options, dryRun: true });
        assert.ok(actions.every((action) => action.action === "would-install" || action.action === "skip"));
        assert.equal(existsSync(join(project, ".claude", "settings.json")), false);
        assert.equal(existsSync(join(project, ".cursor", "hooks.json")), false);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("status reports installed state for both scopes", () => {
    const { root, project, home, options } = fixture();
    try {
        install("claude", options);
        const rows = status("claude", options);
        const projectRow = rows.find((row) => row.scope === "project");
        const userRow = rows.find((row) => row.scope === "user");
        assert.equal(projectRow.installed, true);
        assert.equal(userRow.installed, false);
        assert.equal(existsSync(userRow.path), false);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("user scope installs under the overridden home", () => {
    const { root, home, options } = fixture();
    try {
        install("claude", { ...options, scope: "user" });
        assert.equal(existsSync(join(home, ".claude", "settings.json")), true);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test("the hook command uses node and the absolute hook path", () => {
    const root = "/opt/leakguard";
    const hookPath = join(root, "bin", "leakguard-hook.mjs");
    const command = hookCommand("claude", root);
    assert.ok(command.startsWith("node "));
    assert.ok(command.includes(hookPath));
    assert.ok(command.includes("--agent claude"));
});
