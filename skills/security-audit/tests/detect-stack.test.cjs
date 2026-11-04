const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { inventory, dependencyNames } = require("../scripts/recon/detect-stack.cjs");

const scriptPath = path.join(__dirname, "..", "scripts", "recon", "detect-stack.cjs");

function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "detect-stack-"));
  for (const [relative, contents] of Object.entries(files)) {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }
  return root;
}

function companion(result, suffix) {
  return result.companions_to_check.find((entry) => entry.file.endsWith(suffix));
}

test("points a web API with an LLM client at the web, AI, and data companions", (t) => {
  const root = makeRepo({
    "package.json": JSON.stringify({ dependencies: { express: "^4", "@anthropic-ai/sdk": "^1", prisma: "^5", jsonwebtoken: "^9" } }),
    "src/server.ts": "export {}",
    "prisma/schema.prisma": "model User { id Int @id }",
    ".github/workflows/ci.yml": "on: push",
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = inventory(root, { env: { PATH: "" } });

  assert.equal(result.languages.TypeScript, 1);
  assert.deepEqual(result.manifests, ["package.json"]);
  assert.ok(companion(result, "web-protocol-and-auth.md").signals.some((s) => s.signal === "dependency jsonwebtoken"));
  assert.ok(companion(result, "ai-and-llm.md").signals.some((s) => s.signal === "dependency @anthropic-ai/sdk"));
  assert.ok(companion(result, "data-isolation-and-lifecycle.md").signals.some((s) => s.path === "prisma/schema.prisma"));
  assert.ok(companion(result, "supply-chain-and-release.md").signals.some((s) => s.path === ".github/workflows/ci.yml"));
  assert.equal(companion(result, "memory-safety-and-binary.md"), undefined);
});

test("flags native code, Rust unsafe blocks, and infrastructure files", (t) => {
  const root = makeRepo({
    "Cargo.toml": "[package]\nname = \"demo\"\n[dependencies]\naxum = \"0.7\"\n",
    "src/lib.rs": "pub fn f(p: *const u8) -> u8 { unsafe { *p } }",
    "native/parse.c": "int main(void) { return 0; }",
    "Dockerfile": "FROM scratch",
    "infra/main.tf": "resource \"x\" \"y\" {}",
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = inventory(root, { env: { PATH: "" } });
  const native = companion(result, "memory-safety-and-binary.md");

  assert.ok(native.signals.some((s) => s.signal === "1 Rust unsafe block(s)" && s.path === "src/lib.rs"));
  assert.ok(native.signals.some((s) => s.path === "native/parse.c"));
  assert.ok(companion(result, "cloud-and-deployment.md").signals.some((s) => s.path === "Dockerfile"));
  assert.ok(companion(result, "cloud-and-deployment.md").signals.some((s) => s.path === "infra/main.tf"));
  assert.ok(companion(result, "web-protocol-and-auth.md").signals.some((s) => s.signal === "dependency axum"));
});

test("skips dependency and build folders and stops at the file limit", (t) => {
  const root = makeRepo({
    "node_modules/evil/package.json": JSON.stringify({ dependencies: { openai: "1" } }),
    "dist/bundle.js": "",
    "a.py": "", "b.py": "", "c.py": "",
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const full = inventory(root, { env: { PATH: "" } });
  assert.equal(companion(full, "ai-and-llm.md"), undefined);
  assert.equal(full.languages.JavaScript, undefined);

  const limited = inventory(root, { maxFiles: 2, env: { PATH: "" } });
  assert.equal(limited.truncated, true);
  assert.equal(limited.files_scanned, 2);
});

test("reads dependency names from Python, Go, and Ruby manifests", () => {
  assert.deepEqual(
    dependencyNames("pyproject.toml", "[project]\ndependencies = [\n  \"mcp\",\n  \"httpx>=0.27\",\n  \"uvicorn[standard]\"\n]\n").filter((n) => ["mcp", "httpx", "uvicorn"].includes(n)).sort(),
    ["httpx", "mcp", "uvicorn"],
  );
  assert.deepEqual(dependencyNames("requirements.txt", "# comment\nfastapi==0.110\nlangchain>=0.2\n"), ["fastapi", "langchain"]);
  assert.deepEqual(dependencyNames("go.mod", "module x\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n)\n"), ["github.com/gin-gonic/gin"]);
  assert.deepEqual(dependencyNames("Gemfile", "source 'x'\ngem 'rails'\ngem \"devise\"\n"), ["rails", "devise"]);
});

test("CLI prints JSON and rejects a missing target", (t) => {
  const root = makeRepo({ "main.go": "package main" });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const ok = spawnSync(process.execPath, [scriptPath, root], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).languages.Go, 1);

  const missing = spawnSync(process.execPath, [scriptPath, path.join(root, "nope")], { encoding: "utf8" });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /existing directory/);
});
