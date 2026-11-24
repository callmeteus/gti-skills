import { test } from "node:test";
import assert from "node:assert/strict";
import { shortPath, esc } from "../central/public/js/format.mjs";
import { pendingReplies } from "../central/public/js/pending.mjs";

test("a path under home starts with ~ and a long one keeps its ends", () => {
    assert.equal(shortPath("C:\\Users\\me\\.gti\\maestro", "C:\\Users\\me"), "~\\.gti\\maestro");
    assert.equal(shortPath("/home/me/.gti/maestro/preferences.json", "/home/me"), "~/.gti/maestro/preferences.json");
    assert.equal(
        shortPath("C:\\Users\\me\\AppData\\Local\\Temp\\claude\\abc\\scratchpad\\gti\\maestro\\_demo", "C:\\Users\\me"),
        "~\\\u2026\\maestro\\_demo",
    );
});

test("replies name the item, the project, and the run", () => {
    const replies = pendingReplies("billing-api", "run-2", "Push the branch");
    assert.equal(replies.approve, "Approved: Push the branch (billing-api, run-2). Go ahead.");
    assert.match(replies.decline, /^Declined: Push the branch \(billing-api, run-2\)\. Do not do it/);
    assert.match(pendingReplies("shop", null, "Deploy").approve, /\(shop\)/);
});

test("escaping covers markup and quotes", () => {
    assert.equal(esc(`<a href="x">'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&lt;/a&gt;");
});
