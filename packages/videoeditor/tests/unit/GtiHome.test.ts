import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GtiHome } from "../../src/core/GtiHome";

describe("GtiHome", () => {
    let home: string;
    let previous: string | undefined;

    beforeEach(() => {
        home = mkdtempSync(join(tmpdir(), "gti-home-test-"));
        previous = process.env.GTI_HOME;
        process.env.GTI_HOME = home;
    });

    afterEach(() => {
        if (previous === undefined) {
            delete process.env.GTI_HOME;
        } else {
            process.env.GTI_HOME = previous;
        }
        rmSync(home, { recursive: true, force: true });
    });

    it("keeps all state under GTI_HOME and never in the workspace", () => {
        expect(GtiHome.root()).toBe(home);
        expect(GtiHome.rootForSkill()).toBe(join(home, "video-editor"));
        expect(GtiHome.sessionsDir().startsWith(GtiHome.rootForSkill())).toBe(true);
    });

    it("derives a stable workspace key from the path", () => {
        const first = GtiHome.workspaceKey(join(home, "project"));
        const second = GtiHome.workspaceKey(join(home, "project"));

        expect(first).toBe(second);
        expect(first).toMatch(/^project-[0-9a-f]{10}$/);
    });
});
