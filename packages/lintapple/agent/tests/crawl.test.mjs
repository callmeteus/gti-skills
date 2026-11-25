import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { crawl, nextUrl, routePattern, toMarkdown } from "../scripts/crawl.mjs";
import { loadPlaywright } from "../scripts/probe.mjs";

const here = dirname(fileURLToPath(import.meta.url));

describe("route patterns and links", () => {
    it("groups IDs, numbers, hashes, and UUIDs into one pattern", () => {
        assert.equal(routePattern("https://app.test/tasks/ac027a63-8a27-42aa-8c9b-b010b97e1276"), "/tasks/:id");
        assert.equal(routePattern("https://app.test/users/42/orders/9f8e7d6c5b"), "/users/:id/orders/:id");
        assert.equal(routePattern("https://app.test/settings/team"), "/settings/team");
        assert.equal(routePattern("https://app.test/tasks?page=2"), "/tasks");
        assert.equal(routePattern("https://app.test/tasks?page=2", { keepQuery: true }), "/tasks?page=2");
    });

    it("keeps links inside the app and drops sign-out, delete, files, and other sites", () => {
        const options = { scope: "https://app.test/" };
        assert.equal(nextUrl("/tasks#top", "https://app.test/", options), "https://app.test/tasks");
        assert.equal(nextUrl("/logout", "https://app.test/", options), null);
        assert.equal(nextUrl("/x", "https://app.test/", { ...options, text: "Excluir conta" }), null);
        assert.equal(nextUrl("/report.pdf", "https://app.test/", options), null);
        assert.equal(nextUrl("https://other.test/", "https://app.test/", options), null);
        assert.equal(nextUrl("mailto:a@b.c", "https://app.test/", options), null);
    });
});

const playwright = await loadPlaywright(join(here, ".."), join(here, "..", ".."));
let browser = null;
try {
    browser = await playwright?.chromium.launch();
} catch {
    browser = null;
}

describe("crawl", { skip: browser ? false : "Chromium for Playwright is not installed" }, () => {
    it("maps every page once per route pattern and lists the states each page holds", async () => {
        const start = pathToFileURL(join(here, "fixtures", "crawl-site", "index.html")).href;
        const result = await crawl(browser, start);
        const patterns = result.pages.map((page) => page.pattern.split("/").slice(-2).join("/")).sort();
        assert.deepEqual(patterns, ["crawl-site/index.html", "crawl-site/settings.html", "crawl-site/tasks.html", "tasks/:id"]);
        const tasks = result.pages.find((page) => page.pattern.endsWith("tasks/:id"));
        assert.equal(tasks.samples.length, 3);
        assert.equal(tasks.states.menus, 1);
        assert.deepEqual(result.pages.find((page) => page.pattern.endsWith("settings.html")).states, { tabs: 2, dialogs: 0, menus: 0, forms: 1, tables: 0 });
        assert.equal(result.skipped.unsafe, 2);
        assert.equal(result.skipped.outside, 1);
        assert.match(toMarkdown(result), /\| `.*tasks\/:id` \|.*\| 3 \| 1 menus \|/);
    });

    it("closes the browser", async () => {
        await browser.close();
    });
});
