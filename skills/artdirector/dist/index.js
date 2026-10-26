// src/core/Types.ts
var ArtCommand = /* @__PURE__ */ ((ArtCommand3) => {
  ArtCommand3["INIT"] = "init";
  ArtCommand3["BRIEF"] = "brief";
  ArtCommand3["SHAPE"] = "shape";
  ArtCommand3["CRAFT"] = "craft";
  ArtCommand3["GENERATE"] = "generate";
  ArtCommand3["LIVE"] = "live";
  ArtCommand3["CRITIQUE"] = "critique";
  ArtCommand3["AUDIT"] = "audit";
  ArtCommand3["POLISH"] = "polish";
  ArtCommand3["BOLDER"] = "bolder";
  ArtCommand3["QUIETER"] = "quieter";
  ArtCommand3["TYPESET"] = "typeset";
  ArtCommand3["COLORIZE"] = "colorize";
  ArtCommand3["LAYOUT"] = "layout";
  ArtCommand3["DISTILL"] = "distill";
  ArtCommand3["ADAPT"] = "adapt";
  ArtCommand3["EXPORT"] = "export";
  ArtCommand3["RESUME"] = "resume";
  return ArtCommand3;
})(ArtCommand || {});
var ArtworkCategory = /* @__PURE__ */ ((ArtworkCategory2) => {
  ArtworkCategory2["INFOGRAPHIC"] = "infographic";
  ArtworkCategory2["SOCIAL_CARD"] = "social-card";
  ArtworkCategory2["COVER"] = "cover";
  ArtworkCategory2["THUMBNAIL"] = "thumbnail";
  ArtworkCategory2["SLIDE"] = "slide";
  ArtworkCategory2["EDITORIAL"] = "editorial";
  ArtworkCategory2["ILLUSTRATION"] = "illustration";
  ArtworkCategory2["TYPOGRAPHY"] = "typography";
  ArtworkCategory2["PROMOTION"] = "promotion";
  ArtworkCategory2["COUPON"] = "coupon";
  ArtworkCategory2["CAROUSEL"] = "carousel";
  ArtworkCategory2["ANNOUNCEMENT"] = "announcement";
  ArtworkCategory2["DATA_VIZ"] = "data-viz";
  return ArtworkCategory2;
})(ArtworkCategory || {});
var VisualDirection = /* @__PURE__ */ ((VisualDirection2) => {
  VisualDirection2["EDITORIAL_TYPOGRAPHIC"] = "editorial-typographic";
  VisualDirection2["BOLD_PROMOTIONAL"] = "bold-promotional";
  VisualDirection2["SWISS_INSPIRED"] = "swiss-inspired";
  VisualDirection2["MINIMALIST_GEOMETRIC"] = "minimalist-geometric";
  VisualDirection2["NEO_BRUTALIST"] = "neo-brutalist";
  VisualDirection2["PREMIUM_CORPORATE"] = "premium-corporate";
  VisualDirection2["VINTAGE_PRINT"] = "vintage-print";
  VisualDirection2["EXPRESSIVE_PLAYFUL"] = "expressive-playful";
  VisualDirection2["TECHNICAL_INFOGRAPHIC"] = "technical-infographic";
  VisualDirection2["DATA_DRIVEN_EDITORIAL"] = "data-driven-editorial";
  return VisualDirection2;
})(VisualDirection || {});
var ProductionMode = /* @__PURE__ */ ((ProductionMode2) => {
  ProductionMode2["TEMPLATE"] = "template";
  ProductionMode2["ART_DIRECTION"] = "art-direction";
  return ProductionMode2;
})(ProductionMode || {});
var VisualDensity = /* @__PURE__ */ ((VisualDensity2) => {
  VisualDensity2["SPARSE"] = "sparse";
  VisualDensity2["BALANCED"] = "balanced";
  VisualDensity2["DENSE"] = "dense";
  return VisualDensity2;
})(VisualDensity || {});
var LiveEventType = /* @__PURE__ */ ((LiveEventType2) => {
  LiveEventType2["GENERATE"] = "generate";
  LiveEventType2["STEER"] = "steer";
  LiveEventType2["ACCEPT"] = "accept";
  LiveEventType2["DISCARD"] = "discard";
  LiveEventType2["TIMEOUT"] = "timeout";
  LiveEventType2["EXIT"] = "exit";
  return LiveEventType2;
})(LiveEventType || {});
var VariantStatus = /* @__PURE__ */ ((VariantStatus2) => {
  VariantStatus2["DRAFT"] = "draft";
  VariantStatus2["SELECTED"] = "selected";
  VariantStatus2["ACCEPTED"] = "accepted";
  VariantStatus2["REJECTED"] = "rejected";
  return VariantStatus2;
})(VariantStatus || {});
var ExportFormat = /* @__PURE__ */ ((ExportFormat2) => {
  ExportFormat2["PNG"] = "png";
  ExportFormat2["JPEG"] = "jpeg";
  ExportFormat2["SVG"] = "svg";
  ExportFormat2["PDF"] = "pdf";
  ExportFormat2["HTML"] = "html";
  return ExportFormat2;
})(ExportFormat || {});
var SessionPhase = /* @__PURE__ */ ((SessionPhase2) => {
  SessionPhase2["INIT"] = "init";
  SessionPhase2["BRIEF"] = "brief";
  SessionPhase2["SHAPE"] = "shape";
  SessionPhase2["CRAFT"] = "craft";
  SessionPhase2["GENERATE"] = "generate";
  SessionPhase2["LIVE"] = "live";
  SessionPhase2["AUDIT"] = "audit";
  SessionPhase2["EXPORT"] = "export";
  SessionPhase2["DONE"] = "done";
  return SessionPhase2;
})(SessionPhase || {});

// src/core/Errors.ts
var ArtDirectorError = class extends Error {
  /**
   * Creates a typed ArtDirector error.
   *
   * @param code Stable machine-readable code
   * @param message Human-readable explanation
   * @param status HTTP status to use when the server maps this error
   */
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "ArtDirectorError";
  }
  code;
  status;
};
var ArtErrors;
((ArtErrors2) => {
  function project(message) {
    return new ArtDirectorError("PROJECT", message, 400);
  }
  ArtErrors2.project = project;
  function path(message) {
    return new ArtDirectorError("PATH", message, 403);
  }
  ArtErrors2.path = path;
  function auth(message) {
    return new ArtDirectorError("AUTH", message, 401);
  }
  ArtErrors2.auth = auth;
  function notFound(message) {
    return new ArtDirectorError("NOT_FOUND", message, 404);
  }
  ArtErrors2.notFound = notFound;
  function render(message) {
    return new ArtDirectorError("RENDER", message, 500);
  }
  ArtErrors2.render = render;
})(ArtErrors || (ArtErrors = {}));

// src/core/Ids.ts
import { randomBytes, randomUUID } from "crypto";
var Ids;
((Ids2) => {
  function uuid() {
    return randomUUID();
  }
  Ids2.uuid = uuid;
  function short(bytes = 4) {
    return randomBytes(bytes).toString("hex");
  }
  Ids2.short = short;
  function token() {
    return randomBytes(24).toString("hex");
  }
  Ids2.token = token;
  function slug(value) {
    const trimmed = value.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/-+/g, "-");
    return trimmed.slice(0, 48) || "piece";
  }
  Ids2.slug = slug;
})(Ids || (Ids = {}));

