import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { runCheck } from "../commands/Check.mjs";
import { runInstall } from "../commands/Install.mjs";
import { runList } from "../commands/List.mjs";
import { runValidate } from "../commands/Validate.mjs";
import { loadHarnesses } from "../core/Registry.mjs";
import { discoverSkills } from "../core/Skills.mjs";

/**
 * Creates an output collector.
 *
 * @returns {{ out: (line: string) => void, err: (line: string) => void, lines: string[], errors: string[] }} Collector
 */
function collect() {
    const lines = [];
    const errors = [];

    return { out: (line) => lines.push(line), err: (line) => errors.push(line), lines, errors };
}

describe("repository state", () => {
    it("has the three skills and every skill validates", () => {
        assert.deepEqual(discoverSkills().map((skill) => skill.id), ["artdirector", "unslop-interface", "ux-psychology-review", "video-to-markdown", "video-to-skill"]);
        const io = collect();
        assert.equal(runValidate({}, io), 0, io.errors.join("\n"));
    });

    it("keeps synced and generated files up to date (run `node packages/cli build` after changing a skill)", () => {
        const io = collect();
        assert.equal(runCheck({}, io), 0, io.errors.join("\n"));
    });

    it("lists skills and agents", () => {
        const io = collect();
        assert.equal(runList({}, io), 0);
        assert.ok(io.lines.some((line) => line.includes("Art Director")));
        assert.ok(io.lines.some((line) => line.includes("muse")));
    });
});

describe("install", () => {
    it("requires --harness and rejects unknown values", () => {
        assert.equal(runInstall({}, collect()), 1);
        assert.equal(runInstall({ harness: "nope" }, collect()), 1);
        assert.equal(runInstall({ harness: "claude", scope: "galaxy" }, collect()), 1);
        assert.equal(runInstall({ harness: "claude", skill: "nope" }, collect()), 1);
    });

    it("installs every skill for every agent at project scope", () => {
        const project = mkdtempSync(join(tmpdir(), "gti-install-"));
        const io = collect();
        assert.equal(runInstall({ harness: "all" }, io, { cwd: project }), 0, io.errors.join("\n"));

        for (const harness of loadHarnesses()) {
            for (const skill of discoverSkills()) {
                const folder = join(project, ...harness.projectPath.split("/"), skill.id);
                assert.ok(existsSync(join(folder, "SKILL.md")), `${harness.id}/${skill.id}`);
                assert.ok(!existsSync(join(folder, "skill.json")));
                assert.ok(!existsSync(join(folder, "README.md")));
                assert.ok(existsSync(join(folder, "harnesses", harness.id, "GUIDE.md")), `${harness.id} guide for ${skill.id}`);
                assert.ok(!existsSync(join(folder, "harnesses", "opencode", "project-files")));
            }
        }

        assert.ok(existsSync(join(project, ".opencode", "commands", "artdirector.md")));
        assert.ok(io.lines.some((line) => line.startsWith("skip")), "agents sharing .agents/skills are installed once");
    });

    it("writes the package pointer for Art Director and keeps scripts importable", () => {
        const project = mkdtempSync(join(tmpdir(), "gti-install-"));
        assert.equal(runInstall({ harness: "kiro", skill: "artdirector,video-to-skill" }, collect(), { cwd: project }), 0);
        const pointer = readFileSync(join(project, ".kiro", "skills", "artdirector", "scripts", "artdirector.root"), "utf8");
        assert.ok(pointer.replace(/\\/g, "/").endsWith("packages/artdirector"));
        assert.ok(existsSync(join(project, ".kiro", "skills", "video-to-skill", "scripts", "lib", "common.py")));
    });

    it("installs at user scope under the home directory and skips project extras", () => {
        const home = mkdtempSync(join(tmpdir(), "gti-home-"));
        const io = collect();
        assert.equal(runInstall({ harness: "opencode", scope: "user", skill: "artdirector" }, io, { home }), 0);
        assert.ok(existsSync(join(home, ".config", "opencode", "skills", "artdirector", "SKILL.md")));
        assert.ok(io.lines.some((line) => line.startsWith("note")));
    });

    it("dry run writes nothing", () => {
        const project = mkdtempSync(join(tmpdir(), "gti-install-"));
        assert.equal(runInstall({ harness: "cursor", "dry-run": true }, collect(), { cwd: project }), 0);
        assert.ok(!existsSync(join(project, ".cursor")));
    });
});
