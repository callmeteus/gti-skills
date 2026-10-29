import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { parseArgs } from "../core/Args.mjs";
import { parseFrontmatter, splitFrontmatter, validateSkillFolder } from "../core/Frontmatter.mjs";
import { renderGenerated, renderGuide } from "../core/Generated.mjs";
import { loadPacks, selectSkills, validateSkillPacks } from "../core/Packs.mjs";
import { loadHarnesses, selectHarnesses, skillsFolder } from "../core/Registry.mjs";
import { diffTree, normalizeContent, readTree, writeTree } from "../core/Tree.mjs";

const GoodSkill = `---
name: demo
description: >-
  Does a demo. Use when the user asks for a demo.
---

# Demo

## Core Rule

Always respond in the user's language, regardless of the language used in this skill.
`;

/**
 * Creates a temporary skill folder.
 *
 * @param {string} text SKILL.md content
 * @param {Record<string, string>} [extra] Extra files by relative path
 * @returns {string} Skill folder
 */
function makeSkill(text, extra = {}) {
    const dir = join(mkdtempSync(join(tmpdir(), "gti-skill-")), "demo");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), text);

    for (const [path, content] of Object.entries(extra)) {
        mkdirSync(join(dir, path, ".."), { recursive: true });
        writeFileSync(join(dir, path), content);
    }

    return dir;
}

describe("parseArgs", () => {
    it("separates the command from flags and switches", () => {
        const parsed = parseArgs(["install", "--harness", "cursor,claude", "--dry-run", "--scope", "user"]);
        assert.equal(parsed.command, "install");
        assert.deepEqual(parsed.flags, { harness: "cursor,claude", "dry-run": true, scope: "user" });
    });
});

describe("frontmatter", () => {
    it("parses folded, literal, and quoted values", () => {
        const { block } = splitFrontmatter("---\nname: x\ndescription: >-\n  one\n  two\nlicense: \"MIT\"\n---\nbody");
        assert.deepEqual(parseFrontmatter(block), { name: "x", description: "one two", license: "MIT" });
    });

    it("accepts a good skill", () => {
        assert.deepEqual(validateSkillFolder(makeSkill(GoodSkill), "demo"), { errors: [], warnings: [] });
    });

    it("rejects wrong names, missing rule, long description, dashes, and broken links", () => {
        const wrongName = validateSkillFolder(makeSkill(GoodSkill), "other");
        assert.ok(wrongName.errors.some((error) => error.includes("must equal the skill id")));

        const noRule = validateSkillFolder(makeSkill(GoodSkill.replace("respond in the user's language", "reply")), "demo");
        assert.ok(noRule.errors.some((error) => error.includes("Core Rule")));

        const longDescription = validateSkillFolder(makeSkill(GoodSkill.replace("Does a demo.", "x".repeat(1100))), "demo");
        assert.ok(longDescription.errors.some((error) => error.includes("1024")));

        const dashed = validateSkillFolder(makeSkill(`${GoodSkill}\nbad — dash\n`), "demo");
        assert.ok(dashed.errors.some((error) => error.includes("dash")));

        const broken = validateSkillFolder(makeSkill(`${GoodSkill}\nSee [x](references/x.md).\n`), "demo");
        assert.ok(broken.errors.includes("broken link: references/x.md"));
    });

    it("checks links inside references", () => {
        const dir = makeSkill(GoodSkill, { "references/a.md": "See [b](b.md) and [c](../missing.md)." });
        writeFileSync(join(dir, "references", "b.md"), "ok");
        const { errors } = validateSkillFolder(dir, "demo");
        assert.deepEqual(errors, ["broken link in references/a.md: ../missing.md"]);
    });

    it("warns when the description has no trigger", () => {
        const { warnings } = validateSkillFolder(makeSkill(GoodSkill.replace("Use when the user asks for a demo.", "Nice.")), "demo");
        assert.equal(warnings.length, 1);
    });
});

