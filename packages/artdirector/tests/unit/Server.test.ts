import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Auth } from "../../src/core";
import { ProjectContext } from "../../src/session";
import { startStudio, StudioServer } from "../../src/server";

describe("studio server", () => {
    const root = mkdtempSync(join(tmpdir(), "ad-srv-"));
    ProjectContext.create({
        name: "Server test",
        root
    });
    const token = Auth.loadOrCreate(root);
    const server = new StudioServer(ProjectContext.open(root), 4742, token);

    beforeAll(async () => {
        await server.listen();
    });

    afterAll(async () => {
        await server.close();
    });

    it("rejects missing tokens and serves the session with a valid token", async () => {
        const denied = await fetch("http://127.0.0.1:4742/v1/session");
        expect(denied.status).toBe(401);

        const ok = await fetch("http://127.0.0.1:4742/v1/session", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        expect(ok.status).toBe(200);
        const body = await ok.json() as { ok: boolean; project: { name: string } };
        expect(body.ok).toBe(true);
        expect(body.project.name).toBe("Server test");
    });

    it("does not expose a shell endpoint", async () => {
        const res = await fetch("http://127.0.0.1:4742/v1/shell", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        expect(res.status).toBe(404);
    });

    it("serves studio CSS when the token is in the query", async () => {
        const res = await fetch(`http://127.0.0.1:4742/studio.css?token=${token}`);
        expect(res.status).toBe(200);
        const css = await res.text();
        expect(css).toContain("--ink");
    });

    it("creates a variant from a library template, including story", async () => {
        const res = await fetch("http://127.0.0.1:4742/v1/generate-template", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ templateId: "story" })
        });
        expect(res.status).toBe(200);
        const body = await res.json() as {
            ok: boolean;
            variant: { id: string; templateId: string; width: number; height: number; htmlPath: string };
        };
        expect(body.ok).toBe(true);
        expect(body.variant.templateId).toBe("story");
        expect(body.variant.width).toBe(1080);
        expect(body.variant.height).toBe(1920);
        expect(body.variant.id).toBe("template-story-story");
        expect(existsSync(join(root, body.variant.htmlPath))).toBe(true);

        const second = await fetch("http://127.0.0.1:4742/v1/generate-template", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ templateId: "announcement" })
        });
        expect(second.status).toBe(200);
        const session = await fetch("http://127.0.0.1:4742/v1/session", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        const snapshot = await session.json() as {
            variants: Array<{ templateId?: string; id: string }>;
        };
        const generated = snapshot.variants.filter((item) => item.templateId);
        expect(generated).toHaveLength(1);
        expect(generated[0]?.templateId).toBe("announcement");
        expect(existsSync(join(root, body.variant.htmlPath))).toBe(false);

        const pack = await fetch("http://127.0.0.1:4742/v1/generate-template", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                templateId: "social-post",
                formatIds: ["instagram-square", "story"]
            })
        });
        expect(pack.status).toBe(200);
        const packed = await pack.json() as {
            variants: Array<{ templateId?: string; formatId?: string; width: number; height: number }>;
        };
        expect(packed.variants).toHaveLength(2);
        expect(packed.variants.map((item) => item.formatId).sort()).toEqual(["instagram-square", "story"]);
        expect(packed.variants.find((item) => item.formatId === "story")?.height).toBe(1920);
        expect(packed.variants.find((item) => item.formatId === "instagram-square")?.width).toBe(1080);
    });

    it("lists pending live events on the session queue", async () => {
        const queued = await fetch("http://127.0.0.1:4742/v1/events", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                type: "generate",
                action: "layout"
            })
        });
        expect(queued.status).toBe(200);

        const session = await fetch("http://127.0.0.1:4742/v1/session", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        const body = await session.json() as {
            queue: Array<{ action: string; acknowledged: boolean }>;
        };
        expect(body.queue.length).toBeGreaterThanOrEqual(1);
        expect(body.queue.some((item) => item.action === "layout" && item.acknowledged === false)).toBe(true);
    });

    it("exposes format short labels and infers story from 1080x1920", async () => {
        const session = await fetch("http://127.0.0.1:4742/v1/session", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        const snap = await session.json() as {
            formats: Array<{ id: string; short: string }>;
        };
        expect(snap.formats.every((item) => Boolean(item.short))).toBe(true);
        expect(snap.formats.find((item) => item.id === "story")?.short).toBe("Story");

        const created = await fetch("http://127.0.0.1:4742/v1/variants", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: "inferred-story",
                title: "Inferred story",
                width: 1080,
                height: 1920,
                html: "<!DOCTYPE html><html><body><div class=\"artboard\" data-artdirector-root data-width=\"1080\" data-height=\"1920\">ok</div></body></html>"
            })
        });
        expect(created.status).toBe(200);
        const body = await created.json() as { variant: { formatId?: string } };
        expect(body.variant.formatId).toBe("story");
    });
});

describe("studio ports and locks", () => {
    it("gives each context its own port and reuses a healthy server", async () => {
        const rootA = mkdtempSync(join(tmpdir(), "ad-port-a-"));
        const rootB = mkdtempSync(join(tmpdir(), "ad-port-b-"));
        ProjectContext.create({ name: "A", root: rootA });
        ProjectContext.create({ name: "B", root: rootB });

        const first = await startStudio({
            ctx: ProjectContext.open(rootA),
            port: 4758
        });
        const second = await startStudio({
            ctx: ProjectContext.open(rootB),
            port: 4758
        });
        const again = await startStudio({
            ctx: ProjectContext.open(rootA),
            port: 4758
        });

        try {
            expect(first.reused).toBe(false);
            expect(second.reused).toBe(false);
            expect(first.port).toBe(4758);
            expect(second.port).not.toBe(first.port);
            expect(again.reused).toBe(true);
            expect(again.url).toBe(first.url);
        } finally {
            await second.server?.close();
            await first.server?.close();
        }
    });
});
