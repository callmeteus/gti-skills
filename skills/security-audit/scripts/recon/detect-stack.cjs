#!/usr/bin/env node
"use strict";

/**
 * Read-only inventory of a repository for Phase 1 reconnaissance.
 *
 * Usage: node detect-stack.cjs <target-dir> [--format json|text] [--max-files N]
 *
 * Reports languages, manifests, CI and deployment files, companion files worth
 * checking, and security tools already on PATH. It never executes target code,
 * never runs the tools it finds, never follows symlinks, and never uses the
 * network. Its output is a list of leads: a companion is selected only when
 * reconnaissance finds the trust boundary its "When to use this file" section
 * describes, never because a dependency name appears here.
 */

const fs = require("node:fs");
const path = require("node:path");

const SKIP_DIRS = new Set([
  ".git", ".hg", ".svn", "node_modules", "bower_components", "vendor", "third_party",
  "dist", "build", "out", "target", ".next", ".nuxt", ".svelte-kit", ".turbo", ".cache",
  "coverage", "__pycache__", ".venv", "venv", ".tox", ".mypy_cache", ".pytest_cache",
  ".gradle", ".idea", ".vscode", "Pods", "DerivedData",
]);

const LANGUAGES = {
  ".js": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript", ".jsx": "JavaScript",
  ".ts": "TypeScript", ".tsx": "TypeScript", ".mts": "TypeScript", ".cts": "TypeScript",
  ".py": "Python", ".rb": "Ruby", ".php": "PHP", ".go": "Go", ".rs": "Rust",
  ".java": "Java", ".kt": "Kotlin", ".kts": "Kotlin", ".scala": "Scala", ".cs": "C#",
  ".c": "C", ".h": "C/C++ header", ".cc": "C++", ".cpp": "C++", ".cxx": "C++", ".hpp": "C++",
  ".m": "Objective-C", ".mm": "Objective-C++", ".swift": "Swift", ".dart": "Dart",
  ".ex": "Elixir", ".exs": "Elixir", ".erl": "Erlang", ".zig": "Zig", ".lua": "Lua",
  ".sh": "Shell", ".ps1": "PowerShell", ".sql": "SQL", ".tf": "Terraform", ".proto": "Protobuf",
  ".graphql": "GraphQL", ".gql": "GraphQL", ".sol": "Solidity", ".vue": "Vue", ".svelte": "Svelte",
};

const MANIFESTS = new Set([
  "package.json", "requirements.txt", "pyproject.toml", "Pipfile", "setup.py", "go.mod",
  "Cargo.toml", "pom.xml", "build.gradle", "build.gradle.kts", "Gemfile", "composer.json",
  "mix.exs", "pubspec.yaml", "Package.swift", "CMakeLists.txt", "Makefile", "meson.build",
  "deno.json", "bun.lockb",
]);

const C = {
  web: "references/domains/application/web-protocol-and-auth.md",
  client: "references/domains/application/client-side.md",
  ai: "references/domains/application/ai-and-llm.md",
  rpc: "references/domains/application/protocols-rpc-and-messaging.md",
  data: "references/domains/application/data-isolation-and-lifecycle.md",
  native: "references/domains/platform/memory-safety-and-binary.md",
  supply: "references/domains/platform/supply-chain-and-release.md",
  cloud: "references/domains/platform/cloud-and-deployment.md",
  dos: "references/domains/platform/resource-exhaustion-and-availability.md",
  app: "references/domains/platform/desktop-mobile-and-local-ipc.md",
};