// src/core/Json.ts
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
var JsonFile;
((JsonFile2) => {
  function read(path) {
    return JSON.parse(readFileSync(path, "utf8"));
  }
  JsonFile2.read = read;
  function write(path, value) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(value, null, 4)}
`, "utf8");
  }
  JsonFile2.write = write;
  function readOr(path, fallback) {
    try {
      return read(path);
    } catch {
      return fallback;
    }
  }
  JsonFile2.readOr = readOr;
})(JsonFile || (JsonFile = {}));

// src/core/Paths.ts
import { existsSync, mkdirSync as mkdirSync2, statSync } from "fs";
import { dirname as dirname2, isAbsolute, join, normalize, relative, resolve, sep } from "path";
import { fileURLToPath } from "url";
var PackageMarker = "package.json";
var ProjectDir = ".artdirector";
var Paths;
((Paths2) => {
  function packageRoot() {
    let current = dirname2(fileURLToPath(import.meta.url));
    for (let i = 0; i < 8; i += 1) {
      const candidate = join(current, PackageMarker);
      if (existsSync(candidate)) {
        return current;
      }
      current = dirname2(current);
    }
    throw ArtErrors.path("Could not locate the ArtDirector package root.");
  }
  Paths2.packageRoot = packageRoot;
  function studioDir() {
    return join(packageRoot(), "studio");
  }
  Paths2.studioDir = studioDir;
  function libraryDir() {
    return join(packageRoot(), "library");
  }
  Paths2.libraryDir = libraryDir;
  function skillDir() {
    return join(packageRoot(), "skill", "artdirector");
  }
  Paths2.skillDir = skillDir;
  function findProjectRoot(start = process.cwd()) {
    let current = resolve(start);
    for (let i = 0; i < 12; i += 1) {
      if (existsSync(join(current, ProjectDir, "project.json"))) {
        return current;
      }
      const parent = dirname2(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
    return null;
  }
  Paths2.findProjectRoot = findProjectRoot;
  function stateDir(projectRoot) {
    const dir = join(projectRoot, ProjectDir);
    mkdirSync2(dir, { recursive: true });
    return dir;
  }
  Paths2.stateDir = stateDir;
  function variantsDir(projectRoot) {
    const dir = join(stateDir(projectRoot), "variants");
    mkdirSync2(dir, { recursive: true });
    return dir;
  }
  Paths2.variantsDir = variantsDir;
  function exportsDir(projectRoot) {
    const dir = join(stateDir(projectRoot), "exports");
    mkdirSync2(dir, { recursive: true });
    return dir;
  }
  Paths2.exportsDir = exportsDir;
  function confine(projectRoot, target) {
    const root = resolve(projectRoot);
    const absolute = resolve(isAbsolute(target) ? target : join(root, target));
    const rel = relative(root, absolute);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw ArtErrors.path(`Path is outside the project root: ${target}`);
    }
    return normalize(absolute);
  }
  Paths2.confine = confine;
  function isDir(path) {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  }
  Paths2.isDir = isDir;
  function under(projectRoot, ...segments) {
    return confine(projectRoot, join(projectRoot, ...segments));
  }
  Paths2.under = under;
  function posix(path) {
    return path.split(sep).join("/");
  }
  Paths2.posix = posix;
})(Paths || (Paths = {}));

// src/core/Auth.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync3, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "fs";
import { dirname as dirname3, join as join2 } from "path";
import { timingSafeEqual } from "crypto";
var Auth;
((Auth2) => {
  function loadOrCreate(projectRoot) {
    const file = tokenPath(projectRoot);
    if (existsSync2(file)) {
      return readFileSync2(file, "utf8").trim();
    }
    const token = Ids.token();
    mkdirSync3(dirname3(file), { recursive: true });
    writeFileSync2(file, `${token}
`, { encoding: "utf8", mode: 384 });
    return token;
  }
  Auth2.loadOrCreate = loadOrCreate;
  function tokenPath(projectRoot) {
    return join2(Paths.stateDir(projectRoot), "token");
  }
  Auth2.tokenPath = tokenPath;
  function assert(projectRoot, presented) {
    if (!presented) {
      throw ArtErrors.auth("Missing studio token.");
    }
    const expected = loadOrCreate(projectRoot);
    const left = Buffer.from(presented);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw ArtErrors.auth("Invalid studio token.");
    }
  }
  Auth2.assert = assert;
})(Auth || (Auth = {}));

// src/session/ProjectContext.ts
import { existsSync as existsSync3, mkdirSync as mkdirSync4, writeFileSync as writeFileSync3 } from "fs";
import { join as join3 } from "path";
var ProjectContext = class _ProjectContext {
  /**
   * @param root Absolute project root
   */
  constructor(root) {
    this.root = root;
  }
  root;
  /**
   * Opens an existing ArtDirector project.
   *
   * @param start Directory to search from
   * @returns Context bound to the project root
   */
  static open(start = process.cwd()) {
    const root = Paths.findProjectRoot(start);
    if (!root) {
      throw ArtErrors.project("No ArtDirector project found. Run `artdirector init` first.");
    }
    return new _ProjectContext(root);
  }
  /**
   * Creates a new project on disk.
   *
   * @param options Project name and optional root
   * @returns Context for the new project
   */
  static create(options) {
    const root = options.root ?? process.cwd();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const ctx = new _ProjectContext(root);
    const brand = defaultBrand(options.name, options.brand);
    const brief = defaultBrief(options.brief);
    const project = {
      id: Ids.uuid(),
      name: options.name,
      createdAt: now,
      updatedAt: now,
      root,
      brand,
      brief,
      combinedDirections: []
    };
    const session = {
      id: Ids.short(6),
      projectId: project.id,
      createdAt: now,
      updatedAt: now,
      phase: "init" /* INIT */,
      liveEnabled: false,
      notes: []
    };
    mkdirSync4(Paths.stateDir(root), { recursive: true });
    ctx.writeProject(project);
    ctx.writeSession(session);
    ctx.writeVariants([]);
    ctx.ensureGitignore();
    return ctx;
  }
  /**
   * Absolute `.artdirector` directory.
   *
   * @returns State directory
   */
  stateDir() {
    return Paths.stateDir(this.root);
  }
  /**
   * Loads `project.json`.
   *
   * @returns Project snapshot
   */
  project() {
    return JsonFile.read(join3(this.stateDir(), "project.json"));
  }
  /**
   * Loads `session.json`.
   *
   * @returns Session snapshot
   */
  session() {
    return JsonFile.read(join3(this.stateDir(), "session.json"));
  }
  /**
   * Loads recorded variants.
   *
   * @returns Variant list
   */
  variants() {
    return JsonFile.readOr(join3(this.stateDir(), "variants.json"), []);
  }
  /**
   * Finds a variant by id.
   *
   * @param id Variant id
   * @returns Variant
   */
  variant(id) {
    const found = this.variants().find((item) => item.id === id);
    if (!found) {
      throw ArtErrors.notFound(`Unknown variant: ${id}`);
    }
    return found;
  }
  /**
   * Writes the project file and bumps `updatedAt`.
   *
   * @param project Next project state
   */
  writeProject(project) {
    project.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    JsonFile.write(join3(this.stateDir(), "project.json"), project);
  }
  /**
   * Writes the session file and bumps `updatedAt`.
   *
   * @param session Next session state
   */
  writeSession(session) {
    session.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    JsonFile.write(join3(this.stateDir(), "session.json"), session);
  }
  /**
   * Replaces the variant catalog.
   *
   * @param variants Variant list
   */
  writeVariants(variants) {
    JsonFile.write(join3(this.stateDir(), "variants.json"), variants);
  }
  /**
   * Merges a partial brief into the project.
   *
   * @param patch Brief fields
   * @returns Updated project
   */
  patchBrief(patch) {
    const project = this.project();
    project.brief = {
      ...project.brief,
      ...patch,
      constraints: patch.constraints ?? project.brief.constraints,
      copy: {
        ...project.brief.copy,
        ...patch.copy ?? {}
      }
    };
    this.writeProject(project);
    this.setPhase("brief" /* BRIEF */);
    this.appendHistory("brief", patch);
    return project;
  }
  /**
   * Merges a partial brand into the project.
   *
   * @param patch Brand fields
   * @returns Updated project
   */
  patchBrand(patch) {
    const project = this.project();
    project.brand = {
      ...project.brand,
      ...patch,
      fonts: {
        ...project.brand.fonts,
        ...patch.fonts ?? {}
      },
      colors: {
        ...project.brand.colors,
        extra: patch.colors?.extra ?? project.brand.colors.extra,
        ...patch.colors ?? {}
      },
      logos: patch.logos ?? project.brand.logos,
      references: patch.references ?? project.brand.references
    };
    this.writeProject(project);
    this.appendHistory("brand", patch);
    return project;
  }
  /**
   * Records the chosen visual direction.
   *
   * @param direction Selected direction
   * @param combined Optional additional directions to mix
   * @returns Updated project
   */
  selectDirection(direction, combined = []) {
    const project = this.project();
    project.selectedDirection = direction;
    project.combinedDirections = combined;
    this.writeProject(project);
    this.setPhase("shape" /* SHAPE */);
    this.appendHistory("shape", {
      direction,
      combined
    });
    return project;
  }
  /**
   * Sets the current workflow phase.
   *
   * @param phase Next phase
   */
  setPhase(phase) {
    const session = this.session();
    session.phase = phase;
    this.writeSession(session);
  }
  /**
   * Upserts a variant in the catalog.
   *
   * @param variant Variant record
   * @returns Updated list
   */
  upsertVariant(variant) {
    const variants = this.variants().filter((item) => item.id !== variant.id);
    variants.push(variant);
    this.writeVariants(variants);
    this.appendHistory("variant", {
      id: variant.id,
      status: variant.status
    });
    return variants;
  }
  /**
   * Appends a JSONL history entry.
   *
   * @param kind Event kind
   * @param payload Serializable payload
   */
  appendHistory(kind, payload) {
    const line = JSON.stringify({
      at: (/* @__PURE__ */ new Date()).toISOString(),
      kind,
      payload
    });
    const file = join3(this.stateDir(), "history.jsonl");
    writeFileSync3(file, `${line}
`, {
      encoding: "utf8",
      flag: "a"
    });
  }
  /**
   * Queues a live event for the agent poll loop.
   *
   * @param event Event without acknowledgement
   * @returns Stored event
   */
  enqueueEvent(event) {
    const events = this.events();
    events.push(event);
    JsonFile.write(join3(this.stateDir(), "events.json"), events);
    this.appendHistory("live-event", {
      id: event.id,
      type: event.type
    });
    return event;
  }
  /**
   * Pending and historical live events.
   *
   * @returns Event list
   */
  events() {
    return JsonFile.readOr(join3(this.stateDir(), "events.json"), []);
  }
  /**
   * Next unacknowledged event, if any.
   *
   * @returns Pending event or null
   */
  pendingEvent() {
    return this.pendingEvents()[0] ?? null;
  }
  /**
   * Unacknowledged live events, oldest first.
   *
   * @returns Pending events
   */
  pendingEvents() {
    return this.events().filter((event) => !event.acknowledged);
  }
  /**
   * Marks an event acknowledged.
   *
   * @param id Event id
   * @returns Updated event
   */
  acknowledge(id) {
    const events = this.events();
    const event = events.find((item) => item.id === id);
    if (!event) {
      throw ArtErrors.notFound(`Unknown live event: ${id}`);
    }
    event.acknowledged = true;
    JsonFile.write(join3(this.stateDir(), "events.json"), events);
    return event;
  }
  /**
   * Writes a gitignore so tokens and live queues stay local.
   */
  ensureGitignore() {
    const file = join3(this.stateDir(), ".gitignore");
    if (existsSync3(file)) {
      return;
    }
    writeFileSync3(
      file,
      ["token", "live/", "exports/", "events.json", ""].join("\n"),
      "utf8"
    );
  }
};
function defaultBrand(name, patch) {
  return {
    name,
    tagline: patch?.tagline,
    voice: patch?.voice ?? "clear, specific, unhurried",
    logos: patch?.logos ?? [],
    fonts: {
      display: patch?.fonts?.display ?? "Fraunces",
      body: patch?.fonts?.body ?? "IBM Plex Sans",
      mono: patch?.fonts?.mono ?? "IBM Plex Mono"
    },
    colors: {
      ink: patch?.colors?.ink ?? "#14110e",
      paper: patch?.colors?.paper ?? "#f4efe6",
      accent: patch?.colors?.accent ?? "#c23b22",
      muted: patch?.colors?.muted ?? "#8a8178",
      extra: patch?.colors?.extra ?? []
    },
    iconStyle: patch?.iconStyle ?? "lucide-stroke",
    spacing: patch?.spacing ?? "editorial",
    references: patch?.references ?? []
  };
}
function defaultBrief(patch) {
  return {
    goal: patch?.goal ?? "",
    audience: patch?.audience,
    objective: patch?.objective,
    category: patch?.category,
    formatId: patch?.formatId,
    tone: patch?.tone,
    personality: patch?.personality,
    density: patch?.density ?? "balanced" /* BALANCED */,
    typographicDirection: patch?.typographicDirection,
    palette: patch?.palette,
    compositionStyle: patch?.compositionStyle,
    emphasis: patch?.emphasis,
    productionMode: patch?.productionMode ?? "art-direction" /* ART_DIRECTION */,
    constraints: patch?.constraints ?? [],
    copy: patch?.copy ?? {}
  };
}

// src/cli/Cli.ts
import { execFile } from "child_process";
import { readFileSync as readFileSync8 } from "fs";
import { join as join9 } from "path";

// src/audit/Audit.ts
import { readFileSync as readFileSync3 } from "fs";

// src/renderer/HtmlDocument.ts
var HtmlDocument;
((HtmlDocument2) => {
  function artboard(options) {
    const font = options.fontImport ? `        ${options.fontImport}
` : "";
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=${options.width}">
    <title>${escapeHtml(options.title)}</title>
${font}    <style>
        html, body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background: #000;
        }

        .artboard {
            width: ${options.width}px;
            height: ${options.height}px;
            position: relative;
            overflow: hidden;
        }

${options.css}
    </style>
</head>
<body>
    <div class="artboard" data-artdirector-root data-width="${options.width}" data-height="${options.height}">
${options.body}
    </div>
</body>
</html>
`;
  }
  HtmlDocument2.artboard = artboard;
  function dimensions(html) {
    const dataW = html.match(/data-width="(\d+)"/);
    const dataH = html.match(/data-height="(\d+)"/);
    if (dataW && dataH) {
      return {
        width: Number(dataW[1]),
        height: Number(dataH[1])
      };
    }
    const cssW = html.match(/\.artboard\s*\{[^}]*width:\s*(\d+)px/);
    const cssH = html.match(/\.artboard\s*\{[^}]*height:\s*(\d+)px/);
    return {
      width: Number(cssW?.[1] ?? 1080),
      height: Number(cssH?.[1] ?? 1080)
    };
  }
  HtmlDocument2.dimensions = dimensions;
  function fragments(html) {
    const style = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1] ?? "").join("\n");
    const links = [...html.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi)].map((match) => match[0] ?? "").join("\n");
    const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
    return {
      html: [links.trim(), body.trim()].filter(Boolean).join("\n"),
      css: style.trim()
    };
  }
  HtmlDocument2.fragments = fragments;
})(HtmlDocument || (HtmlDocument = {}));
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// src/renderer/PlaywrightRenderer.ts
import { mkdirSync as mkdirSync5, writeFileSync as writeFileSync4 } from "fs";
import { dirname as dirname4, extname } from "path";
import { chromium } from "playwright";
var PlaywrightRenderer = class {
  browser = null;
  /**
   * Renders HTML to an image or PDF.
   *
   * @param request Render request
   * @returns Result with path and buffer
   */
  async render(request) {
    const format = request.format ?? inferFormat(request.outputPath);
    const dims = HtmlDocument.dimensions(request.html);
    const page = await this.page(dims.width, dims.height);
    try {
      await page.setContent(request.html, {
        waitUntil: "networkidle",
        timeout: 3e4
      });
      await waitForFonts(page);
      await page.waitForTimeout(500);
      if (request.beforeCapture) {
        await request.beforeCapture(page);
      }
      const target = page.locator("[data-artdirector-root], .artboard, body").first();
      const box = await target.boundingBox();
      const width = Math.round(box?.width ?? dims.width);
      const height = Math.round(box?.height ?? dims.height);
      if (format === "pdf" /* PDF */) {
        const buffer2 = await page.pdf({
          width: `${width}px`,
          height: `${height}px`,
          printBackground: true
        });
        return writeResult(request.outputPath, buffer2, format, width, height);
      }
      if (format === "svg" /* SVG */) {
        const svg = await page.evaluate(() => {
          const root = document.querySelector("[data-artdirector-root], .artboard");
          const svgNode = root?.querySelector("svg") ?? document.querySelector("svg");
          return svgNode ? svgNode.outerHTML : "";
        });
        if (!svg) {
          throw ArtErrors.render("SVG export needs an SVG root in the composition. Export PNG or HTML instead.");
        }
        const buffer2 = Buffer.from(svg, "utf8");
        return writeResult(request.outputPath, buffer2, format, width, height);
      }
      const buffer = await target.screenshot({
        type: format === "jpeg" /* JPEG */ ? "jpeg" : "png",
        omitBackground: request.omitBackground === true,
        quality: format === "jpeg" /* JPEG */ ? request.quality ?? 90 : void 0
      });
      return writeResult(request.outputPath, buffer, format, width, height);
    } finally {
      await page.context().close();
    }
  }
  /**
   * Runs a function against a loaded artboard (used by audit).
   *
   * @param html Document
   * @param fn Page callback
   * @returns Callback result
   */
  async inspect(html, fn) {
    const dims = HtmlDocument.dimensions(html);
    const page = await this.page(dims.width, dims.height);
    try {
      await page.setContent(html, {
        waitUntil: "load",
        timeout: 3e4
      });
      await waitForFonts(page);
      return await fn(page);
    } finally {
      await page.context().close();
    }
  }
  /**
   * Closes the shared browser.
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
  /**
   * Opens a page at the artboard size.
   *
   * @param width Viewport width
   * @param height Viewport height
   * @returns Page
   */
  async page(width, height) {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true
      });
    }
    const context = await this.browser.newContext({
      viewport: {
        width,
        height
      },
      deviceScaleFactor: 1
    });
    return context.newPage();
  }
};
function inferFormat(outputPath) {
  const ext = outputPath ? extname(outputPath).toLowerCase() : ".png";
  if (ext === ".jpg" || ext === ".jpeg") {
    return "jpeg" /* JPEG */;
  }
  if (ext === ".pdf") {
    return "pdf" /* PDF */;
  }
  if (ext === ".svg") {
    return "svg" /* SVG */;
  }
  if (ext === ".html") {
    return "html" /* HTML */;
  }
  return "png" /* PNG */;
}
async function waitForFonts(page) {
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await document.fonts.ready;
    }
  });
  await page.waitForTimeout(200);
}
function writeResult(outputPath, buffer, format, width, height) {
  if (outputPath) {
    mkdirSync5(dirname4(outputPath), { recursive: true });
    writeFileSync4(outputPath, buffer);
  }
  return {
    buffer,
    format,
    width,
    height,
    path: outputPath,
    engine: "playwright"
  };
}