describe("packs", () => {
    const packs = [{ id: "coding", name: "Coding", description: "" }, { id: "art", name: "Art", description: "" }, { id: "personal", name: "Personal", description: "" }];
    const skills = [{ id: "a", packs: ["coding"] }, { id: "b", packs: ["coding", "art"] }, { id: "c", packs: ["art"] }];

    it("loads the registry with unique ids", () => {
        const ids = loadPacks().map((pack) => pack.id);
        assert.ok(ids.includes("coding"));
        assert.equal(new Set(ids).size, ids.length);
    });

    it("selects every skill by default and with all", () => {
        assert.equal(selectSkills(skills, packs, {}).length, 3);
        assert.equal(selectSkills(skills, packs, { pack: "all" }).length, 3);
        assert.equal(selectSkills(skills, packs, { skill: "all" }).length, 3);
    });

    it("selects the union of packs and skills", () => {
        assert.deepEqual(selectSkills(skills, packs, { pack: "coding" }).map((skill) => skill.id), ["a", "b"]);
        assert.deepEqual(selectSkills(skills, packs, { pack: "art", skill: "a" }).map((skill) => skill.id), ["a", "b", "c"]);
        assert.deepEqual(selectSkills(skills, packs, { pack: "personal" }), []);
    });

    it("rejects unknown packs and skills", () => {
        assert.throws(() => selectSkills(skills, packs, { pack: "nope" }), /Unknown pack "nope"/);
        assert.throws(() => selectSkills(skills, packs, { skill: "nope" }), /Unknown skill "nope"/);
    });

    it("requires every skill to name at least one known pack", () => {
        assert.deepEqual(validateSkillPacks({ packs: ["art"] }, packs), []);
        assert.match(validateSkillPacks({ packs: [] }, packs)[0], /no packs/);
        assert.match(validateSkillPacks({ packs: ["nope"] }, packs)[0], /unknown pack "nope"/);
    });
});

describe("registry", () => {
    it("lists the ten supported agents with unique ids", () => {
        const harnesses = loadHarnesses();
        const ids = harnesses.map((harness) => harness.id);
        assert.deepEqual(ids, ["cursor", "claude", "antigravity", "opencode", "cline", "kilo", "kiro", "codex", "copilot", "muse"]);
        assert.equal(new Set(ids).size, ids.length);
    });

    it("selects by id and rejects unknown ids", () => {
        const harnesses = loadHarnesses();
        assert.equal(selectHarnesses(harnesses, "all").length, 10);
        assert.deepEqual(selectHarnesses(harnesses, "kiro, cline").map((harness) => harness.id), ["kiro", "cline"]);
        assert.throws(() => selectHarnesses(harnesses, "nope"), /Unknown harness "nope"/);
    });

    it("resolves project and user skill folders", () => {
        const claude = loadHarnesses().find((harness) => harness.id === "claude");
        assert.equal(skillsFolder(claude, "project", join("a", "b")), join("a", "b", ".claude", "skills"));
        assert.equal(skillsFolder(claude, "user", "ignored", join("h")), join("h", ".claude", "skills"));
    });

    it("renders a guide per agent with install paths, invocation, and notes", () => {
        const harnesses = loadHarnesses();
        const skill = { id: "demo", displayName: "Demo Skill", harnessNotes: { "*": "General note.", cursor: "Cursor note." } };
        const claude = renderGuide(skill, harnesses.find((harness) => harness.id === "claude"));
        assert.ok(claude.startsWith("# Using Demo Skill in Claude / Claude Code"));
        assert.ok(claude.includes("`.claude/skills/demo/`"));
        assert.ok(claude.includes("`~/.claude/skills/demo/`"));
        assert.ok(claude.includes("typing `/demo`"));
        assert.ok(claude.includes("--harness claude --skill demo"));
        assert.ok(claude.includes("General note.") && !claude.includes("Cursor note."));

        const kilo = renderGuide(skill, harnesses.find((harness) => harness.id === "kilo"));
        assert.ok(kilo.includes("kilo debug skill"));
        assert.ok(kilo.includes("Use the demo skill to ..."));
        assert.ok(!/[–—]/.test(kilo));
    });

    it("renders the install locations document for every agent", () => {
        const harnesses = loadHarnesses();
        const text = renderGenerated("install-locations", harnesses);

        for (const harness of harnesses) {
            assert.ok(text.includes(harness.projectPath));
            assert.ok(text.includes(harness.name));
        }

        assert.ok(!/[–—]/.test(text));
        assert.throws(() => renderGenerated("missing", harnesses), /Unknown generated template/);
    });
});

describe("tree helpers", () => {
    it("normalizes line endings of text files only", () => {
        assert.equal(normalizeContent("a.md", Buffer.from("a\r\nb")).toString(), "a\nb");
        assert.equal(normalizeContent("a.png", Buffer.from("a\r\nb")).toString(), "a\r\nb");
    });

    it("reports missing, changed, and stale files", () => {
        const root = mkdtempSync(join(tmpdir(), "gti-tree-"));
        writeTree(new Map([["a.md", Buffer.from("1")], ["sub/b.md", Buffer.from("2")], ["stale.md", Buffer.from("3")]]), root);
        const expected = new Map([["a.md", Buffer.from("1")], ["sub/b.md", Buffer.from("changed")], ["new.md", Buffer.from("4")]]);
        const differences = diffTree(expected, root);
        assert.deepEqual(differences.map((difference) => `${difference.path}:${difference.problem}`).sort(), [
            "new.md:missing",
            "stale.md:stale",
            "sub/b.md:changed"
        ]);
        assert.equal(readTree(root).size, 3);
    });
});
