import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runCli } from "../../src/cli";
import { Paths } from "../../src/core";
import { startStudio, type StudioServer } from "../../src/server";
import { ContextResolver } from "../../src/session";

const previousHome = process.env.ARTDIRECTOR_STATE_HOME;
const previousJson = process.env.ARTDIRECTOR_JSON;
const workspace = mkdtempSync(join(tmpdir(), "ad-hist-ws-"));
const session = "history-chat";
let server: StudioServer | undefined;
let base = "";
let token = "";
let firstRequest = "";

/**
 * Writes an artboard and registers it through the CLI, as the agent does.
 */
async function addVariant(variantsDir: string, id: string, label: string): Promise<void> {
    const file = join(variantsDir, id, "artwork.html");
    mkdirSync(join(variantsDir, id), { recursive: true });
    writeFileSync(file, `<!DOCTYPE html><html><body><div class="artboard" data-artdirector-root data-width="1080" data-height="1350">${label}</div></body></html>`);
    const result = await runCli(["variants", "add", "--id", id, "--file", file, "--session", session, "--root", workspace]);
    expect(result.ok).toBe(true);
}

async function api(path: string, body?: unknown): Promise<Response> {
    return fetch(`${base}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
}

beforeAll(async () => {
    process.env.ARTDIRECTOR_STATE_HOME = mkdtempSync(join(tmpdir(), "ad-hist-home-"));
    process.env.ARTDIRECTOR_JSON = "0";

    const first = ContextResolver.init({ workspace, session, name: "Hotel reveal" });
    firstRequest = first.requestId ?? "";
    await addVariant(Paths.variantsDir(first.ctx.root), "story-a", "first art");

    const started = await startStudio({ ctx: first.ctx, port: 4794 });
    server = started.server;
    token = started.token;
    base = `http://127.0.0.1:${started.port}`;

    const second = ContextResolver.init({ workspace, session, name: "Promo poster", newRequest: true });
    await addVariant(Paths.variantsDir(second.ctx.root), "story-a", "second art");
});

afterAll(async () => {
    await server?.close();

    if (previousHome === undefined) {
        delete process.env.ARTDIRECTOR_STATE_HOME;
    } else {
        process.env.ARTDIRECTOR_STATE_HOME = previousHome;
    }

    if (previousJson === undefined) {
        delete process.env.ARTDIRECTOR_JSON;
    } else {
        process.env.ARTDIRECTOR_JSON = previousJson;
    }
});

describe("session history", () => {
    it("groups every art of the chat, newest first, and follows the active one", async () => {
        const body = await (await api("/v1/history")).json() as {
            arts: Array<{ title: string; current: boolean; requestId: string; variants: Array<{ id: string }> }>;
        };

        expect(body.arts.map((art) => [art.title, art.current])).toEqual([
            ["Promo poster", true],
            ["Hotel reveal", false]
        ]);
        expect(body.arts[1]?.requestId).toBe(firstRequest);

        const session = await (await api("/v1/session")).json() as { project: { name: string } };
        expect(session.project.name).toBe("Promo poster");
    });

    it("serves and updates a variant of an earlier art when the request is named", async () => {
        const older = await api(`/artwork/story-a?request=${firstRequest}`);
        expect(await older.text()).toContain("first art");
        const current = await api("/artwork/story-a");
        expect(await current.text()).toContain("second art");

        const accepted = await api("/v1/variants/status", { id: "story-a", status: "accepted", request: firstRequest });
        expect(accepted.status).toBe(200);
        const history = await (await api("/v1/history")).json() as {
            arts: Array<{ title: string; variants: Array<{ status: string }> }>;
        };
        expect(history.arts.find((art) => art.title === "Hotel reveal")?.variants[0]?.status).toBe("accepted");
        expect(history.arts.find((art) => art.title === "Promo poster")?.variants[0]?.status).toBe("draft");
    });

    it("rejects a request id that is not part of the chat", async () => {
        const res = await api("/artwork/story-a?request=..%2F..%2Fescape");
        expect(res.status).toBe(404);
    });

    it("reuses the chat's studio when a later art starts it", async () => {
        const later = ContextResolver.open({ workspace, session });
        const again = await startStudio({ ctx: later.ctx, port: 4794 });
        expect(again.reused).toBe(true);
        expect(again.url).toBe(`${base}/?token=${token}`);
    });
});

describe("mood board", () => {
    it("is shared by every art: the studio and the CLI see the same entries", async () => {
        await api("/v1/moodboard", { kind: "color", color: "#C23B22", caption: "Brand red" });
        await api("/v1/moodboard", { kind: "variant", request: firstRequest, variantId: "story-a" });
        const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
        await api("/v1/moodboard", { kind: "image", name: "ref.png", data: png.toString("base64") });
        const note = await runCli(["moodboard", "add", "--note", "Warm lobby light", "--session", session, "--root", workspace]);
        expect(note.ok).toBe(true);

        const listed = await runCli(["moodboard", "--session", session, "--root", workspace]);
        const items = (listed.data as { items: Array<{ kind: string; color?: string; path?: string; source: string }> }).items;
        expect(items.map((item) => [item.kind, item.source])).toEqual([
            ["color", "studio"],
            ["variant", "studio"],
            ["image", "studio"],
            ["note", "agent"]
        ]);
        expect(items[0]?.color).toBe("#c23b22");
        expect(items[1]?.path).toContain(join("requests", firstRequest));

        const board = await (await api("/v1/moodboard")).json() as { items: Array<{ id: string; kind: string; url?: string; artTitle?: string }> };
        expect(board.items[0]?.kind).toBe("note");
        const image = board.items.find((item) => item.kind === "image");
        const served = await api(image?.url ?? "");
        expect(Buffer.from(await served.arrayBuffer()).equals(png)).toBe(true);
        expect(board.items.find((item) => item.kind === "variant")?.artTitle).toBe("Hotel reveal");
    });

    it("refuses files that are not images and removes entries", async () => {
        const bad = await api("/v1/moodboard", { kind: "image", name: "notes.txt", data: Buffer.from("hi").toString("base64") });
        expect(bad.status).toBeGreaterThanOrEqual(400);

        const before = await (await api("/v1/moodboard")).json() as { items: Array<{ id: string; kind: string }> };
        const color = before.items.find((item) => item.kind === "color");
        await api("/v1/moodboard/remove", { id: color?.id });
        const after = await (await api("/v1/moodboard")).json() as { items: Array<{ kind: string }> };
        expect(after.items.map((item) => item.kind)).not.toContain("color");
        expect(after.items).toHaveLength(before.items.length - 1);
    });
});