// src/renderer/ClickClickAdapter.ts
import { mkdirSync as mkdirSync6, writeFileSync as writeFileSync5 } from "fs";
import { dirname as dirname5, extname as extname2 } from "path";
var UnifiedRenderer = class {
  playwright = new PlaywrightRenderer();
  clickclick;
  /**
   * Renders through the preferred production engine.
   *
   * @param request Render request
   * @returns Result
   */
  async render(request) {
    const format = request.format ?? inferFormat2(request.outputPath);
    if (format === "html" /* HTML */ && request.outputPath) {
      mkdirSync6(dirname5(request.outputPath), { recursive: true });
      writeFileSync5(request.outputPath, request.html, "utf8");
      const dims = HtmlDocument.dimensions(request.html);
      return {
        buffer: Buffer.from(request.html, "utf8"),
        format,
        width: dims.width,
        height: dims.height,
        path: request.outputPath,
        engine: "playwright"
      };
    }
    const clickclick = await this.loadClickClick();
    const canUseClickClick = clickclick && (format === "png" /* PNG */ || format === "jpeg" /* JPEG */) && !request.beforeCapture;
    if (canUseClickClick && clickclick) {
      try {
        const dims = HtmlDocument.dimensions(request.html);
        const parts = HtmlDocument.fragments(request.html);
        const result = await clickclick.renderImage({
          document: {
            html: parts.html,
            css: parts.css
          },
          viewport: {
            width: dims.width,
            height: dims.height
          },
          output: {
            path: request.outputPath,
            format: format === "jpeg" /* JPEG */ ? "jpeg" : "png",
            quality: request.quality,
            omitBackground: request.omitBackground
          },
          render: {
            waitUntil: "networkidle",
            delayMs: 500
          }
        });
        return {
          buffer: result.buffer,
          format,
          width: result.width,
          height: result.height,
          path: result.path ?? request.outputPath,
          engine: "clickclick"
        };
      } catch (err) {
        console.error("[render] ClickClick failed, falling back to Playwright: %O", err);
      }
    }
    return this.playwright.render(request);
  }
  /**
   * Inspects a loaded page via Playwright (audit, live).
   *
   * @param html Document
   * @param fn Callback
   * @returns Callback result
   */
  inspect(html, fn) {
    return this.playwright.inspect(html, fn);
  }
  /**
   * Closes browsers owned by both engines.
   */
  async close() {
    await this.playwright.close();
  }
  /**
   * Loads ClickClick once. Missing or failed import is a documented fallback.
   *
   * @returns Module or null
   */
  async loadClickClick() {
    if (this.clickclick !== void 0) {
      return this.clickclick;
    }
    try {
      this.clickclick = await import("@maurogoncalo/clickclick");
    } catch {
      this.clickclick = null;
    }
    return this.clickclick;
  }
};
function inferFormat2(outputPath) {
  const ext = outputPath ? extname2(outputPath).toLowerCase() : ".png";
  if (ext === ".jpg" || ext === ".jpeg") {
    return "jpeg" /* JPEG */;
  }
  if (ext === ".pdf") {
    return "pdf" /* PDF */;
  }
  if (ext === ".svg") {
    return "svg" /* SVG */;
  }
  if (ext === ".html") {
    return "html" /* HTML */;
  }
  return "png" /* PNG */;
}

// src/audit/Audit.ts
var ArtworkAudit;
((ArtworkAudit2) => {
  async function run(htmlPath, expected, renderer) {
    const html = readFileSync3(htmlPath, "utf8");
    const dims = HtmlDocument.dimensions(html);
    const findings = [];
    const owned = renderer ?? new UnifiedRenderer();
    if (expected && (dims.width !== expected.width || dims.height !== expected.height)) {
      findings.push({
        id: "dimensions",
        severity: "error",
        message: `Artboard is ${dims.width}x${dims.height}, expected ${expected.width}x${expected.height}.`
      });
    }
    if (!html.includes("<svg") && !html.includes("lucide") && html.includes("dall")) {
      findings.push({
        id: "generative",
        severity: "error",
        message: "Document appears to reference a generative image tool. ArtDirector forbids that path."
      });
    }
    if (!/fonts\.bunny\.net|@font-face/.test(html)) {
      findings.push({
        id: "fonts",
        severity: "warn",
        message: "No Bunny Fonts import or @font-face found. Capture may fall back to a system stack."
      });
    }
    try {
      const inspection = await owned.inspect(html, async (page) => {
        return page.evaluate(() => {
          const root = document.querySelector("[data-artdirector-root], .artboard") ?? document.body;
          const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
          const overflowY = document.documentElement.scrollHeight > document.documentElement.clientHeight + 1;
          const clipped = [];
          for (const node of Array.from(root.querySelectorAll("h1, h2, p, span, li"))) {
            const el = node;
            if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
              const label = el.tagName.toLowerCase() + (el.textContent ? `:${el.textContent.slice(0, 24)}` : "");
              clipped.push(label);
            }
          }
          const images = Array.from(document.images).map((img) => ({
            src: img.currentSrc || img.src,
            ok: img.complete && img.naturalWidth > 0
          }));
          return {
            overflowX,
            overflowY,
            clipped,
            images,
            scrollWidth: document.documentElement.scrollWidth,
            scrollHeight: document.documentElement.scrollHeight
          };
        });
      });
      if (inspection.overflowX || inspection.overflowY) {
        findings.push({
          id: "scrollbar",
          severity: "error",
          message: `Unexpected overflow (${inspection.scrollWidth}x${inspection.scrollHeight}). Lock overflow on the artboard.`
        });
      }
      for (const label of inspection.clipped.slice(0, 8)) {
        findings.push({
          id: "clip",
          severity: "warn",
          message: `Possible text clipping on ${label}.`
        });
      }
      for (const image of inspection.images) {
        if (!image.ok) {
          findings.push({
            id: "asset",
            severity: "error",
            message: `Image failed to load: ${image.src || "(empty src)"}`
          });
        }
      }
    } catch (err) {
      findings.push({
        id: "inspect",
        severity: "warn",
        message: `Browser inspection skipped: ${err instanceof Error ? err.message : String(err)}`
      });
    } finally {
      if (!renderer) {
        await owned.close();
      }
    }
    const passed = findings.every((item) => item.severity !== "error");
    return {
      path: htmlPath,
      width: dims.width,
      height: dims.height,
      findings,
      passed,
      note: "Automated checks do not prove subjective visual quality."
    };
  }
  ArtworkAudit2.run = run;
})(ArtworkAudit || (ArtworkAudit = {}));

// src/commands/Registry.ts
var CommandRegistry = [
  {
    id: "init" /* INIT */,
    label: "Init",
    category: "build",
    summary: "Create project files, brand tokens, and session state.",
    liveAction: false
  },
  {
    id: "brief" /* BRIEF */,
    label: "Brief",
    category: "build",
    summary: "Record the communication goal, audience, format, and constraints.",
    liveAction: false
  },
  {
    id: "shape" /* SHAPE */,
    label: "Shape",
    category: "build",
    summary: "Choose a visual direction from rendered alternatives.",
    liveAction: false
  },
  {
    id: "craft" /* CRAFT */,
    label: "Craft",
    category: "build",
    summary: "Design a complete piece or campaign in HTML/CSS/SVG.",
    liveAction: false
  },
  {
    id: "generate" /* GENERATE */,
    label: "Generate",
    category: "build",
    summary: "Create and compare real HTML variants in the studio gallery.",
    liveAction: true
  },
  {
    id: "live" /* LIVE */,
    label: "Live",
    category: "refine",
    summary: "Select elements in the rendered artwork and request changes.",
    liveAction: true
  },
  {
    id: "critique" /* CRITIQUE */,
    label: "Critique",
    category: "evaluate",
    summary: "Review hierarchy, type, and originality against the quality floor.",
    liveAction: false
  },
  {
    id: "audit" /* AUDIT */,
    label: "Audit",
    category: "evaluate",
    summary: "Run deterministic rendering checks (size, overflow, fonts, assets).",
    liveAction: false
  },
  {
    id: "polish" /* POLISH */,
    label: "Polish",
    category: "refine",
    summary: "Final refinement pass before export.",
    liveAction: true
  },
  {
    id: "bolder" /* BOLDER */,
    label: "Bolder",
    category: "refine",
    summary: "Increase visual impact without changing the brief.",
    liveAction: true
  },
  {
    id: "quieter" /* QUIETER */,
    label: "Quieter",
    category: "refine",
    summary: "Reduce visual noise and competing accents.",
    liveAction: true
  },
  {
    id: "typeset" /* TYPESET */,
    label: "Typeset",
    category: "refine",
    summary: "Refine typographic hierarchy, measure, and pairing.",
    liveAction: true
  },
  {
    id: "colorize" /* COLORIZE */,
    label: "Colorize",
    category: "refine",
    summary: "Explore color treatments inside the chosen direction.",
    liveAction: true
  },
  {
    id: "layout" /* LAYOUT */,
    label: "Layout",
    category: "refine",
    summary: "Adjust composition, alignment, and spatial rhythm.",
    liveAction: true
  },
  {
    id: "distill" /* DISTILL */,
    label: "Distill",
    category: "refine",
    summary: "Remove anything that does not serve the communication goal.",
    liveAction: true
  },
  {
    id: "adapt" /* ADAPT */,
    label: "Adapt",
    category: "produce",
    summary: "Adapt an approved piece to another format or size.",
    liveAction: false
  },
  {
    id: "export" /* EXPORT */,
    label: "Export",
    category: "produce",
    summary: "Export PNG, JPEG, SVG, PDF, or HTML from the accepted artwork.",
    liveAction: false
  },
  {
    id: "resume" /* RESUME */,
    label: "Resume",
    category: "build",
    summary: "Recover the project, session, and pending live events.",
    liveAction: false
  }
];
var LiveActions = [
  {
    id: "freeform",
    label: "Apply note"
  },
  {
    id: "bolder" /* BOLDER */,
    label: "Make bolder"
  },
  {
    id: "distill" /* DISTILL */,
    label: "Simplify"
  },
  {
    id: "typeset" /* TYPESET */,
    label: "Improve typography"
  },
  {
    id: "layout" /* LAYOUT */,
    label: "Improve hierarchy"
  },
  {
    id: "composition",
    label: "Try a different composition"
  },
  {
    id: "quieter" /* QUIETER */,
    label: "Reduce decorative noise"
  },
  {
    id: "contrast",
    label: "Increase contrast"
  },
  {
    id: "editorial",
    label: "Make more editorial"
  },
  {
    id: "premium",
    label: "Make more premium"
  },
  {
    id: "brand",
    label: "Preserve brand identity"
  },
  {
    id: "direction",
    label: "Try a completely different direction"
  }
];
var Commands;
((Commands2) => {
  function byId(id) {
    return CommandRegistry.find((item) => item.id === id);
  }
  Commands2.byId = byId;
  function isCommand(value) {
    return CommandRegistry.some((item) => item.id === value);
  }
  Commands2.isCommand = isCommand;
})(Commands || (Commands = {}));

// src/design/Formats.ts
var OutputFormats = [
  {
    id: "instagram-square",
    label: "Instagram square",
    short: "Square",
    width: 1080,
    height: 1080,
    category: "social-card" /* SOCIAL_CARD */
  },
  {
    id: "instagram-portrait",
    label: "Instagram portrait",
    short: "Portrait",
    width: 1080,
    height: 1350,
    category: "social-card" /* SOCIAL_CARD */
  },
  {
    id: "story",
    label: "Story / Reel cover",
    short: "Story",
    width: 1080,
    height: 1920,
    category: "thumbnail" /* THUMBNAIL */
  },
  {
    id: "og-card",
    label: "Open Graph / X card",
    short: "OG card",
    width: 1200,
    height: 630,
    category: "announcement" /* ANNOUNCEMENT */
  },
  {
    id: "cover-16x9",
    label: "Cover 16:9",
    short: "Cover",
    width: 1920,
    height: 1080,
    category: "cover" /* COVER */
  },
  {
    id: "cover-cinematic",
    label: "Cover cinematic",
    short: "Cinematic",
    width: 1920,
    height: 817,
    category: "cover" /* COVER */
  },
  {
    id: "slide-16x9",
    label: "Slide 16:9",
    short: "Slide",
    width: 1920,
    height: 1080,
    category: "slide" /* SLIDE */
  },
  {
    id: "infographic-portrait",
    label: "Infographic portrait",
    short: "Infographic",
    width: 1080,
    height: 1920,
    category: "infographic" /* INFOGRAPHIC */
  },
  {
    id: "editorial-poster",
    label: "Editorial poster",
    short: "Poster",
    width: 1600,
    height: 2e3,
    category: "editorial" /* EDITORIAL */
  },
  {
    id: "data-landscape",
    label: "Data landscape",
    short: "Data",
    width: 1200,
    height: 800,
    category: "data-viz" /* DATA_VIZ */
  },
  {
    id: "coupon",
    label: "Coupon / ticket",
    short: "Coupon",
    width: 1080,
    height: 540,
    category: "coupon" /* COUPON */
  },
  {
    id: "carousel-slide",
    label: "Carousel slide",
    short: "Carousel",
    width: 1080,
    height: 1080,
    category: "carousel" /* CAROUSEL */
  }
];
var Formats;
((Formats2) => {
  function byId(id) {
    return OutputFormats.find((item) => item.id === id);
  }
  Formats2.byId = byId;
  function forCategory(category) {
    return OutputFormats.filter((item) => item.category === category);
  }
  Formats2.forCategory = forCategory;
  function match(width, height) {
    return OutputFormats.find((item) => item.width === width && item.height === height);
  }
  Formats2.match = match;
  function shortName(format) {
    return format.short || format.label || format.id;
  }
  Formats2.shortName = shortName;
  function defaultFor(category) {
    if (category) {
      const match2 = forCategory(category)[0];
      if (match2) {
        return match2;
      }
    }
    return OutputFormats[0];
  }
  Formats2.defaultFor = defaultFor;
})(Formats || (Formats = {}));

