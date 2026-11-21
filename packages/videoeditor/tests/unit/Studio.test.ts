import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Json } from "../../src/core/Json";
import type { StudioInfo } from "../../src/server/Studio";
import { startStudio, stopStudio } from "../../src/server/Studio";
import { Project } from "../../src/session/Project";

describe("review studio", () => {
    let root: string;
    let previous: string | undefined;
    let port: number | null = null;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "video-editor-studio-"));
        previous = process.env.GTI_HOME;
        process.env.GTI_HOME = root;
        delete process.env.PASEO_AGENT_ID;
    });

    afterEach(() => {
        if (port !== null) {
            stopStudio(port);
            port = null;
        }
        stopStudio();
        if (previous === undefined) {
            delete process.env.GTI_HOME;
        } else {
            process.env.GTI_HOME = previous;
        }
        rmSync(root, { recursive: true, force: true });
    });

    it("serves a token-gated page and API on the requested bind address", async () => {
        const workspace = join(root, "workspace");
        const { scope } = Project.init({ workspace, session: "chat-1" });
        const result = await startStudio({ scope, port: 0, bind: "127.0.0.1" });
        port = result.port;

        expect(result.bind).toBe("127.0.0.1");
        expect(result.reused).toBe(false);
        expect(result.url).toContain(`localhost:${result.port}`);

        const info = Json.read<StudioInfo>(result.tokenPath);
        const base = `http://127.0.0.1:${result.port}`;

        const denied = await fetch(`${base}/api/status`);
        expect(denied.status).toBe(401);

        const status = await fetch(`${base}/api/status?token=${encodeURIComponent(info.token)}`);
        expect(status.status).toBe(200);
        expect((await status.json() as { ok: boolean }).ok).toBe(true);

        const page = await fetch(`${base}/?token=${encodeURIComponent(info.token)}`);
        expect(page.status).toBe(200);
        expect(await page.text()).toContain("Video Editor review");

        const reused = await startStudio({ scope, port: 0, bind: "127.0.0.1" });
        expect(reused.port).toBe(result.port);
        expect(reused.reused).toBe(true);
    });
});