// Dependency names (npm, PyPI, Go, Cargo, gems) mapped to the companions they hint at.
const DEPENDENCY_HINTS = [
  [/^(express|fastify|koa|hapi|@hapi\/hapi|@nestjs\/core|next|nuxt|hono|restify|django|flask|fastapi|starlette|aiohttp|tornado|rails|sinatra|laravel\/framework|symfony\/http-kernel|github\.com\/gin-gonic\/gin|github\.com\/labstack\/echo|github\.com\/gofiber\/fiber|actix-web|axum|rocket|warp)$/i, ["web", "dos"]],
  [/(passport|jsonwebtoken|jose|next-auth|@auth\/|oauth|openid|saml|pyjwt|authlib|devise|omniauth|webauthn|simplewebauthn|bcrypt|argon2|express-session|cookie-session|lucia|clerk|supabase)/i, ["web"]],
  [/^(react|react-dom|vue|svelte|@angular\/core|solid-js|preact|lit|jquery|dompurify|marked|markdown-it|sanitize-html|htmx\.org)$/i, ["client"]],
  [/(openai|@anthropic-ai\/|^anthropic$|langchain|llamaindex|llama-index|@modelcontextprotocol\/|^mcp$|fastmcp|@google\/generative-ai|google-generativeai|ollama|transformers|^ai$|@ai-sdk\/|cohere|mistralai)/i, ["ai"]],
  [/(grpc|protobuf|capnp|thrift|graphql|apollo|kafka|amqp|rabbitmq|nats|bullmq|^bull$|celery|sidekiq|@aws-sdk\/client-sqs|pubsub|zeromq|^ws$|socket\.io|mqtt|svix|stripe)/i, ["rpc"]],
  [/(prisma|sequelize|typeorm|mongoose|knex|drizzle|sqlalchemy|django-tenants|activerecord|gorm|diesel|sqlx|redis|ioredis|elasticsearch|@elastic\/|meilisearch|typesense|algolia)/i, ["data"]],
  [/(multer|busboy|formidable|sharp|jimp|pdfkit|pdf-parse|xml2js|fast-xml-parser|lxml|pillow|unzipper|adm-zip|archiver|yauzl|tar|js-yaml|pyyaml|ffmpeg)/i, ["dos"]],
  [/^(electron|@tauri-apps\/api|react-native|expo|@capacitor\/core|cordova|nw)$/i, ["app", "client"]],
  [/(ffi-napi|node-gyp|napi|neon|pyo3|cffi|ctypes|cgo|bindgen|wasm-bindgen)/i, ["native"]],
];