// src/design/Directions.ts
var DirectionCatalog = [
  {
    id: "editorial-typographic" /* EDITORIAL_TYPOGRAPHIC */,
    label: "Editorial and typographic",
    summary: "Magazine composure: a display serif, ruled margins, and type as the image.",
    displayFont: "Fraunces",
    bodyFont: "IBM Plex Sans",
    ink: "#14110e",
    paper: "#f4efe6",
    accent: "#c23b22",
    density: "sparse",
    layout: "asymmetric column with a vertical kicker",
    avoid: ["hero cards", "centered everything", "soft purple gradients"]
  },
  {
    id: "bold-promotional" /* BOLD_PROMOTIONAL */,
    label: "Bold promotional",
    summary: "One claim at poster scale. High contrast, few words, a single loud accent.",
    displayFont: "Archivo Black",
    bodyFont: "Space Grotesk",
    ink: "#f4ef3a",
    paper: "#101010",
    accent: "#f4ef3a",
    density: "dense type, empty field",
    layout: "full-bleed type stacked to the edges",
    avoid: ["rounded SaaS cards", "drop shadows as depth"]
  },
  {
    id: "swiss-inspired" /* SWISS_INSPIRED */,
    label: "Swiss-inspired",
    summary: "Modular grid, grotesque sans, mathematical spacing, one accent rule.",
    displayFont: "IBM Plex Sans",
    bodyFont: "IBM Plex Sans",
    ink: "#111111",
    paper: "#f7f7f5",
    accent: "#d31212",
    density: "balanced",
    layout: "strict columns, flush left, no ornament",
    avoid: ["script fonts", "bevels", "stock illustrations"]
  },
  {
    id: "minimalist-geometric" /* MINIMALIST_GEOMETRIC */,
    label: "Minimalist geometric",
    summary: "Few shapes, large fields, one circle or bar doing structural work.",
    displayFont: "Syne",
    bodyFont: "IBM Plex Sans",
    ink: "#1b1b1b",
    paper: "#f6f3ee",
    accent: "#2f5d50",
    density: "sparse",
    layout: "large shape + small type cluster",
    avoid: ["icon grids", "illustrative filler"]
  },
  {
    id: "neo-brutalist" /* NEO_BRUTALIST */,
    label: "Neo-brutalist",
    summary: "Hard offsets, thick borders, raw type, no polite radius.",
    displayFont: "Space Grotesk",
    bodyFont: "IBM Plex Mono",
    ink: "#111111",
    paper: "#efe8d8",
    accent: "#3d5afe",
    density: "dense",
    layout: "offset slabs with hard drop",
    avoid: ["soft UI kits", "glassmorphism"]
  },
  {
    id: "premium-corporate" /* PREMIUM_CORPORATE */,
    label: "Premium corporate",
    summary: "Quiet luxury: restrained gold, deep ink, measured serif, no chrome.",
    displayFont: "Newsreader",
    bodyFont: "IBM Plex Sans",
    ink: "#ece7dc",
    paper: "#161412",
    accent: "#c6a15b",
    density: "sparse",
    layout: "wide margins, hairline frames, small caps",
    avoid: ["stock handshake photos", "lens flares"]
  },
  {
    id: "vintage-print" /* VINTAGE_PRINT */,
    label: "Vintage print",
    summary: "Halftone, overprint, paper grain, condensed wood type.",
    displayFont: "Fraunces",
    bodyFont: "IBM Plex Serif",
    ink: "#3a2415",
    paper: "#e8d7b8",
    accent: "#9c2b18",
    density: "balanced",
    layout: "poster hierarchy with a stamped mark",
    avoid: ["digital neon", "UI buttons"]
  },
  {
    id: "expressive-playful" /* EXPRESSIVE_PLAYFUL */,
    label: "Expressive and playful",
    summary: "Off-register color, bouncing scale, a serious grid underneath the play.",
    displayFont: "Syne",
    bodyFont: "Space Grotesk",
    ink: "#1a1033",
    paper: "#fff4d6",
    accent: "#ff5a36",
    density: "balanced",
    layout: "overlapping type and simple geometric stickers",
    avoid: ["clip-art characters", "rainbow gradients"]
  },
  {
    id: "technical-infographic" /* TECHNICAL_INFOGRAPHIC */,
    label: "Technical infographic",
    summary: "Blueprint discipline: numbered modules, hairline diagrams, mono labels.",
    displayFont: "IBM Plex Sans",
    bodyFont: "IBM Plex Mono",
    ink: "#d7e6ef",
    paper: "#0b1c28",
    accent: "#3ec8e0",
    density: "dense",
    layout: "numbered modules on a construction grid",
    avoid: ["3D pie charts", "stock isometric towns"]
  },
  {
    id: "data-driven-editorial" /* DATA_DRIVEN_EDITORIAL */,
    label: "Data-driven editorial",
    summary: "A statistic as the headline, annotated chart as the body, newsroom type.",
    displayFont: "Fraunces",
    bodyFont: "IBM Plex Sans",
    ink: "#12202b",
    paper: "#f3efe6",
    accent: "#0e6b5c",
    density: "balanced",
    layout: "big number + small annotated chart",
    avoid: ["rainbow bar charts", "3D columns"]
  }
];
var Directions;
((Directions2) => {
  function byId(id) {
    const found = DirectionCatalog.find((item) => item.id === id);
    if (!found) {
      throw new Error(`Unknown visual direction: ${id}`);
    }
    return found;
  }
  Directions2.byId = byId;
  function suggest(category) {
    if (category === "infographic" || category === "data-viz") {
      return pick(
        "technical-infographic" /* TECHNICAL_INFOGRAPHIC */,
        "data-driven-editorial" /* DATA_DRIVEN_EDITORIAL */,
        "swiss-inspired" /* SWISS_INSPIRED */
      );
    }
    if (category === "promotion" || category === "announcement") {
      return pick(
        "bold-promotional" /* BOLD_PROMOTIONAL */,
        "neo-brutalist" /* NEO_BRUTALIST */,
        "premium-corporate" /* PREMIUM_CORPORATE */
      );
    }
    if (category === "cover" || category === "editorial" || category === "typography") {
      return pick(
        "editorial-typographic" /* EDITORIAL_TYPOGRAPHIC */,
        "vintage-print" /* VINTAGE_PRINT */,
        "minimalist-geometric" /* MINIMALIST_GEOMETRIC */
      );
    }
    return pick(
      "editorial-typographic" /* EDITORIAL_TYPOGRAPHIC */,
      "bold-promotional" /* BOLD_PROMOTIONAL */,
      "technical-infographic" /* TECHNICAL_INFOGRAPHIC */
    );
  }
  Directions2.suggest = suggest;
})(Directions || (Directions = {}));
function pick(...ids) {
  return ids.map((id) => Directions.byId(id));
}

// src/design/Quality.ts
var QualityStandard = {
  name: "ArtDirector quality floor",
  must: [
    "Commit to one named visual direction and execute it throughout the piece.",
    "Typography must carry the voice: a distinct display face plus a refined body face. Never Inter, Roboto, Arial, or a system stack as the design.",
    "Hierarchy is built from scale, weight, spacing, and placement - not from extra boxes.",
    "Whitespace is a material. Empty fields must be intentional, not leftover.",
    "Contrast must keep primary text readable against its actual background.",
    "Every decorative mark (grain, rule, sticker, glow) has to earn its place against the brief.",
    "Compositions are original. Do not default to a centered card on a gradient."
  ],
  never: [
    "Generative image APIs, diffusion models, or DALL-E / Midjourney substitutes.",
    "Purple-to-pink hero gradients on white as a default look.",
    "Repeating rounded-corner cards with identical drop shadows.",
    "Unmotivated glassmorphism, neon glow, or 3D pie charts.",
    "Cookie-cutter three-card rows when the content is a single idea.",
    "Claiming an edit succeeded before the HTML is written and re-rendered."
  ],
  hierarchy: [
    "One dominant element. Everything else is supporting.",
    "Primary type should be readable at the export size without zooming.",
    "Labels, kicker, and meta sit at least two steps below the headline.",
    "Align to a real grid (columns, baseline, or modular) even when the layout looks loose."
  ],
  finishing: [
    "Lock the artboard to the exact export dimensions. Overflow is a defect.",
    "Load fonts before capture. Fallback stacks are not the design.",
    "Icons are Lucide or other licensed SVGs, optically aligned, not emoji.",
    "Export only after audit. Automated checks do not prove subjective quality."
  ]
};
var CritiquePrompts = [
  "Is the visual direction unmistakable at thumbnail size?",
  "Does the headline occupy a decisive scale, or is everything medium?",
  "Are the fonts a pairing with a point of view?",
  "What would you remove first if asked to distill?",
  "Does color serve emphasis, or is it applied evenly?",
  "Would this still work in one ink color?",
  "Is the composition original, or a rearranged template of cards?"
];

// src/demo/DemoWorkflow.ts
import { mkdirSync as mkdirSync7, writeFileSync as writeFileSync6 } from "fs";
import { join as join5 } from "path";

