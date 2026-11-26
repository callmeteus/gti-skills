import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";

import { resolveLintapple } from "../scripts/run.mjs";

describe("lintapple runner source", () => {
    it("uses only the built gti-skills fork", () => {
        const root = join("gti-skills", "packages", "lintapple");
        const built = join(root, "dist", "bin", "lintapple.js");
        const tool = resolveLintapple("project", root, (path) => path === built);
        assert.equal(tool.kind, "package");
        assert.equal(tool.command, process.execPath);
        assert.deepEqual(tool.args, [built]);
        assert.equal(tool.root, root);
        assert.match(tool.note, /fork/);
    });

    it("does not accept a project copy or an npm download when the fork is not built", () => {
        const root = join("gti-skills", "packages", "lintapple");
        const built = join(root, "dist", "bin", "lintapple.js");
        const tool = resolveLintapple("project", root, (path) => path !== built);
        assert.equal(tool.kind, "missing");
        assert.equal(tool.command, undefined);
        assert.match(tool.error, /npm ci && npm run build/);
    });

    it("reports a missing fork pointer instead of falling back", () => {
        const tool = resolveLintapple("project", null, () => true);
        assert.equal(tool.kind, "missing");
        assert.equal(tool.command, undefined);
        assert.match(tool.error, /gti-skills CLI/);
    });
});
