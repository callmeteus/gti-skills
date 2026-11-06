import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
    assertOutside,
    defaultToolsDir,
    detectRunner,
    isInside,
    main,
    missingPackages,
    mutationScore,
    PACKAGES,
    strykerConfig,
    workDir,
} from "../scripts/tools/js-tools.mjs";

function tempDir(t) {
    const dir = mkdtempSync(join(tmpdir(), "js-tools-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    return dir;
}

function project(t, pkg) {
    const dir = tempDir(t);
    writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
    return dir;
}

test("refuses a tools folder inside the project and accepts one beside it", (t) => {
    const root = tempDir(t);
    const app = join(root, "app");
    assert.throws(() => assertOutside(join(app, ".tools"), app), /inside the project/);
    assert.throws(() => assertOutside(app, app), /inside the project/);
    assert.doesNotThrow(() => assertOutside(join(root, "tools"), app));
    assert.equal(isInside(join(root, "app-tools"), app), false);
});

test("defaults to a folder in the home directory, overridable by GTI_TEST_TOOLS_DIR", () => {
    assert.match(defaultToolsDir({}), /\.gti-skills[\\/]tools[\\/]node$/);
    assert.equal(defaultToolsDir({ GTI_TEST_TOOLS_DIR: join(tmpdir(), "x") }), join(tmpdir(), "x"));
});

test("gives each project its own stable work folder inside the tools folder", () => {
    const tools = join(tmpdir(), "tools");
    const a = workDir(tools, join(tmpdir(), "shop"));
    assert.equal(a, workDir(tools, join(tmpdir(), "shop")));
    assert.notEqual(a, workDir(tools, join(tmpdir(), "other", "shop")));
    assert.ok(isInside(a, join(tools, "work")));
});

test("detects the project's test runner", (t) => {
    assert.equal(detectRunner(project(t, { devDependencies: { vitest: "3" } })), "vitest");
    assert.equal(detectRunner(project(t, { devDependencies: { jest: "29" } })), "jest");
    assert.equal(detectRunner(project(t, { scripts: { test: "mocha 'test/**'" } })), "mocha");
    assert.equal(detectRunner(project(t, { scripts: { test: "node --test" } })), "command");
});

test("writes every Stryker output into the work folder, never the project", () => {
    const work = join(tmpdir(), "tools", "work", "shop-1234");
    const config = strykerConfig({ runner: "vitest", mutate: ["src/a.ts"], work });
    for (const path of [config.htmlReporter.fileName, config.jsonReporter.fileName, config.tempDirName]) {
        assert.ok(isInside(path, work), path);
    }
    assert.equal(config.inPlace, false);
    assert.equal(config.incremental, false);
    assert.deepEqual(strykerConfig({ runner: "command", mutate: ["x"], work, testCommand: "npm run test:unit" }).commandRunner, { command: "npm run test:unit" });
});

test("computes the mutation score the way Stryker does", () => {
    const report = {
        files: {
            "a.ts": { mutants: [{ status: "Killed" }, { status: "Killed" }, { status: "Timeout" }, { status: "Survived" }] },
            "b.ts": { mutants: [{ status: "NoCoverage" }, { status: "CompileError" }, { status: "Ignored" }] },
        },
    };
    assert.equal(mutationScore(report).score, 60);
    assert.equal(mutationScore({ files: {} }).score, null);
});

test("reports every package as missing in an empty tools folder", (t) => {
    assert.deepEqual(missingPackages(tempDir(t)), Object.keys(PACKAGES));
});

test("stryker and property refuse to run before install, and property files must live in the work folder", (t) => {
    const tools = tempDir(t);
    const app = project(t, { devDependencies: { vitest: "3" } });
    const errors = [];
    const original = console.error;
    console.error = (line) => errors.push(line);
    try {
        assert.equal(main(["stryker", "--project", app, "--mutate", "src/a.ts", "--tools-dir", tools]), 1);
        assert.equal(main(["stryker", "--project", app, "--tools-dir", tools]), 1);
        for (const name of Object.keys(PACKAGES)) {
            const dir = join(tools, "node_modules", ...name.split("/"));
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, "package.json"), JSON.stringify({ version: `${PACKAGES[name]}.0.0` }));
        }
        writeFileSync(join(app, "prop.ts"), "");
        assert.equal(main(["property", "--project", app, join(app, "prop.ts"), "--tools-dir", tools]), 1);
    } finally {
        console.error = original;
    }
    assert.match(errors[0], /Missing in/);
    assert.match(errors[1], /--mutate is required/);
    assert.match(errors[2], /Property files live in the work folder/);
});