// src/assets/Lucide.ts
var SvgOpen = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`;
var SvgClose = `</svg>`;
var LucideIcons = [
  {
    name: "type",
    svg: `${SvgOpen}<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>${SvgClose}`
  },
  {
    name: "layout",
    svg: `${SvgOpen}<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>${SvgClose}`
  },
  {
    name: "palette",
    svg: `${SvgOpen}<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>${SvgClose}`
  },
  {
    name: "image",
    svg: `${SvgOpen}<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>${SvgClose}`
  },
  {
    name: "check",
    svg: `${SvgOpen}<path d="M20 6 9 17l-5-5"/>${SvgClose}`
  },
  {
    name: "x",
    svg: `${SvgOpen}<path d="M18 6 6 18"/><path d="m6 6 12 12"/>${SvgClose}`
  },
  {
    name: "chevron-right",
    svg: `${SvgOpen}<path d="m9 18 6-6-6-6"/>${SvgClose}`
  },
  {
    name: "mouse-pointer-2",
    svg: `${SvgOpen}<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>${SvgClose}`
  },
  {
    name: "scan",
    svg: `${SvgOpen}<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>${SvgClose}`
  },
  {
    name: "file-down",
    svg: `${SvgOpen}<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>${SvgClose}`
  },
  {
    name: "activity",
    svg: `${SvgOpen}<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>${SvgClose}`
  },
  {
    name: "layers",
    svg: `${SvgOpen}<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>${SvgClose}`
  }
];
var Lucide;
((Lucide2) => {
  function svg(name) {
    const found = LucideIcons.find((icon) => icon.name === name);
    if (!found) {
      throw new Error(`Unknown Lucide icon in ArtDirector subset: ${name}`);
    }
    return found.svg;
  }
  Lucide2.svg = svg;
})(Lucide || (Lucide = {}));

// src/assets/Fonts.ts
var FontPairings = [
  {
    id: "editorial",
    display: "Fraunces",
    body: "IBM Plex Sans",
    bunny: "fraunces:400,600,700|ibm-plex-sans:400,500,600"
  },
  {
    id: "promo",
    display: "Archivo Black",
    body: "Space Grotesk",
    bunny: "archivo-black:400|space-grotesk:400,500,700"
  },
  {
    id: "swiss",
    display: "IBM Plex Sans",
    body: "IBM Plex Sans",
    bunny: "ibm-plex-sans:400,500,600,700|ibm-plex-mono:400,500"
  },
  {
    id: "geometric",
    display: "Syne",
    body: "IBM Plex Sans",
    bunny: "syne:400,600,700,800|ibm-plex-sans:400,500"
  },
  {
    id: "premium",
    display: "Newsreader",
    body: "IBM Plex Sans",
    bunny: "newsreader:400,600,700|ibm-plex-sans:400,500"
  },
  {
    id: "technical",
    display: "IBM Plex Sans",
    body: "IBM Plex Mono",
    bunny: "ibm-plex-sans:400,500,600|ibm-plex-mono:400,500"
  }
];
var Fonts;
((Fonts2) => {
  function importCss(families) {
    return `@import url("https://fonts.bunny.net/css?family=${families}");`;
  }
  Fonts2.importCss = importCss;
  function pairing(id) {
    return FontPairings.find((item) => item.id === id) ?? FontPairings[0];
  }
  Fonts2.pairing = pairing;
})(Fonts || (Fonts = {}));

// src/assets/Manifest.ts
import { join as join4 } from "path";
var AssetManifest;
((AssetManifest2) => {
  function load(projectRoot) {
    return JsonFile.readOr(path(projectRoot), []);
  }
  AssetManifest2.load = load;
  function save(projectRoot, records) {
    JsonFile.write(path(projectRoot), records);
  }
  AssetManifest2.save = save;
  function upsert(projectRoot, record) {
    const records = load(projectRoot).filter((item) => item.id !== record.id);
    records.push(record);
    save(projectRoot, records);
    return records;
  }
  AssetManifest2.upsert = upsert;
  function path(projectRoot) {
    return join4(Paths.stateDir(projectRoot), "assets.json");
  }
})(AssetManifest || (AssetManifest = {}));

// src/demo/DemoArtworks.ts
function editorialCoverHtml() {
  const fonts = Fonts.importCss("fraunces:400,600,700|ibm-plex-sans:400,500");
  const scan = Lucide.svg("scan");
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>The Geometry of Quiet</title>
    <style>
        ${fonts}
        html, body { margin: 0; overflow: hidden; }
        .artboard {
            width: 1600px;
            height: 2000px;
            background: #f4efe6;
            color: #14110e;
            position: relative;
            overflow: hidden;
            font-family: "IBM Plex Sans", sans-serif;
        }
        .grain {
            position: absolute;
            inset: 0;
            pointer-events: none;
            opacity: 0.18;
            background-image: radial-gradient(#14110e 0.6px, transparent 0.6px);
            background-size: 3px 3px;
        }
        .frame {
            position: absolute;
            inset: 72px;
            border: 1px solid #14110e;
        }
        .kicker {
            position: absolute;
            top: 110px;
            left: 110px;
            font-size: 13px;
            letter-spacing: 0.42em;
            text-transform: uppercase;
            font-weight: 500;
        }
        .rule {
            position: absolute;
            top: 160px;
            left: 110px;
            width: 72px;
            height: 8px;
            background: #c23b22;
        }
        h1 {
            position: absolute;
            top: 210px;
            left: 100px;
            right: 120px;
            margin: 0;
            font-family: Fraunces, serif;
            font-weight: 700;
            font-size: 188px;
            line-height: 0.86;
            letter-spacing: -0.04em;
        }
        h1 span { display: block; font-style: italic; font-weight: 400; font-size: 132px; }
        .colophon {
            position: absolute;
            right: 110px;
            top: 110px;
            writing-mode: vertical-rl;
            transform: rotate(180deg);
            font-size: 14px;
            letter-spacing: 0.28em;
            text-transform: uppercase;
        }
        .footer {
            position: absolute;
            left: 110px;
            right: 110px;
            bottom: 110px;
            display: flex;
            justify-content: space-between;
            align-items: end;
            gap: 40px;
        }
        .footer p {
            margin: 0;
            max-width: 520px;
            font-size: 22px;
            line-height: 1.35;
        }
        .mark {
            width: 72px;
            height: 72px;
            color: #c23b22;
        }
        .mark svg { width: 72px; height: 72px; }
    </style>
</head>
<body>
    <div class="artboard" data-artdirector-root data-width="1600" data-height="2000">
        <div class="grain"></div>
        <div class="frame"></div>
        <div class="kicker" data-ad-select="kicker">Northfold Press / Vol. 04 Autumn</div>
        <div class="rule" data-ad-select="accent-rule"></div>
        <h1 data-ad-select="title">The Geometry <span>of Quiet</span></h1>
        <div class="colophon">Printed matter for people who still look</div>
        <div class="footer">
            <p data-ad-select="standfirst">An issue about margins, pause, and the decision to leave the field empty on purpose.</p>
            <div class="mark">${scan}</div>
        </div>
    </div>
</body>
</html>`;
}
function promoPosterHtml() {
  const fonts = Fonts.importCss("archivo-black:400|space-grotesk:500,700");
  const check = Lucide.svg("check");
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Night Market</title>
    <style>
        ${fonts}
        html, body { margin: 0; overflow: hidden; }
        .artboard {
            width: 1080px;
            height: 1080px;
            background: #101010;
            color: #f4ef3a;
            position: relative;
            overflow: hidden;
            font-family: "Space Grotesk", sans-serif;
        }
        .stripe {
            position: absolute;
            top: 0;
            left: -10%;
            width: 120%;
            height: 46px;
            background: repeating-linear-gradient(-18deg, #f4ef3a 0 16px, #101010 16px 32px);
        }
        h1 {
            position: absolute;
            top: 90px;
            left: 48px;
            right: 48px;
            margin: 0;
            font-family: "Archivo Black", sans-serif;
            font-size: 168px;
            line-height: 0.82;
            letter-spacing: -0.05em;
            text-transform: uppercase;
        }
        .when {
            position: absolute;
            left: 56px;
            bottom: 64px;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        .stamp {
            position: absolute;
            right: 56px;
            bottom: 56px;
            width: 220px;
            height: 220px;
            border: 8px solid #f4ef3a;
            transform: rotate(-8deg);
            display: grid;
            place-items: center;
            text-align: center;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            font-size: 18px;
        }
        .stamp svg { width: 42px; height: 42px; margin-bottom: 8px; }
        .meta {
            position: absolute;
            top: 620px;
            left: 56px;
            font-size: 22px;
            color: #f4efe6;
            max-width: 520px;
            line-height: 1.3;
        }
    </style>
</head>
<body>
    <div class="artboard" data-artdirector-root data-width="1080" data-height="1080">
        <div class="stripe"></div>
        <h1 data-ad-select="title">Night<br>Market</h1>
        <p class="meta" data-ad-select="body">Open air. No tickets. Bring cash and a jacket. The river walk, gate B.</p>
        <div class="when" data-ad-select="date">Sat 21 / 18:00</div>
        <div class="stamp" data-ad-select="stamp">${check}<span>Free in</span></div>
    </div>
</body>
</html>`;
}
function infographicHtml() {
  const fonts = Fonts.importCss("ibm-plex-sans:400,500,600|ibm-plex-mono:400,500");
  const layers = Lucide.svg("layers");
  const activity = Lucide.svg("activity");
  const fileDown = Lucide.svg("file-down");
  const type = Lucide.svg("type");
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>How HTML Graphics Are Made</title>
    <style>
        ${fonts}
        html, body { margin: 0; overflow: hidden; }
        .artboard {
            width: 1080px;
            height: 1920px;
            background: #0b1c28;
            color: #d7e6ef;
            position: relative;
            overflow: hidden;
            font-family: "IBM Plex Sans", sans-serif;
        }
        .grid {
            position: absolute;
            inset: 0;
            background-image:
                linear-gradient(rgba(62, 200, 224, 0.08) 1px, transparent 1px),
                linear-gradient(90deg, rgba(62, 200, 224, 0.08) 1px, transparent 1px);
            background-size: 40px 40px;
        }
        header {
            position: relative;
            padding: 72px 64px 24px;
        }
        .id {
            font-family: "IBM Plex Mono", monospace;
            font-size: 13px;
            letter-spacing: 0.22em;
            text-transform: uppercase;
            color: #3ec8e0;
        }
        h1 {
            margin: 16px 0 0;
            font-size: 64px;
            line-height: 0.95;
            letter-spacing: -0.03em;
            font-weight: 600;
        }
        .steps {
            position: relative;
            margin: 40px 64px;
            display: grid;
            gap: 28px;
        }
        .step {
            border: 1px solid rgba(62, 200, 224, 0.45);
            padding: 28px 28px 24px 88px;
            position: relative;
            min-height: 148px;
        }
        .num {
            position: absolute;
            left: 20px;
            top: 24px;
            font-family: "IBM Plex Mono", monospace;
            font-size: 28px;
            color: #3ec8e0;
        }
        .step h2 {
            margin: 0 0 8px;
            font-size: 26px;
            font-weight: 600;
        }
        .step p {
            margin: 0;
            font-size: 18px;
            line-height: 1.4;
            color: #9db8c6;
        }
        .icon {
            position: absolute;
            right: 22px;
            top: 22px;
            width: 28px;
            height: 28px;
            color: #3ec8e0;
        }
        .icon svg { width: 28px; height: 28px; }
        footer {
            position: absolute;
            left: 64px;
            right: 64px;
            bottom: 64px;
            font-family: "IBM Plex Mono", monospace;
            font-size: 14px;
            color: #3ec8e0;
        }
    </style>
</head>
<body>
    <div class="artboard" data-artdirector-root data-width="1080" data-height="1920">
        <div class="grid"></div>
        <header>
            <div class="id">AD-INF-01 / deterministic pipeline</div>
            <h1 data-ad-select="title">How HTML graphics are made</h1>
        </header>
        <div class="steps">
            <article class="step" data-ad-select="step-1">
                <div class="num">01</div>
                <div class="icon">${type}</div>
                <h2>Write the composition</h2>
                <p>Language models reason about hierarchy and write HTML, CSS, and SVG. No picture model is involved.</p>
            </article>
            <article class="step" data-ad-select="step-2">
                <div class="num">02</div>
                <div class="icon">${layers}</div>
                <h2>Lock the artboard</h2>
                <p>Exact pixel dimensions, licensed fonts from Bunny, Lucide marks, user or public-domain images only.</p>
            </article>
            <article class="step" data-ad-select="step-3">
                <div class="num">03</div>
                <div class="icon">${activity}</div>
                <h2>Render in a browser</h2>
                <p>Chromium paints the document. Live Mode selects real elements. Accept writes source, then re-renders.</p>
            </article>
            <article class="step" data-ad-select="step-4">
                <div class="num">04</div>
                <div class="icon">${fileDown}</div>
                <h2>Export pixels</h2>
                <p>PNG, JPEG, SVG, or PDF from the same HTML. Audit checks overflow, fonts, and assets before shipping.</p>
            </article>
        </div>
        <footer>ArtDirector / HTML in. Pixels out. Never a generative image API.</footer>
    </div>
</body>
</html>`;
}

// src/demo/DemoWorkflow.ts
var DemoWorkflow;
((DemoWorkflow2) => {
  async function run(outDir, render = true) {
    mkdirSync7(outDir, { recursive: true });
    const ctx = ProjectContext.create({
      name: "ArtDirector demonstration",
      root: outDir,
      brand: {
        name: "Northfold Press",
        tagline: "Type as image",
        voice: "editorial, exact, unhurried"
      },
      brief: {
        goal: "Show three distinct HTML-rendered visual directions",
        audience: "designers evaluating ArtDirector",
        category: "cover" /* COVER */,
        formatId: "cover-16x9",
        density: "balanced" /* BALANCED */,
        productionMode: "art-direction" /* ART_DIRECTION */,
        copy: {
          title: "The Geometry of Quiet",
          subtitle: "Vol. 04"
        }
      }
    });
    ctx.selectDirection("editorial-typographic" /* EDITORIAL_TYPOGRAPHIC */, [
      "bold-promotional" /* BOLD_PROMOTIONAL */,
      "technical-infographic" /* TECHNICAL_INFOGRAPHIC */
    ]);
    const pieces = [
      {
        id: "editorial",
        title: "The Geometry of Quiet",
        direction: "editorial-typographic" /* EDITORIAL_TYPOGRAPHIC */,
        width: 1600,
        height: 2e3,
        html: editorialCoverHtml()
      },
      {
        id: "promo",
        title: "Night Market",
        direction: "bold-promotional" /* BOLD_PROMOTIONAL */,
        width: 1080,
        height: 1080,
        html: promoPosterHtml()
      },
      {
        id: "info",
        title: "How HTML Graphics Are Made",
        direction: "technical-infographic" /* TECHNICAL_INFOGRAPHIC */,
        width: 1080,
        height: 1920,
        html: infographicHtml()
      }
    ];
    const renderer = new UnifiedRenderer();
    const exports = [];
    const variants = [];
    try {
      for (const piece of pieces) {
        const htmlPath = `.artdirector/variants/${piece.id}/artwork.html`;
        const abs = Paths.confine(outDir, htmlPath);
        mkdirSync7(join5(outDir, ".artdirector", "variants", piece.id), { recursive: true });
        writeFileSync6(abs, piece.html, "utf8");
        ctx.upsertVariant({
          id: piece.id,
          title: piece.title,
          direction: piece.direction,
          status: "draft" /* DRAFT */,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          htmlPath,
          width: piece.width,
          height: piece.height,
          notes: "Demonstration artifact. HTML/CSS/SVG only."
        });
      }
      const liveHtml = applyLiveEdit(editorialCoverHtml());
      const livePath = Paths.confine(outDir, ".artdirector/variants/editorial/artwork.html");
      writeFileSync6(livePath, liveHtml, "utf8");
      ctx.enqueueEvent({
        id: Ids.short(),
        type: "generate" /* GENERATE */,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        acknowledged: true,
        action: "bolder" /* BOLDER */,
        prompt: "Increase the issue number scale and ink density on the kicker.",
        variantId: "editorial",
        count: 1
      });
      const accepted = ctx.variant("editorial");
      accepted.status = "accepted" /* ACCEPTED */;
      ctx.upsertVariant(accepted);
      const project = ctx.project();
      project.acceptedVariantId = "editorial";
      project.activeVariantId = "editorial";
      ctx.writeProject(project);
      ctx.setPhase("done" /* DONE */);
      for (const piece of pieces) {
        const htmlPath = Paths.confine(outDir, `.artdirector/variants/${piece.id}/artwork.html`);
        const report = await ArtworkAudit.run(
          htmlPath,
          {
            width: piece.width,
            height: piece.height
          },
          renderer
        );
        let pngPath;
        if (render) {
          const png = join5(outDir, "exports", `${piece.id}.png`);
          const jpg = join5(outDir, "exports", `${piece.id}.jpg`);
          await renderer.render({
            html: piece.id === "editorial" ? liveHtml : piece.html,
            outputPath: png,
            format: "png" /* PNG */
          });
          await renderer.render({
            html: piece.id === "editorial" ? liveHtml : piece.html,
            outputPath: jpg,
            format: "jpeg" /* JPEG */,
            quality: 88
          });
          pngPath = png;
          exports.push(png, jpg);
        }
        variants.push({
          id: piece.id,
          direction: piece.direction,
          htmlPath,
          pngPath,
          auditPassed: report.passed
        });
      }
    } finally {
      await renderer.close();
    }
    return {
      root: outDir,
      variants,
      acceptedId: "editorial",
      liveEdit: "Kicker type increased from 13px to 18px and tracking tightened after Live Mode accept.",
      exports
    };
  }
  DemoWorkflow2.run = run;
})(DemoWorkflow || (DemoWorkflow = {}));
function applyLiveEdit(html) {
  return html.replace("font-size: 13px;", "font-size: 18px;").replace("letter-spacing: 0.42em;", "letter-spacing: 0.28em;").replace("Northfold Press / Vol. 04 Autumn", "Northfold Press / Vol. 04 accepted live");
}

// src/install/Install.ts
import { cpSync, existsSync as existsSync4, mkdirSync as mkdirSync8, readFileSync as readFileSync4, writeFileSync as writeFileSync7 } from "fs";
import { dirname as dirname6, join as join6 } from "path";
var AgentTargets = {
  opencode: join6(".opencode", "skills", "artdirector"),
  cursor: join6(".cursor", "skills", "artdirector"),
  claude: join6(".claude", "skills", "artdirector"),
  agents: join6(".agents", "skills", "artdirector")
};
var SkillInstall;
((SkillInstall2) => {
  function run(options) {
    const agents = options.agent === "all" ? ["opencode", "cursor", "claude", "agents"] : [options.agent];
    const source = Paths.skillDir();
    if (!existsSync4(join6(source, "SKILL.md"))) {
      throw ArtErrors.notFound("Canonical skill/artdirector/SKILL.md is missing.");
    }
    const installed = [];
    for (const agent of agents) {
      const dest = join6(options.dest, AgentTargets[agent]);
      mkdirSync8(dirname6(dest), { recursive: true });
      cpSync(source, dest, { recursive: true });
      const scriptsDir = join6(dest, "scripts");
      mkdirSync8(scriptsDir, { recursive: true });
      writeFileSync7(join6(scriptsDir, "artdirector.root"), Paths.packageRoot(), "utf8");
      installed.push(dest);
      if (agent === "opencode") {
        const commandSource = join6(Paths.packageRoot(), "skill", "opencode", "commands", "artdirector.md");
        const commandDest = join6(options.dest, ".opencode", "commands", "artdirector.md");
        mkdirSync8(dirname6(commandDest), { recursive: true });
        cpSync(commandSource, commandDest);
        installed.push(commandDest);
      }
    }
    return installed;
  }
  SkillInstall2.run = run;
  function writeOpenCodeHint(dest) {
    const file = join6(dest, "opencode.json");
    if (existsSync4(file)) {
      return;
    }
    writeFileSync7(
      file,
      `${JSON.stringify({
        $schema: "https://opencode.ai/config.json",
        skills: [".opencode/skills"]
      }, null, 4)}
`,
      "utf8"
    );
  }
  SkillInstall2.writeOpenCodeHint = writeOpenCodeHint;
  function skillSource() {
    return readFileSync4(join6(Paths.skillDir(), "SKILL.md"), "utf8");
  }
  SkillInstall2.skillSource = skillSource;
})(SkillInstall || (SkillInstall = {}));

// src/server/Server.ts
import { existsSync as existsSync8, readFileSync as readFileSync7 } from "fs";
import { createServer } from "http";
import { join as join8 } from "path";

// src/server/Http.ts
import { createReadStream, existsSync as existsSync5, statSync as statSync2 } from "fs";
import { extname as extname3 } from "path";
var Http;
((Http2) => {
  async function jsonBody(req) {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (!raw) {
      return {};
    }
    return JSON.parse(raw);
  }
  Http2.jsonBody = jsonBody;
  function json(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(payload),
      "Cache-Control": "no-store"
    });
    res.end(payload);
  }
  Http2.json = json;
  function error(res, err) {
    if (err instanceof ArtDirectorError) {
      json(res, err.status, {
        ok: false,
        error: err.code,
        summary: err.message
      });
      return;
    }
    json(res, 500, {
      ok: false,
      error: "INTERNAL",
      summary: err instanceof Error ? err.message : String(err)
    });
  }
  Http2.error = error;
  function file(res, file2) {
    if (!existsSync5(file2) || statSync2(file2).isDirectory()) {
      return false;
    }
    const type = mime(extname3(file2));
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store"
    });
    createReadStream(file2).pipe(res);
    return true;
  }
  Http2.file = file;
  function html(res, html2) {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end(html2);
  }
  Http2.html = html;
  function query(url, name) {
    return url.searchParams.get(name) ?? void 0;
  }
  Http2.query = query;
})(Http || (Http = {}));
function mime(ext) {
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

// src/server/Routes.ts
import { existsSync as existsSync7, mkdirSync as mkdirSync9, readFileSync as readFileSync6, rmSync, writeFileSync as writeFileSync8 } from "fs";
import { dirname as dirname7 } from "path";

// src/templates/Catalog.ts
import { existsSync as existsSync6, readdirSync, readFileSync as readFileSync5 } from "fs";
import { join as join7 } from "path";
var TemplateCatalog;
((TemplateCatalog2) => {
  function list() {
    const dir = join7(Paths.libraryDir(), "templates");
    if (!existsSync6(dir)) {
      return [];
    }
    return readdirSync(dir).filter((name) => name.endsWith(".html")).map((name) => read(name.replace(/\.html$/, "")));
  }
  TemplateCatalog2.list = list;
  function read(id) {
    const file = join7(Paths.libraryDir(), "templates", `${id}.html`);
    if (!existsSync6(file)) {
      throw ArtErrors.notFound(`Unknown template: ${id}`);
    }
    const html = readFileSync5(file, "utf8");
    const title = attr(html, "data-title") ?? id;
    const category = attr(html, "data-category") ?? "social-card";
    const formatId = attr(html, "data-format") ?? Formats.defaultFor(category).id;
    const layers = [...html.matchAll(/data-layer="([^"]+)"/g)].map((match) => match[1] ?? "");
    return {
      id,
      title,
      category,
      formatId,
      html,
      layers: [...new Set(layers.filter(Boolean))]
    };
  }
  TemplateCatalog2.read = read;
})(TemplateCatalog || (TemplateCatalog = {}));
function attr(html, name) {
  const match = html.match(new RegExp(`${name}="([^"]+)"`));
  return match?.[1];
}

// src/templates/Apply.ts
var TemplateApply;
((TemplateApply2) => {
  function tokens(options) {
    const format = Formats.byId(options.formatId ?? options.brief.formatId ?? "") ?? Formats.defaultFor(options.brief.category);
    return {
      brandName: options.brand.name,
      tagline: options.brand.tagline ?? "",
      ink: options.brand.colors.ink,
      paper: options.brand.colors.paper,
      accent: options.brand.colors.accent,
      muted: options.brand.colors.muted ?? "#8a8178",
      displayFont: options.brand.fonts.display,
      bodyFont: options.brand.fonts.body,
      title: options.brief.copy.title ?? options.brief.goal ?? options.brand.name,
      subtitle: options.brief.copy.subtitle ?? options.brief.audience ?? "",
      kicker: options.brief.copy.kicker ?? "",
      body: options.brief.copy.body ?? "",
      cta: options.brief.copy.cta ?? "",
      width: String(format.width),
      height: String(format.height),
      ...options.extra ?? {}
    };
  }
  TemplateApply2.tokens = tokens;
  function fill(html, map) {
    return html.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => map[key] ?? "");
  }
  TemplateApply2.fill = fill;
  function render(spec, map, fontPairing = "editorial") {
    const filled = fill(spec.html, map);
    const pairing = Fonts.pairing(fontPairing);
    if (filled.includes("fonts.bunny.net")) {
      return filled;
    }
    return filled.replace("</head>", `    <style>${Fonts.importCss(pairing.bunny)}</style>
</head>`);
  }
  TemplateApply2.render = render;
})(TemplateApply || (TemplateApply = {}));

