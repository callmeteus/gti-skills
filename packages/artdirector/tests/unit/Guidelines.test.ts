import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runCli } from "../../src/cli";
import { startStudio, type StudioServer } from "../../src/server";
import { ContextResolver, type Guideline } from "../../src/session";

const saved = {
    state: process.env.ARTDIRECTOR_STATE_HOME,
    guides: process.env.ARTDIRECTOR_GUIDELINES_HOME,
    json: process.env.ARTDIRECTOR_JSON
};
const brand = mkdtempSync(join(tmpdir(), "ad-guide-brand-"));
const other = mkdtempSync(join(tmpdir(), "ad-guide-other-"));
let server: StudioServer | undefined;
let base = "";
let token = "";

async function cli(...args: string[]) {
    return runCli(args);
}

async function rules(workspace: string, session = "chat-one"): Promise<Guideline[]> {
    const listed = await cli("guidelines", "--session", session, "--root", workspace);
    expect(listed.ok).toBe(true);
    return (listed.data as { rules: Guideline[] }).rules;
}

async function api(path: string, body?: unknown): Promise<Response> {
    return fetch(`${base}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
}

beforeAll(async () => {
    process.env.ARTDIRECTOR_STATE_HOME = mkdtempSync(join(tmpdir(), "ad-guide-state-"));
    process.env.ARTDIRECTOR_GUIDELINES_HOME = mkdtempSync(join(tmpdir(), "ad-guide-home-"));
    process.env.ARTDIRECTOR_JSON = "0";

    const started = await startStudio({ ctx: ContextResolver.init({ workspace: brand, session: "chat-one", name: "Brand piece" }).ctx, port: 4812 });
    server = started.server;
    token = started.token;
    base = `http://127.0.0.1:${started.port}`;
});

afterAll(async () => {
    await server?.close();

    for (const [name, value] of [
        ["ARTDIRECTOR_STATE_HOME", saved.state],
        ["ARTDIRECTOR_GUIDELINES_HOME", saved.guides],
        ["ARTDIRECTOR_JSON", saved.json]
    ] as const) {
        if (value === undefined) {
            delete process.env[name];
        } else {
            process.env[name] = value;
        }
    }
});

describe("guidelines", () => {
    it("keeps what the agent learned for later chats in the same workspace, and only there", async () => {
        const learned = await cli("guidelines", "add", "--dont", "Purple gradients behind text", "--why", "Reads as generic",
            "--quote", "tira esse roxo, parece IA", "--variant", "story-a", "--session", "chat-one", "--root", brand);
        expect(learned.summary).toMatch(/^Learned dont/);
        await cli("guidelines", "add", "--do", "Serif headlines", "--scope", "user", "--session", "chat-one", "--root", brand);

        const later = await rules(brand, "chat-two");
        expect(later.map((rule) => [rule.kind, rule.scope, rule.text])).toEqual([
            ["dont", "workspace", "Purple gradients behind text"],
            ["do", "user", "Serif headlines"]
        ]);
        expect(later[0]?.evidence[0]).toMatchObject({ variantId: "story-a", quote: "tira esse roxo, parece IA" });

        const elsewhere = await rules(other);
        expect(elsewhere.map((rule) => rule.text)).toEqual(["Serif headlines"]);
    });

    it("confirms a repeated rule instead of duplicating it, and flips it when the user changes their mind", async () => {
        const again = await cli("guidelines", "add", "--dont", "purple gradients behind text!", "--session", "chat-one", "--root", brand);
        expect(again.summary).toMatch(/^Confirmed/);
        let stored = (await rules(brand)).filter((rule) => rule.scope === "workspace");
        expect(stored).toHaveLength(1);
        expect(stored[0]?.hits).toBe(2);
        expect(stored[0]?.why).toBe("Reads as generic");

        const flipped = await cli("guidelines", "add", "--do", "Purple gradients behind text", "--session", "chat-one", "--root", brand);
        expect(flipped.summary).toMatch(/^Flipped/);
        stored = (await rules(brand)).filter((rule) => rule.scope === "workspace");
        expect(stored.map((rule) => [rule.kind, rule.hits])).toEqual([["do", 1]]);
    });

    it("lets the studio add, edit, move, and remove rules that the CLI then sees", async () => {
        const added = await (await api("/v1/guidelines", { kind: "dont", text: "Logo in the bottom right", scope: "workspace" })).json() as { rule: Guideline };
        expect(added.rule.source).toBe("studio");

        const moved = await api("/v1/guidelines/update", { id: added.rule.id, text: "Logo in a corner", scope: "user" });
        expect(moved.status).toBe(200);
        const elsewhere = await rules(other);
        expect(elsewhere.find((rule) => rule.id === added.rule.id)).toMatchObject({ text: "Logo in a corner", scope: "user", kind: "dont" });

        const removed = await api("/v1/guidelines/remove", { id: added.rule.id });
        expect(removed.status).toBe(200);
        const listed = await (await api("/v1/guidelines")).json() as { rules: Guideline[]; workspace: string };
        expect(listed.rules.some((rule) => rule.id === added.rule.id)).toBe(false);
        expect(listed.workspace).toBe(brand);
    });

    it("refuses empty rules, unknown kinds, and ids that do not exist", async () => {
        expect((await api("/v1/guidelines", { kind: "dont", text: "   " })).status).toBeGreaterThanOrEqual(400);
        expect((await api("/v1/guidelines", { kind: "maybe", text: "Something" })).status).toBeGreaterThanOrEqual(400);
        expect((await api("/v1/guidelines/remove", { id: "nope" })).status).toBe(404);
        await expect(cli("guidelines", "add", "--do", "A", "--dont", "B", "--root", brand)).rejects.toThrow(/exactly one/);
    });
});
