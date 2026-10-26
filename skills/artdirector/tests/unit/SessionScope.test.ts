import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { StorageScope } from "../../src/core";
import { ContextResolver } from "../../src/session";

const temps: string[] = [];
const previousHome = process.env.ARTDIRECTOR_HOME;
const sessionVariables = [
    "ARTDIRECTOR_SESSION",
    "OPENCODE_SESSION_ID",
    "PASEO_AGENT_ID",
    "CLAUDE_SESSION_ID",
    "CURSOR_SESSION_ID",
    "CODEX_SESSION_ID",
    "TERM_SESSION_ID"
];
const savedVariables = new Map<string, string | undefined>();

beforeEach(() => {
    for (const name of sessionVariables) {
        savedVariables.set(name, process.env[name]);
        delete process.env[name];
    }
});

afterEach(() => {
    if (previousHome === undefined) {
        delete process.env.ARTDIRECTOR_HOME;
    } else {
        process.env.ARTDIRECTOR_HOME = previousHome;
    }

    for (const [name, value] of savedVariables) {
        if (value === undefined) {
            delete process.env[name];
        } else {
            process.env[name] = value;
        }
    }

    savedVariables.clear();
    temps.length = 0;
});

describe("session isolation", () => {
    it("keeps each chat in a separate temp project without touching the repository", () => {
        const repo = temp("repo-");
        process.env.ARTDIRECTOR_HOME = temp("home-");
        const first = ContextResolver.init({
            workspace: repo,
            session: "chat-a",
            name: "Chat A",
            brief: { goal: "poster" }
        });
        first.ctx.patchBrand({ name: "Brand A" });
        first.ctx.patchBrief({ audience: "members A" });

        const second = ContextResolver.init({
            workspace: repo,
            session: "chat-b",
            name: "Chat B"
        });

        expect(first.storage).toBe(StorageScope.SESSION);
        expect(second.storage).toBe(StorageScope.SESSION);
        expect(first.ctx.root).not.toBe(second.ctx.root);
        expect(first.ctx.root.startsWith(process.env.ARTDIRECTOR_HOME ?? "")).toBe(true);
        expect(existsSync(join(repo, ".artdirector"))).toBe(false);

        expect(first.ctx.project().brand.name).toBe("Brand A");
        expect(second.ctx.project().brand.name).toBe("Chat B");
        expect(second.ctx.project().brief.audience).toBeUndefined();
        expect(second.ctx.variants()).toHaveLength(0);

        const reopened = ContextResolver.open({
            workspace: repo,
            session: "chat-a"
        });

        expect(reopened.requestId).toBe(first.requestId);
        expect(reopened.ctx.project().brand.name).toBe("Brand A");
        expect(reopened.ctx.project().brief.audience).toBe("members A");
    });

    it("reuses the active request and starts a new one only when asked", () => {
        const repo = temp("repo-");
        process.env.ARTDIRECTOR_HOME = temp("home-");
        const first = ContextResolver.init({
            workspace: repo,
            session: "chat-a",
            name: "First request"
        });
        mkdirSync(join(first.ctx.root, ".artdirector", "variants", "one"), { recursive: true });
        writeFileSync(join(first.ctx.root, ".artdirector", "variants", "one", "artwork.html"), "<html></html>", "utf8");

        const reused = ContextResolver.init({
            workspace: repo,
            session: "chat-a",
            name: "First request"
        });
        const next = ContextResolver.init({
            workspace: repo,
            session: "chat-a",
            name: "Second request",
            newRequest: true
        });

        expect(reused.requestId).toBe(first.requestId);
        expect(next.requestId).not.toBe(first.requestId);
        expect(next.ctx.root).not.toBe(first.ctx.root);
        expect(next.ctx.variants()).toHaveLength(0);
        expect(existsSync(join(first.ctx.root, ".artdirector", "variants", "one", "artwork.html"))).toBe(true);

        const reopened = ContextResolver.open({
            workspace: repo,
            session: "chat-a"
        });
        expect(reopened.requestId).toBe(next.requestId);
    });

    it("writes into the repository only with permanent opt-in", () => {
        const repo = temp("repo-");
        process.env.ARTDIRECTOR_HOME = temp("home-");
        const permanent = ContextResolver.init({
            workspace: repo,
            session: "chat-a",
            name: "Permanent",
            permanent: true
        });

        expect(permanent.storage).toBe(StorageScope.REPOSITORY);
        expect(existsSync(join(repo, ".artdirector", "project.json"))).toBe(true);
        expect(permanent.ctx.project().storage).toBe(StorageScope.REPOSITORY);

        const reopened = ContextResolver.open({
            workspace: repo,
            session: "chat-a"
        });

        expect(reopened.storage).toBe(StorageScope.REPOSITORY);
        expect(reopened.ctx.root).toBe(repo);
    });

    it("uses a workspace fallback when the agent exposes no chat id", () => {
        const repo = temp("repo-");
        process.env.ARTDIRECTOR_HOME = temp("home-");
        const repoTwo = temp("repo-two-");

        const first = ContextResolver.init({
            workspace: repo,
            name: "Fallback"
        });
        const same = ContextResolver.open({
            workspace: repo
        });
        const other = ContextResolver.init({
            workspace: repoTwo,
            name: "Other"
        });

        expect(first.identity.source).toBe("workspace");
        expect(same.ctx.root).toBe(first.ctx.root);
        expect(other.ctx.root).not.toBe(first.ctx.root);
    });
});

/**
 * Creates a temporary directory tracked for cleanup.
 *
 * @param prefix Directory prefix
 * @returns Absolute path
 */
function temp(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    temps.push(dir);
    return dir;
}