// src/techniques/Registry.ts
var TechniquePacks = [
  {
    id: "infographic",
    categories: ["infographic" /* INFOGRAPHIC */, "data-viz" /* DATA_VIZ */],
    layouts: [
      "linear-progression",
      "binary-comparison",
      "hub-spoke",
      "bento-modules",
      "funnel",
      "dashboard-metrics",
      "circular-flow",
      "dense-modules"
    ],
    principles: [
      "Preserve source numbers exactly. Do not round or rephrase statistics.",
      "One idea per module. Connectors must encode sequence, not decoration.",
      "Prefer numbered steps, comparison columns, and annotated diagrams over paragraphs.",
      "Use Lucide or geometric SVG marks as wayfinding, never emoji."
    ],
    htmlNotes: [
      "CSS Grid for modules; SVG for connectors, Venn, and flow paths.",
      "Tokenize colors, type scale, and module gap as custom properties.",
      "Lock the artboard. Infographic export is a poster, not a scrolling page."
    ],
    avoid: [
      "Glassmorphism as a default infographic skin.",
      "3D charts, exploded pies, isometric clip towns."
    ]
  },
  {
    id: "story",
    categories: ["thumbnail" /* THUMBNAIL */],
    layouts: [
      "full-bleed-stack",
      "monumental-type",
      "top-claim-bottom-cta"
    ],
    principles: [
      "The 1080x1920 artboard is the phone screen. Fill the height. Do not drop a square poster in the middle with empty bands.",
      "Type must be huge and readable at arm's length: display 180-240px, supporting 36-48px, kicker 28-34px.",
      "Stack top to bottom. Keep critical type out of the top 210px and bottom 250px (platform chrome), and use everything between.",
      "One idea. Three to five blocks. If it looks like a feed post, the type is too small."
    ],
    htmlNotes: [
      "Lock .artboard to 1080x1920. display:flex; flex-direction:column; justify-content:space-between.",
      "Padding about 220px 64px 260px. Headline 180px or larger, line-height 0.82-0.9.",
      "data-layer on kicker, title, subtitle, brand, and CTA."
    ],
    avoid: [
      "Letterboxed square compositions.",
      "Centered cards with padding that wastes the vertical.",
      "Headlines under 140px.",
      "Feed-post layouts stretched into 9:16."
    ]
  },
  {
    id: "social-card",
    categories: [
      "social-card" /* SOCIAL_CARD */,
      "carousel" /* CAROUSEL */,
      "announcement" /* ANNOUNCEMENT */
    ],
    layouts: [
      "sparse-claim",
      "balanced-kicker",
      "list-stack",
      "comparison-split",
      "quote-poster"
    ],
    principles: [
      "Readable at phone-thumbnail size. One claim, one supporting line.",
      "Safe margins for platform UI chrome.",
      "Carousel slides share tokens and a recurring kicker, not cloned layouts.",
      "Stories are not this pack. Use the story pack for 1080x1920."
    ],
    htmlNotes: [
      "Fixed square or 4:5 portrait artboard. Overflow hidden.",
      "Headline uses a display face; meta in small caps or mono."
    ],
    avoid: [
      "Watermarks and fake engagement bars.",
      "Tiny body copy that dies at 1080px.",
      "Putting a square post into a story frame."
    ]
  },
  {
    id: "cover",
    categories: ["cover" /* COVER */, "typography" /* TYPOGRAPHY */],
    layouts: [
      "hero-field",
      "conceptual-geometry",
      "typography-as-image",
      "minimal-accent",
      "metaphor-shape"
    ],
    principles: [
      "The cover is an image made of type and shape, not a screenshot of a layout.",
      "Title, not paragraph. Subtitle optional. Author/meta as a quiet colophon.",
      "Pick a rendering: flat vector, screen-print, chalk, or ink - then stay there."
    ],
    htmlNotes: [
      "Use clip-path, repeating-linear-gradient, and SVG grain instead of photos when none are licensed.",
      "Honor the requested aspect (16:9, 2.35:1, 1:1, 3:4)."
    ],
    avoid: [
      "Stock landscape behind white title cards.",
      "Centered gradient orbs as a metaphor for 'ideas'."
    ]
  },
  {
    id: "slides",
    categories: ["slide" /* SLIDE */],
    layouts: [
      "title-slide",
      "section-opener",
      "two-column-compare",
      "stat-break",
      "diagram-slide",
      "closing"
    ],
    principles: [
      "One thought per slide. If it needs a scroll, it is two slides.",
      "Shared master: type scale, margins, and a running footer.",
      "Speaker notes stay in HTML comments or `data-notes`, never on the artboard."
    ],
    htmlNotes: [
      "Each slide is a 1920x1080 artboard. Decks are multiple files or `#slide-n` sections.",
      "Keyboard navigation belongs in the preview, not in the exported PNG."
    ],
    avoid: [
      "Bullet walls.",
      "Default corporate blue templates."
    ]
  },
  {
    id: "editorial",
    categories: ["editorial" /* EDITORIAL */, "illustration" /* ILLUSTRATION */],
    layouts: [
      "magazine-opener",
      "pull-quote",
      "illustrated-diagram",
      "captioned-figure"
    ],
    principles: [
      "Type and illustration share a baseline. Captions are designed, not dumped.",
      "Illustration is geometric, typographic, or licensed photography - never generated pictures.",
      "Column measure stays readable. Do not set 90-character lines at poster size."
    ],
    htmlNotes: [
      "Use CSS columns or a modular grid. Drop caps only when they fit the direction.",
      "SVG scenes for article illustrations: flowchart, comparison, timeline, framework."
    ],
    avoid: [
      "Stock people silhouettes.",
      "Decorative drop shadows behind body text."
    ]
  },
  {
    id: "promotion",
    categories: ["promotion" /* PROMOTION */, "coupon" /* COUPON */],
    layouts: [
      "poster-claim",
      "ticket-stub",
      "price-callout",
      "date-stamp"
    ],
    principles: [
      "Offer, date, and action must be findable in under a second.",
      "Brand marks stay intact. Do not recolor a logo 'to match the vibe' unless asked.",
      "Coupons feel printed: perforations, serials, and stamps as CSS/SVG, not photos of paper."
    ],
    htmlNotes: [
      "Giant type for the offer. Fine print is still legible at export size.",
      "data-layer on offer, date, code, and CTA for template production."
    ],
    avoid: [
      "Fake urgency timers.",
      "QR codes that do not encode a real URL supplied by the user."
    ]
  }
];
var Techniques;
((Techniques2) => {
  function forBrief(input) {
    const fromFormat = typeof input === "object" && input?.formatId ? Formats.byId(input.formatId)?.category : void 0;
    const category = fromFormat ?? (typeof input === "string" ? input : input?.category);
    if (category) {
      const match = TechniquePacks.find((pack) => pack.categories.includes(category));
      if (match) {
        return match;
      }
    }
    return TechniquePacks[0];
  }
  Techniques2.forBrief = forBrief;
  function list() {
    return TechniquePacks.map((pack) => ({
      id: pack.id,
      categories: pack.categories
    }));
  }
  Techniques2.list = list;
})(Techniques || (Techniques = {}));

