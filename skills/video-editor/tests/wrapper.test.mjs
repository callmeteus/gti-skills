import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const skillDir = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("video-editor wrapper", () => {
    it("has wrappers for every platform", () => {
        assert.ok(existsSync(join(skillDir, "scripts", "videoeditor.mjs")));
        assert.ok(existsSync(join(skillDir, "scripts", "videoeditor.cmd")));
        assert.ok(existsSync(join(skillDir, "scripts", "videoeditor")));
    });

    it("resolves the local package without searching npm or PATH", () => {
        const source = readFileSync(join(skillDir, "scripts", "videoeditor.mjs"), "utf8");

        assert.match(source, /VIDEOEDITOR_HOME/);
        assert.match(source, /videoeditor\.root/);
        assert.match(source, /packages", "videoeditor/);
        assert.match(source, /dist", "bin", "videoeditor\.js/);
        assert.doesNotMatch(source, /npx videoeditor/);
    });

    it("points skill.json at the engine package", () => {
        const manifest = JSON.parse(readFileSync(join(skillDir, "skill.json"), "utf8"));

        assert.equal(manifest.id, "video-editor");
        assert.equal(manifest.package, "packages/videoeditor");
        assert.equal(manifest.rootPointer, "scripts/videoeditor.root");
        assert.ok(manifest.packs.includes("art"));
    });
});