// File and folder signals: [test(relativePath, baseName), companion keys, label].
const FILE_HINTS = [
  [(rel) => /^\.github\/workflows\/.+\.ya?ml$/.test(rel), ["supply"], "GitHub Actions workflow"],
  [(rel, base) => [".gitlab-ci.yml", "Jenkinsfile", "azure-pipelines.yml", ".travis.yml", "bitbucket-pipelines.yml", ".drone.yml"].includes(base) || /^\.circleci\//.test(rel) || /^\.buildkite\//.test(rel), ["supply"], "CI pipeline"],
  [(rel, base) => [".goreleaser.yml", ".goreleaser.yaml", ".releaserc", ".releaserc.json", "release-please-config.json", "lerna.json", ".changeset"].includes(base), ["supply"], "Release automation"],
  [(rel, base) => /^Dockerfile/.test(base) || base.endsWith(".dockerfile") || /^(docker-)?compose\.ya?ml$/.test(base) || base === "docker-compose.yml", ["cloud"], "Container definition"],
  [(rel, base) => base.endsWith(".tf") || base === "terragrunt.hcl" || base === "Pulumi.yaml" || base === "cdk.json" || base === "serverless.yml" || base === "template.yaml" || base === "wrangler.toml" || base === "wrangler.jsonc" || base === "fly.toml" || base === "vercel.json" || base === "netlify.toml" || base === "app.yaml", ["cloud"], "Infrastructure or platform config"],
  [(rel, base) => base === "Chart.yaml" || base === "kustomization.yaml" || /(^|\/)(k8s|kubernetes|helm|manifests|deploy)\//.test(rel) && /\.ya?ml$/.test(base), ["cloud"], "Kubernetes or Helm"],
  [(rel, base) => base.endsWith(".proto") || base.endsWith(".thrift") || base.endsWith(".capnp") || base.endsWith(".graphql") || base.endsWith(".gql") || base === "asyncapi.yaml", ["rpc"], "Protocol or schema definition"],
  [(rel, base) => /(^|\/)(migrations?|alembic|db\/migrate)\//.test(rel) || base === "schema.prisma", ["data"], "Database schema or migration"],
  [(rel, base) => base === "AndroidManifest.xml" || base === "Info.plist" || base.endsWith(".entitlements") || base === "pubspec.yaml" || base === "tauri.conf.json" || /\.xcodeproj\//.test(rel), ["app"], "Native app manifest"],
  [(rel, base) => /^(service-worker|sw)\.(js|ts)$/.test(base) || (base === "manifest.json" && /extension|chrome|firefox/i.test(rel)), ["client"], "Service worker or browser extension"],
  [(rel, base) => [".c", ".cc", ".cpp", ".cxx", ".m", ".mm", ".zig"].includes(path.extname(base)), ["native"], "Memory-unsafe source"],
  [(rel, base) => base === "binding.gyp" || base === "build.rs" || base === "CMakeLists.txt", ["native"], "Native build"],
  [(rel, base) => /(^|\/)(mcp|agents?|prompts?|llm|rag)\//i.test(rel) || /\.prompt(\.md)?$/.test(base), ["ai"], "Model, prompt, or agent code"],
  [(rel, base) => /(^|\/)(plugins?|extensions?|addons?)\//.test(rel), ["supply"], "Plugin or extension loader"],
  [(rel, base) => /(^|\/)(webhooks?)\//i.test(rel), ["rpc"], "Webhook handler"],
];

// Local tools worth knowing about. They are lead generators only; the skill
// never runs them without the sandbox and never treats their output as a finding.
const SECURITY_TOOLS = [
  "semgrep", "gitleaks", "trufflehog", "osv-scanner", "trivy", "grype", "syft", "bandit",
  "gosec", "govulncheck", "brakeman", "cargo-audit", "cargo-deny", "pip-audit", "npm",
  "pnpm", "yarn", "checkov", "tfsec", "hadolint", "zizmor", "actionlint", "codeql",
];

function listToolsOnPath(env = process.env) {
  const dirs = String(env.PATH || env.Path || "").split(path.delimiter).filter(Boolean);
  const extensions = process.platform === "win32"
    ? String(env.PATHEXT || ".EXE;.CMD;.BAT").split(";").map((ext) => ext.toLowerCase()).concat([""])
    : [""];
  const found = [];
  for (const tool of SECURITY_TOOLS) {
    outer: for (const dir of dirs) {
      for (const ext of extensions) {
        try {
          const stat = fs.statSync(path.join(dir, tool + ext));
          if (stat.isFile()) { found.push(tool); break outer; }
        } catch { /* not here */ }
      }
    }
  }
  return found;
}

function readSmallText(file, limit = 512 * 1024) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.size > limit) return null;
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function dependencyNames(relative, text) {
  const base = path.basename(relative);
  const names = [];
  if (base === "package.json") {
    try {
      const json = JSON.parse(text);
      for (const key of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
        if (json[key] && typeof json[key] === "object") names.push(...Object.keys(json[key]));
      }
    } catch { /* malformed manifest: ignore */ }
  } else if (base === "requirements.txt" || base === "Pipfile") {
    for (const line of text.split(/\r?\n/)) {
      const match = line.trim().match(/^([A-Za-z0-9_.-]+)/);
      if (match && !line.trim().startsWith("#")) names.push(match[1]);
    }
  } else if (base === "pyproject.toml" || base === "Cargo.toml") {
    for (const match of text.matchAll(/^\s*"?([A-Za-z0-9_.-]+)"?\s*(=|[<>=~!]=?|\[)/gm)) names.push(match[1]);
    // Quoted PEP 508 strings such as "mcp", "httpx>=0.27", or "uvicorn[standard]".
    for (const match of text.matchAll(/"([A-Za-z0-9_.-]+)(?:\s*[<>=~!;\[][^"\n]*)?"/g)) names.push(match[1]);
  } else if (base === "go.mod") {
    for (const match of text.matchAll(/^\s*(?:require\s+)?([a-z0-9.-]+\.[a-z]+\/[^\s]+)\s+v/gm)) names.push(match[1]);
  } else if (base === "Gemfile") {
    for (const match of text.matchAll(/^\s*gem\s+["']([^"']+)["']/gm)) names.push(match[1]);
  } else if (base === "composer.json") {
    try {
      const json = JSON.parse(text);
      for (const key of ["require", "require-dev"]) if (json[key]) names.push(...Object.keys(json[key]));
    } catch { /* ignore */ }
  }
  return [...new Set(names)];
}

/**
 * Walks the target without following symlinks and returns the inventory.
 *
 * @param {string} target Repository root
 * @param {{ maxFiles?: number, env?: NodeJS.ProcessEnv }} [options] Limits
 * @returns {object} Inventory
 */
function inventory(target, options = {}) {
  const maxFiles = options.maxFiles ?? 50000;
  const root = path.resolve(target);
  const languages = {};
  const manifests = [];
  const companions = {};
  let filesScanned = 0;
  let truncated = false;
  let rustUnsafe = 0;

  const addSignal = (key, signal) => {
    const file = C[key];
    companions[file] = companions[file] || [];
    if (companions[file].length < 12 && !companions[file].some((s) => s.signal === signal.signal && s.path === signal.path)) {
      companions[file].push(signal);
    }
  };

  const stack = [root];
  while (stack.length > 0 && !truncated) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join("/");
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) stack.push(full);
        if (entry.name.endsWith(".xcodeproj")) addSignal("app", { signal: "Native app manifest", path: rel });
        continue;
      }
      if (!entry.isFile()) continue;
      if (++filesScanned > maxFiles) { truncated = true; break; }

      const ext = path.extname(entry.name).toLowerCase();
      if (LANGUAGES[ext]) languages[LANGUAGES[ext]] = (languages[LANGUAGES[ext]] || 0) + 1;

      for (const [test, keys, label] of FILE_HINTS) {
        if (test(rel, entry.name)) for (const key of keys) addSignal(key, { signal: label, path: rel });
      }

      if (MANIFESTS.has(entry.name) || /\.(csproj|fsproj|sln)$/.test(entry.name)) {
        manifests.push(rel);
        const text = readSmallText(full);
        if (text) {
          for (const name of dependencyNames(rel, text)) {
            for (const [pattern, keys] of DEPENDENCY_HINTS) {
              if (pattern.test(name)) for (const key of keys) addSignal(key, { signal: `dependency ${name}`, path: rel });
            }
          }
        }
      }

      if (ext === ".rs" && rustUnsafe < 1000) {
        const text = readSmallText(full, 256 * 1024);
        if (text) {
          const count = (text.match(/\bunsafe\s*(\{|fn|impl)/g) || []).length;
          if (count > 0) { rustUnsafe += count; addSignal("native", { signal: `${count} Rust unsafe block(s)`, path: rel }); }
        }
      }
    }
  }

  const companionList = Object.entries(companions)
    .map(([file, signals]) => ({ file, signals }))
    .sort((a, b) => b.signals.length - a.signals.length || (a.file < b.file ? -1 : 1));

  return {
    target: root,
    files_scanned: Math.min(filesScanned, maxFiles),
    truncated,
    languages: Object.fromEntries(Object.entries(languages).sort((a, b) => b[1] - a[1])),
    manifests: manifests.sort(),
    companions_to_check: companionList,
    security_tools_on_path: listToolsOnPath(options.env),
    note: "Leads only. Select a companion when reconnaissance finds the boundary its 'When to use this file' section describes.",
  };
}

function toText(result) {
  const lines = [];
  lines.push(`Target: ${result.target}`);
  lines.push(`Files scanned: ${result.files_scanned}${result.truncated ? " (truncated, raise --max-files)" : ""}`);
  lines.push("");
  lines.push("Languages:");
  for (const [name, count] of Object.entries(result.languages)) lines.push(`  ${name}: ${count}`);
  lines.push("");
  lines.push("Manifests:");
  for (const manifest of result.manifests) lines.push(`  ${manifest}`);
  lines.push("");
  lines.push("Companions to check (leads, not selections):");
  for (const { file, signals } of result.companions_to_check) {
    lines.push(`  ${file}`);
    for (const signal of signals) lines.push(`    - ${signal.signal} (${signal.path})`);
  }
  lines.push("");
  lines.push(`Security tools on PATH: ${result.security_tools_on_path.join(", ") || "none"}`);
  lines.push("");
  lines.push(result.note);
  return lines.join("\n") + "\n";
}

function run(argv) {
  let target = null;
  let format = "json";
  let maxFiles = 50000;
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === "--format") format = argv[++index];
    else if (value === "--max-files") maxFiles = Number(argv[++index]);
    else if (!target) target = value;
    else { console.error(`unexpected argument: ${value}`); return 2; }
  }
  if (!target || !["json", "text"].includes(format) || !Number.isInteger(maxFiles) || maxFiles < 1) {
    console.error("Usage: node detect-stack.cjs <target-dir> [--format json|text] [--max-files N]");
    return 2;
  }
  let stat;
  try { stat = fs.statSync(target); } catch { stat = null; }
  if (!stat || !stat.isDirectory()) {
    console.error("Target must be an existing directory");
    return 1;
  }
  const result = inventory(target, { maxFiles });
  process.stdout.write(format === "text" ? toText(result) : JSON.stringify(result, null, 2) + "\n");
  return 0;
}

module.exports = { inventory, dependencyNames, listToolsOnPath, toText };

if (require.main === module) process.exit(run(process.argv.slice(2)));