// src/server/Routes.ts
var StudioRoutes = class {
  /**
   * @param ctx Project context
   * @param renderer Shared renderer
   */
  constructor(ctx, renderer) {
    this.ctx = ctx;
    this.renderer = renderer;
  }
  ctx;
  renderer;
  /**
   * Dispatches a `/v1` request.
   *
   * @param method HTTP method
   * @param url Request URL
   * @param req Request
   * @param res Response
   */
  async handle(method, url, req, res) {
    const path = url.pathname;
    if (method === "GET" && path === "/v1/session") {
      Http.json(res, 200, this.snapshot());
      return;
    }
    if (method === "GET" && path === "/v1/commands") {
      Http.json(res, 200, {
        ok: true,
        commands: CommandRegistry,
        liveActions: LiveActions
      });
      return;
    }
    if (method === "GET" && path === "/v1/directions") {
      Http.json(res, 200, {
        ok: true,
        directions: DirectionCatalog,
        suggested: Directions.suggest(this.ctx.project().brief.category)
      });
      return;
    }
    if (method === "POST" && path === "/v1/brief") {
      const body = await Http.jsonBody(req);
      const project = this.ctx.patchBrief(body);
      Http.json(res, 200, {
        ok: true,
        project
      });
      return;
    }
    if (method === "POST" && path === "/v1/brand") {
      const body = await Http.jsonBody(req);
      const project = this.ctx.patchBrand(body);
      Http.json(res, 200, {
        ok: true,
        project
      });
      return;
    }
    if (method === "POST" && path === "/v1/shape") {
      const body = await Http.jsonBody(req);
      const direction = body.direction;
      const combined = body.combined ?? [];
      const project = this.ctx.selectDirection(direction, combined);
      Http.json(res, 200, {
        ok: true,
        project
      });
      return;
    }
    if (method === "GET" && path === "/v1/variants") {
      Http.json(res, 200, {
        ok: true,
        variants: this.ctx.variants()
      });
      return;
    }
    if (method === "POST" && path === "/v1/variants") {
      const body = await Http.jsonBody(req);
      const variant = this.addVariant(body);
      Http.json(res, 200, {
        ok: true,
        variant
      });
      return;
    }
    if (method === "POST" && path === "/v1/variants/status") {
      const body = await Http.jsonBody(req);
      const variant = this.setStatus(String(body.id), body.status);
      Http.json(res, 200, {
        ok: true,
        variant
      });
      return;
    }
    if (method === "POST" && path === "/v1/generate-template") {
      const body = await Http.jsonBody(req);
      const variants = this.generateFromTemplate(
        String(body.templateId ?? ""),
        body.formatIds,
        body.extra
      );
      Http.json(res, 200, {
        ok: true,
        variants,
        variant: variants[0]
      });
      return;
    }
    if (method === "GET" && path === "/v1/events/poll") {
      await this.poll(url, res);
      return;
    }
    if (method === "POST" && path === "/v1/events") {
      const body = await Http.jsonBody(req);
      const event = this.enqueue(body);
      Http.json(res, 200, {
        ok: true,
        event
      });
      return;
    }
    if (method === "POST" && path.startsWith("/v1/events/") && path.endsWith("/reply")) {
      const id = path.split("/")[3] ?? "";
      await Http.jsonBody(req);
      const event = this.ctx.acknowledge(id);
      Http.json(res, 200, {
        ok: true,
        event
      });
      return;
    }
    if (method === "POST" && path === "/v1/audit") {
      const body = await Http.jsonBody(req);
      const variant = this.ctx.variant(String(body.id));
      const htmlPath = Paths.confine(this.ctx.root, variant.htmlPath);
      const report = await ArtworkAudit.run(htmlPath, variant, this.renderer);
      this.ctx.setPhase("audit" /* AUDIT */);
      Http.json(res, 200, {
        ok: true,
        report
      });
      return;
    }
    if (method === "POST" && path === "/v1/export") {
      const body = await Http.jsonBody(req);
      const id = String(body.id);
      const format = body.format ?? "png" /* PNG */;
      const result = await this.exportVariant(id, format);
      const ext = format === "jpeg" /* JPEG */ ? "jpg" : format;
      const filename = `${id}.${ext}`;
      const buffer = result.buffer;
      res.writeHead(200, {
        "Content-Type": exportMimeType(format),
        "Content-Length": buffer.length,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      });
      res.end(buffer);
      return;
    }
    if (method === "GET" && path === "/v1/quality") {
      Http.json(res, 200, {
        ok: true,
        quality: QualityStandard,
        critique: CritiquePrompts,
        techniques: Techniques.list()
      });
      return;
    }
    throw ArtErrors.notFound(`Unknown API route: ${method} ${path}`);
  }
  /**
   * Full studio snapshot.
   *
   * @returns Snapshot
   */
  snapshot() {
    const project = this.ctx.project();
    return {
      ok: true,
      project,
      session: this.ctx.session(),
      variants: this.ctx.variants(),
      formats: OutputFormats.map((item) => ({
        ...item,
        short: Formats.shortName(item)
      })),
      templates: TemplateCatalog.list().map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        formatId: item.formatId,
        layers: item.layers
      })),
      techniques: Techniques.forBrief(project.brief),
      liveActions: LiveActions,
      pendingEvent: this.ctx.pendingEvent(),
      queue: this.ctx.pendingEvents(),
      tokenPath: Auth.tokenPath(this.ctx.root)
    };
  }
  /**
   * Serves a variant HTML file confined to the project.
   *
   * @param id Variant id
   * @param res Response
   */
  artwork(id, res) {
    const variant = this.ctx.variant(id);
    const file = Paths.confine(this.ctx.root, variant.htmlPath);
    if (!Http.file(res, file)) {
      throw ArtErrors.notFound(`Artwork file missing: ${variant.htmlPath}`);
    }
  }
  /**
   * Adds a variant from agent-written HTML (path or inline).
   *
   * @param body Request body
   * @returns Variant
   */
  addVariant(body) {
    const id = String(body.id ?? Ids.short());
    const html = typeof body.html === "string" ? body.html : void 0;
    const htmlPath = String(body.htmlPath ?? `.artdirector/variants/${id}/artwork.html`);
    const abs = Paths.confine(this.ctx.root, htmlPath);
    if (html) {
      mkdirSync9(dirname7(abs), { recursive: true });
      writeFileSync8(abs, html, { encoding: "utf8", flag: "w" });
    } else if (!existsSync7(abs)) {
      throw ArtErrors.project("Variant HTML is missing. Write the file before registering it.");
    }
    const dims = Formats.byId(this.ctx.project().brief.formatId ?? "") ?? Formats.defaultFor(this.ctx.project().brief.category);
    const width = Number(body.width ?? dims.width);
    const height = Number(body.height ?? dims.height);
    const formatId = typeof body.formatId === "string" && body.formatId ? body.formatId : Formats.match(width, height)?.id;
    const variant = {
      id,
      title: String(body.title ?? id),
      direction: body.direction ?? this.ctx.project().selectedDirection ?? "editorial-typographic" /* EDITORIAL_TYPOGRAPHIC */,
      status: "draft" /* DRAFT */,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      htmlPath,
      width,
      height,
      templateId: typeof body.templateId === "string" ? body.templateId : void 0,
      formatId,
      notes: typeof body.notes === "string" ? body.notes : void 0
    };
    this.ctx.upsertVariant(variant);
    this.ctx.setPhase("generate" /* GENERATE */);
    return variant;
  }
  /**
   * Updates variant status and active/accepted pointers.
   *
   * @param id Variant id
   * @param status Next status
   * @returns Variant
   */
  setStatus(id, status) {
    const variant = this.ctx.variant(id);
    variant.status = status;
    this.ctx.upsertVariant(variant);
    const project = this.ctx.project();
    if (status === "selected" /* SELECTED */) {
      project.activeVariantId = id;
    } else if (status === "accepted" /* ACCEPTED */) {
      project.acceptedVariantId = id;
      project.activeVariantId = id;
    }
    this.ctx.writeProject(project);
    return variant;
  }
  /**
   * Fills a library template into one variant per requested size.
   *
   * @param templateId Template id
   * @param formatIds Output sizes to make together
   * @param extra Extra tokens
   * @returns Variants
   */
  generateFromTemplate(templateId, formatIds, extra) {
    this.replaceTemplatePreview();
    const spec = TemplateCatalog.read(templateId);
    const project = this.ctx.project();
    const fallback = Formats.byId(spec.formatId) ?? Formats.defaultFor(spec.category);
    const requested = Array.isArray(formatIds) ? formatIds.map((item) => String(item)).filter((id) => Formats.byId(id)) : [];
    const formats = (requested.length ? requested : [fallback.id]).map((id) => Formats.byId(id)).filter((item) => Boolean(item));
    const unique = [...new Map(formats.map((item) => [item.id, item])).values()];
    return unique.map((format) => {
      const html = TemplateApply.render(spec, TemplateApply.tokens({
        brand: project.brand,
        brief: project.brief,
        formatId: format.id,
        extra
      }));
      return this.addVariant({
        id: `template-${templateId}-${format.id}`,
        html,
        title: spec.title,
        templateId,
        formatId: format.id,
        direction: project.selectedDirection,
        width: format.width,
        height: format.height
      });
    });
  }
  /**
   * Drops previously generated template variants so a sidebar pick replaces the preview.
   */
  replaceTemplatePreview() {
    const project = this.ctx.project();
    const kept = [];
    for (const variant of this.ctx.variants()) {
      if (!variant.templateId) {
        kept.push(variant);
        continue;
      }
      const abs = Paths.confine(this.ctx.root, variant.htmlPath);
      rmSync(dirname7(abs), { recursive: true, force: true });
      if (project.activeVariantId === variant.id) {
        project.activeVariantId = void 0;
      }
      if (project.acceptedVariantId === variant.id) {
        project.acceptedVariantId = void 0;
      }
    }
    this.ctx.writeVariants(kept);
    this.ctx.writeProject(project);
  }
  /**
   * Enqueues a live event from the studio.
   *
   * @param body Request body
   * @returns Event
   */
  enqueue(body) {
    const event = {
      id: Ids.short(),
      type: body.type ?? "generate" /* GENERATE */,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      acknowledged: false,
      action: body.action ?? "freeform",
      prompt: typeof body.prompt === "string" ? body.prompt : void 0,
      selection: body.selection,
      variantId: typeof body.variantId === "string" ? body.variantId : this.ctx.project().activeVariantId,
      count: typeof body.count === "number" ? body.count : 3
    };
    this.ctx.setPhase("live" /* LIVE */);
    const session = this.ctx.session();
    session.liveEnabled = true;
    this.ctx.writeSession(session);
    return this.ctx.enqueueEvent(event);
  }
  /**
   * Long-polls for the next unacknowledged event.
   *
   * @param url Request URL
   * @param res Response
   */
  async poll(url, res) {
    const waitMs = Math.min(Number(Http.query(url, "waitMs") ?? 25e3), 6e4);
    const started = Date.now();
    while (Date.now() - started < waitMs) {
      const pending = this.ctx.pendingEvent();
      if (pending) {
        Http.json(res, 200, {
          ok: true,
          event: pending
        });
        return;
      }
      await sleep(400);
    }
    Http.json(res, 200, {
      ok: true,
      event: {
        type: "timeout" /* TIMEOUT */
      }
    });
  }
  /**
   * Exports a variant through the unified renderer.
   *
   * @param id Variant id
   * @param format Format
   * @returns Render result
   */
  async exportVariant(id, format) {
    const variant = this.ctx.variant(id);
    const htmlPath = Paths.confine(this.ctx.root, variant.htmlPath);
    const html = readFileSync6(htmlPath, "utf8");
    this.ctx.setPhase("export" /* EXPORT */);
    return this.renderer.render({
      html,
      format
    });
  }
};
function exportMimeType(format) {
  switch (format) {
    case "jpeg" /* JPEG */:
      return "image/jpeg";
    case "pdf" /* PDF */:
      return "application/pdf";
    case "svg" /* SVG */:
      return "image/svg+xml";
    case "html" /* HTML */:
      return "text/html; charset=utf-8";
    case "png" /* PNG */:
    default:
      return "image/png";
  }
}
function sleep(ms) {
  return new Promise((resolve2) => setTimeout(resolve2, ms));
}

// src/server/Server.ts
var StudioServer = class {
  /**
   * @param ctx Project context
   * @param port Listen port
   * @param token Studio token
   */
  constructor(ctx, port, token) {
    this.ctx = ctx;
    this.port = port;
    this.token = token;
  }
  ctx;
  port;
  token;
  renderer = new UnifiedRenderer();
  http;
  /**
   * Starts listening on 127.0.0.1.
   *
   * @returns Public URL including the token
   */
  async listen() {
    const routes = new StudioRoutes(this.ctx, this.renderer);
    this.http = createServer((req, res) => {
      void this.dispatch(req, res, routes);
    });
    await new Promise((resolve2, reject) => {
      this.http?.once("error", reject);
      this.http?.listen(this.port, "127.0.0.1", () => resolve2());
    });
    return `http://127.0.0.1:${this.port}/?token=${this.token}`;
  }
  /**
   * Stops the server and renderer.
   */
  async close() {
    await this.renderer.close();
    await new Promise((resolve2, reject) => {
      if (!this.http) {
        resolve2();
        return;
      }
      this.http.close((err) => err ? reject(err) : resolve2());
    });
  }
  /**
   * Routes a single request.
   *
   * @param req Request
   * @param res Response
   * @param routes API routes
   */
  async dispatch(req, res, routes) {
    try {
      const host = req.headers.host ?? "127.0.0.1";
      const url = new URL(req.url ?? "/", `http://${host}`);
      this.assertLocal(req);
      this.assertToken(req, url);
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/studio")) {
        this.studioIndex(req, res);
        return;
      }
      if (req.method === "GET" && url.pathname.startsWith("/studio/")) {
        const file = Paths.confine(Paths.studioDir(), join8(Paths.studioDir(), url.pathname.slice("/studio/".length)));
        if (!Http.file(res, file)) {
          throw ArtErrors.notFound("Studio asset not found.");
        }
        return;
      }
      if (req.method === "GET" && (url.pathname === "/studio.css" || url.pathname === "/studio.js" || url.pathname === "/live.js")) {
        const file = join8(Paths.studioDir(), url.pathname.slice(1));
        if (!Http.file(res, file)) {
          throw ArtErrors.notFound("Studio asset not found.");
        }
        return;
      }
      if (req.method === "GET" && url.pathname.startsWith("/library/")) {
        const file = Paths.confine(Paths.libraryDir(), join8(Paths.libraryDir(), url.pathname.slice("/library/".length)));
        if (!Http.file(res, file)) {
          throw ArtErrors.notFound("Library file not found.");
        }
        return;
      }
      if (req.method === "GET" && url.pathname.startsWith("/artwork/")) {
        routes.artwork(url.pathname.slice("/artwork/".length), res);
        return;
      }
      if (url.pathname.startsWith("/v1/")) {
        await routes.handle(req.method ?? "GET", url, req, res);
        return;
      }
      throw ArtErrors.notFound(`Unknown route: ${url.pathname}`);
    } catch (err) {
      Http.error(res, err);
    }
  }
  /**
   * Rejects requests that are not loopback.
   *
   * @param req Request
   */
  assertLocal(req) {
    const addr = req.socket.remoteAddress ?? "";
    const local = addr === "127.0.0.1" || addr === "::1" || addr === ":ffff:127.0.0.1";
    if (!local) {
      throw ArtErrors.auth("Studio is bound to localhost only.");
    }
  }
  /**
   * Requires a matching bearer or query token.
   *
   * @param req Request
   * @param url URL
   */
  assertToken(req, url) {
    const header = req.headers.authorization;
    const bearer = header?.startsWith("Bearer ") ? header.slice(7) : void 0;
    Auth.assert(this.ctx.root, bearer ?? cookieToken(req) ?? Http.query(url, "token"));
  }
  /**
   * Injects the token into the studio HTML.
   *
   * @param res Response
   */
  studioIndex(_req, res) {
    const file = join8(Paths.studioDir(), "index.html");
    if (!existsSync8(file)) {
      throw ArtErrors.notFound("Studio UI is missing from the package.");
    }
    const html = readFileSync7(file, "utf8").replaceAll("%%TOKEN%%", this.token).replaceAll("%%PORT%%", String(this.port)).replaceAll('href="/studio.css"', `href="/studio.css?token=${this.token}"`).replaceAll('src="/studio.js"', `src="/studio.js?token=${this.token}"`);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": `artdirector_token=${this.token}; Path=/; HttpOnly; SameSite=Strict`
    });
    res.end(html);
  }
};
function cookieToken(req) {
  const header = req.headers.cookie;
  if (!header) {
    return void 0;
  }
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "artdirector_token") {
      return rest.join("=");
    }
  }
  return void 0;
}
async function startStudio(options) {
  const port = options.port ?? Number(process.env.ARTDIRECTOR_PORT ?? 4730);
  const token = Auth.loadOrCreate(options.ctx.root);
  const server = new StudioServer(options.ctx, port, token);
  const url = await server.listen();
  return {
    server,
    url,
    token,
    port
  };
}

