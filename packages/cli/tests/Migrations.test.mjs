import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { readInstalls, writeInstalls, writeJson } from "../core/Installs.mjs";
import { loadMigrations, pendingMigrations, runMigrations } from "../core/Migrations.mjs";
import { discoverSkills } from "../core/Skills.mjs";

/**
 * Builds a fake home with an old `~/.gti-skills` folder: install records, state, a source, and an MCP.
 *
 * @returns {{ home: string, legacy: string, target: string, pointerFile: string, context: import("../core/Migrations.mjs").MigrationContext, lines: string[] }} Fixture
 */
function fixture() {
    const home = mkdtempSync(join(tmpdir(), "gti-migrate-"));
    const legacy = join(home, ".gti-skills");
    const target = join(home, ".gti", "skills");
    const skill = discoverSkills().find((candidate) => candidate.rootPointer);
    const destination = join(home, "installed", skill.id);
    const pointerFile = join(destination, skill.rootPointer);

    mkdirSync(join(legacy, "sources", "abc"), { recursive: true });
    mkdirSync(join(legacy, "mcps", "shopee"), { recursive: true });
    writeFileSync(join(legacy, "mcps", "shopee", "login.json"), "session");
    writeJson(join(legacy, "state.json"), { latest: "old" });
    writeInstalls(legacy, [{ destination, skill: skill.id, harnesses: ["claude"], scope: "user", projectRoot: home, commit: null, installedAt: "" }]);
    mkdirSync(join(destination, ...skill.rootPointer.split("/").slice(0, -1)), { recursive: true });
    writeFileSync(pointerFile, join(legacy, "sources", "abc", "packages", "x"));

    const lines = [];

    return { home, legacy, target, pointerFile, lines, context: { folder: target, home, defaultFolder: true, out: (line) => lines.push(line) } };
}

describe("migrations", () => {
    it("discovers the migration files in name order", async () => {
        const migrations = await loadMigrations();

        assert.equal(migrations[0].id, "0001-move-state-folder");
        assert.deepEqual(migrations.map((migration) => migration.id), migrations.map((migration) => migration.id).sort());
    });

    it("moves the old state folder, keeps MCP logins, and repoints skill pointers", async () => {
        const { legacy, target, pointerFile, context, lines } = fixture();
        const migrations = await loadMigrations();

        assert.equal(pendingMigrations(context, migrations).length, 1);
        assert.deepEqual(runMigrations(context, migrations), ["0001-move-state-folder"]);

        assert.equal(existsSync(legacy), false);
        assert.equal(readFileSync(join(target, "mcps", "shopee", "login.json"), "utf8"), "session");
        assert.equal(existsSync(join(target, "sources", "abc")), true);
        assert.equal(readInstalls(target).length, 1);
        assert.equal(readFileSync(pointerFile, "utf8"), join(target, "sources", "abc", "packages", "x"));
        assert.ok(lines.some((line) => line.includes("repointed 1 skill(s)")));
    });

    it("records the migration so it never runs twice", async () => {
        const { target, context } = fixture();
        const migrations = await loadMigrations();

        runMigrations(context, migrations);

        assert.equal(JSON.parse(readFileSync(join(target, "migrations.json"), "utf8")).applied[0].id, "0001-move-state-folder");
        assert.deepEqual(runMigrations(context, migrations), []);
    });

    it("merges install records and drops the old state file when the new folder already has them", async () => {
        const { legacy, target, home, context } = fixture();
        const migrations = await loadMigrations();

        writeInstalls(target, [{ destination: join(home, "other"), skill: "other", harnesses: ["claude"], scope: "user", projectRoot: home, commit: "new", installedAt: "" }]);
        writeJson(join(target, "state.json"), { latest: "new" });
        runMigrations(context, migrations);

        assert.equal(readInstalls(target).length, 2);
        assert.equal(JSON.parse(readFileSync(join(target, "state.json"), "utf8")).latest, "new");
        assert.equal(existsSync(legacy), false);
    });

    it("leaves other clashes in the old folder and says so", async () => {
        const { legacy, target, context, lines } = fixture();
        const migrations = await loadMigrations();

        mkdirSync(join(target, "mcps"), { recursive: true });
        runMigrations(context, migrations);

        assert.equal(existsSync(join(legacy, "mcps", "shopee", "login.json")), true);
        assert.ok(lines.some((line) => line.includes("left mcps")));
    });

    it("does not apply when the state folder is overridden or there is no old folder", async () => {
        const { context } = fixture();
        const migrations = await loadMigrations();
        const empty = mkdtempSync(join(tmpdir(), "gti-migrate-empty-"));

        assert.equal(pendingMigrations({ ...context, defaultFolder: false }, migrations).length, 0);
        assert.equal(pendingMigrations({ folder: join(empty, ".gti", "skills"), home: empty, defaultFolder: true, out: () => {} }, migrations).length, 0);
    });
});
