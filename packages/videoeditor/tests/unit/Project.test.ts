import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Project } from "../../src/session/Project";
import { addScene } from "../../src/session/Spec";

describe("Project", () => {
    let root: string;
    let previous: string | undefined;
    let workspace: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "video-editor-test-"));
        previous = process.env.GTI_HOME;
        process.env.GTI_HOME = root;
        delete process.env.PASEO_AGENT_ID;
        delete process.env.OPENCODE_SESSION_ID;
        delete process.env.VIDEOEDITOR_SESSION;
        workspace = join(root, "workspace");
    });

    afterEach(() => {
        if (previous === undefined) {
            delete process.env.GTI_HOME;
        } else {
            process.env.GTI_HOME = previous;
        }
        rmSync(root, { recursive: true, force: true });
    });

    it("keeps session and export files out of the workspace", () => {
        const ref = { workspace, session: "chat-1" };
        const created = Project.init(ref, "Launch");

        expect(created.created).toBe(true);
        expect(created.scope.stateDir.startsWith(root)).toBe(true);
        expect(existsSync(join(workspace, "timeline.json"))).toBe(false);
        expect(existsSync(created.scope.specPath)).toBe(true);
        expect(existsSync(created.scope.exportsDir)).toBe(true);
        expect(Project.open(ref).project.name).toBe("Launch");
    });

    it("reuses a request unless --new is set, and lists history", () => {
        const ref = { workspace, session: "chat-1" };
        const first = Project.init(ref, "First");
        const reused = Project.init(ref, "Second");
        const second = Project.init(ref, "Second edit", true);

        expect(reused.scope.request).toBe(first.scope.request);
        expect(second.scope.request).not.toBe(first.scope.request);
        expect(Project.history(ref)).toHaveLength(2);
        expect(Project.history(ref).filter((entry) => entry.active)).toHaveLength(1);
    });

    it("saves a modified timeline and reads it back", () => {
        const ref = { workspace, session: "chat-1" };
        const { scope } = Project.init(ref);
        const spec = addScene(Project.spec(scope), { source: "a.mp4", duration: 5 });

        Project.saveSpec(scope, spec);

        expect(Project.spec(scope).scenes[0]?.duration).toBe(5);
        expect(Project.setPhase(scope, "render").phase).toBe("render");
    });

    it("throws a clear error before init", () => {
        expect(() => Project.open({ workspace, session: "chat-1" })).toThrow(/run `videoeditor init`/i);
    });
});