// src/cli/Help.ts
function helpText() {
  const commands = CommandRegistry.map((item) => `  ${item.id.padEnd(12)} ${item.summary}`).join("\n");
  return `ArtDirector - local-first HTML/CSS/SVG graphic design studio

Usage:
  artdirector <command> [flags]
  artdirector studio [--port 4730]
  artdirector generate --template social-post
  artdirector export --id <variant> --format png
  artdirector install --agent opencode
  artdirector demo [--out dir]

Workflow commands:
${commands}

Also:
  status        Print project, session, and variants as JSON
  variants      List variants
  install       Copy the unified skill into an agent
  demo          Run the end-to-end demonstration
  help          Show this help

All commands accept --json. Artwork is HTML rendered in a browser.
ArtDirector never calls an image-generation API.
`;
}

// src/cli/ParseFlags.ts
function parseArgv(argv) {
  const command = argv[0] ?? "help";
  const flags = {};
  const rest = [];
  const args = argv.slice(1);
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i] ?? "";
    if (token === "--") {
      rest.push(...args.slice(i + 1));
      break;
    }
    if (token.startsWith("--")) {
      const body = token.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
        continue;
      }
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        flags[body] = next;
        i += 1;
      } else {
        flags[body] = true;
      }
      continue;
    }
    rest.push(token);
  }
  return {
    command,
    flags,
    rest
  };
}
function flagString(flags, name) {
  const value = flags[name];
  return typeof value === "string" ? value : void 0;
}
function flagBool(flags, name) {
  return flags[name] === true || flags[name] === "true";
}

// src/cli/Cli.ts
async function runCli(argv) {
  const parsed = parseArgv(argv);
  const json = flagBool(parsed.flags, "json") || process.env.ARTDIRECTOR_JSON === "1";
  const root = flagString(parsed.flags, "root") ?? process.cwd();
  if (parsed.command === "help" || parsed.command === "--help" || parsed.command === "-h") {
    return finish({
      ok: true,
      command: "help",
      summary: helpText()
    }, json);
  }
  if (parsed.command === "init") {
    const ctx2 = ProjectContext.create({
      name: flagString(parsed.flags, "name") ?? "Untitled project",
      root,
      brief: {
        goal: flagString(parsed.flags, "goal") ?? ""
      }
    });
    return finish({
      ok: true,
      command: "init" /* INIT */,
      summary: `Initialized ArtDirector project at ${ctx2.root}`,
      data: {
        project: ctx2.project(),
        session: ctx2.session()
      }
    }, json);
  }
  if (parsed.command === "install") {
    const agent = flagString(parsed.flags, "agent") ?? "opencode";
    const dest = flagString(parsed.flags, "dest") ?? root;
    const installed = SkillInstall.run({
      agent,
      dest
    });
    if (agent === "opencode" || agent === "all") {
      SkillInstall.writeOpenCodeHint(dest);
    }
    return finish({
      ok: true,
      command: "install",
      summary: `Installed artdirector skill: ${installed.join(", ")}`,
      data: { installed }
    }, json);
  }
  if (parsed.command === "demo") {
    const out = flagString(parsed.flags, "out") ?? join9(Paths.packageRoot(), "demos", "artifacts");
    const render = !flagBool(parsed.flags, "no-render");
    const result = await DemoWorkflow.run(out, render);
    return finish({
      ok: true,
      command: "demo",
      summary: `Wrote three HTML compositions and exports under ${out}`,
      data: result
    }, json);
  }
  const ctx = openOrThrow(parsed.command, root);
  if (parsed.command === "status" || parsed.command === "resume" /* RESUME */) {
    return finish({
      ok: true,
      command: parsed.command,
      summary: `Project ${ctx.project().name} / phase ${ctx.session().phase}`,
      data: {
        project: ctx.project(),
        session: ctx.session(),
        variants: ctx.variants(),
        pendingEvent: ctx.pendingEvent()
      }
    }, json);
  }
  if (parsed.command === "brief" /* BRIEF */) {
    const project = ctx.patchBrief({
      goal: flagString(parsed.flags, "goal") ?? ctx.project().brief.goal,
      audience: flagString(parsed.flags, "audience"),
      category: flagString(parsed.flags, "category"),
      formatId: flagString(parsed.flags, "format"),
      tone: flagString(parsed.flags, "tone")
    });
    return finish({
      ok: true,
      command: "brief" /* BRIEF */,
      summary: "Brief updated.",
      data: { project }
    }, json);
  }
  if (parsed.command === "shape" /* SHAPE */) {
    const direction = flagString(parsed.flags, "direction") ?? Directions.suggest(ctx.project().brief.category)[0]?.id;
    const project = ctx.selectDirection(direction);
    return finish({
      ok: true,
      command: "shape" /* SHAPE */,
      summary: `Direction set to ${project.selectedDirection}`,
      data: {
        project,
        suggested: Directions.suggest(project.brief.category)
      }
    }, json);
  }
  if (parsed.command === "studio" || parsed.command === "live" /* LIVE */) {
    const port = Number(flagString(parsed.flags, "port") ?? 4730);
    const started = await startStudio({
      ctx,
      port
    });
    ctx.setPhase(parsed.command === "live" /* LIVE */ ? "live" /* LIVE */ : "shape" /* SHAPE */);
    if (flagBool(parsed.flags, "open")) {
      openUrl(started.url);
    }
    return finish({
      ok: true,
      command: parsed.command,
      summary: `Studio on ${started.url}`,
      data: {
        url: started.url,
        port: started.port,
        bind: "127.0.0.1",
        tokenPath: join9(ctx.stateDir(), "token")
      }
    }, json);
  }
  if (parsed.command === "generate" /* GENERATE */) {
    const templateId = flagString(parsed.flags, "template");
    if (!templateId) {
      return finish({
        ok: true,
        command: "generate" /* GENERATE */,
        summary: "Art-direction generate: write HTML variants, then `artdirector variants add --file`.",
        data: {
          techniques: Techniques.forBrief(ctx.project().brief),
          quality: QualityStandard,
          templates: TemplateCatalog.list().map((item) => item.id)
        }
      }, json);
    }
    const spec = TemplateCatalog.read(templateId);
    const format = Formats.byId(spec.formatId) ?? Formats.defaultFor(spec.category);
    const tokens = TemplateApply.tokens({
      brand: ctx.project().brand,
      brief: ctx.project().brief,
      formatId: spec.formatId
    });
    const html = TemplateApply.render(spec, tokens);
    const id = templateId;
    const htmlPath = `.artdirector/variants/${id}/artwork.html`;
    const abs = Paths.confine(ctx.root, htmlPath);
    const { mkdirSync: mkdirSync10, writeFileSync: writeFileSync9 } = await import("fs");
    mkdirSync10(join9(ctx.root, ".artdirector", "variants", id), { recursive: true });
    writeFileSync9(abs, html, "utf8");
    ctx.upsertVariant({
      id,
      title: spec.title,
      direction: ctx.project().selectedDirection ?? "editorial-typographic" /* EDITORIAL_TYPOGRAPHIC */,
      status: "draft" /* DRAFT */,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      htmlPath,
      width: format.width,
      height: format.height,
      templateId
    });
    ctx.setPhase("generate" /* GENERATE */);
    return finish({
      ok: true,
      command: "generate" /* GENERATE */,
      summary: `Rendered template ${templateId} to ${htmlPath}`,
      data: { htmlPath }
    }, json);
  }
  if (parsed.command === "variants") {
    return finish({
      ok: true,
      command: "variants",
      summary: `${ctx.variants().length} variants`,
      data: { variants: ctx.variants() }
    }, json);
  }
  if (parsed.command === "critique" /* CRITIQUE */) {
    return finish({
      ok: true,
      command: "critique" /* CRITIQUE */,
      summary: "Quality floor and critique prompts. Automated checks do not prove visual quality.",
      data: {
        quality: QualityStandard,
        prompts: CritiquePrompts,
        direction: ctx.project().selectedDirection,
        techniques: Techniques.forBrief(ctx.project().brief)
      }
    }, json);
  }
  if (parsed.command === "audit" /* AUDIT */) {
    const id = flagString(parsed.flags, "id") ?? ctx.project().activeVariantId ?? ctx.variants()[0]?.id;
    if (!id) {
      throw ArtErrors.project("No variant to audit.");
    }
    const variant = ctx.variant(id);
    const report = await ArtworkAudit.run(Paths.confine(ctx.root, variant.htmlPath), variant);
    return finish({
      ok: report.passed,
      command: "audit" /* AUDIT */,
      summary: report.passed ? "Audit passed (deterministic checks only)." : "Audit found errors.",
      data: { report }
    }, json);
  }
  if (parsed.command === "export" /* EXPORT */) {
    const id = flagString(parsed.flags, "id") ?? ctx.project().acceptedVariantId ?? ctx.project().activeVariantId;
    if (!id) {
      throw ArtErrors.project("No variant to export.");
    }
    const format = flagString(parsed.flags, "format") ?? "png" /* PNG */;
    const variant = ctx.variant(id);
    const html = readFileSync8(Paths.confine(ctx.root, variant.htmlPath), "utf8");
    const ext = format === "jpeg" /* JPEG */ ? "jpg" : format;
    const outputPath = flagString(parsed.flags, "out") ?? join9(Paths.exportsDir(ctx.root), `${variant.id}.${ext}`);
    const renderer = new UnifiedRenderer();
    try {
      const result = await renderer.render({
        html,
        outputPath,
        format
      });
      ctx.setPhase("export" /* EXPORT */);
      return finish({
        ok: true,
        command: "export" /* EXPORT */,
        summary: `Exported ${format} via ${result.engine} to ${result.path}`,
        data: {
          path: result.path,
          format: result.format,
          engine: result.engine,
          width: result.width,
          height: result.height
        }
      }, json);
    } finally {
      await renderer.close();
    }
  }
  if (Commands.isCommand(parsed.command)) {
    ctx.setPhase("live" /* LIVE */);
    const meta = CommandRegistry.find((item) => item.id === parsed.command);
    return finish({
      ok: true,
      command: parsed.command,
      summary: meta?.summary ?? parsed.command,
      data: {
        instruction: "Apply this command to the active artwork HTML, re-render, then wait for accept/reject in the studio.",
        quality: QualityStandard,
        techniques: Techniques.forBrief(ctx.project().brief)
      }
    }, json);
  }
  throw ArtErrors.project(`Unknown command: ${parsed.command}. See artdirector help.`);
}
function openOrThrow(command, root) {
  if (command === "init" || command === "help" || command === "install" || command === "demo") {
    return ProjectContext.create({
      name: "tmp",
      root
    });
  }
  return ProjectContext.open(root);
}
function finish(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.summary);
  }
  return result;
}
function openUrl(url) {
  const cmd = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  execFile(cmd, args, () => void 0);
}
export {
  ArtCommand,
  ArtDirectorError,
  ArtErrors,
  ArtworkAudit,
  ArtworkCategory,
  Auth,
  CommandRegistry,
  DemoWorkflow,
  DirectionCatalog,
  Directions,
  ExportFormat,
  HtmlDocument,
  Ids,
  LiveActions,
  LiveEventType,
  OutputFormats,
  Paths,
  ProductionMode,
  ProjectContext,
  QualityStandard,
  SessionPhase,
  SkillInstall,
  StudioServer,
  Techniques,
  TemplateApply,
  TemplateCatalog,
  UnifiedRenderer,
  VariantStatus,
  VisualDensity,
  VisualDirection,
  runCli,
  startStudio
};
//# sourceMappingURL=index.js.map