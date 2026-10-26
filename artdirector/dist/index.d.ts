import { Page } from 'playwright';

/**
 * Shared domain types for ArtDirector projects, sessions, and artwork.
 */
/**
 * Closed command vocabulary used by the CLI, skill, and studio.
 */
declare enum ArtCommand {
    INIT = "init",
    BRIEF = "brief",
    SHAPE = "shape",
    CRAFT = "craft",
    GENERATE = "generate",
    LIVE = "live",
    CRITIQUE = "critique",
    AUDIT = "audit",
    POLISH = "polish",
    BOLDER = "bolder",
    QUIETER = "quieter",
    TYPESET = "typeset",
    COLORIZE = "colorize",
    LAYOUT = "layout",
    DISTILL = "distill",
    ADAPT = "adapt",
    EXPORT = "export",
    RESUME = "resume"
}
/**
 * Artwork category used to select techniques and templates.
 */
declare enum ArtworkCategory {
    INFOGRAPHIC = "infographic",
    SOCIAL_CARD = "social-card",
    COVER = "cover",
    THUMBNAIL = "thumbnail",
    SLIDE = "slide",
    EDITORIAL = "editorial",
    ILLUSTRATION = "illustration",
    TYPOGRAPHY = "typography",
    PROMOTION = "promotion",
    COUPON = "coupon",
    CAROUSEL = "carousel",
    ANNOUNCEMENT = "announcement",
    DATA_VIZ = "data-viz"
}
/**
 * Named visual directions offered as rendered alternatives.
 */
declare enum VisualDirection {
    EDITORIAL_TYPOGRAPHIC = "editorial-typographic",
    BOLD_PROMOTIONAL = "bold-promotional",
    SWISS_INSPIRED = "swiss-inspired",
    MINIMALIST_GEOMETRIC = "minimalist-geometric",
    NEO_BRUTALIST = "neo-brutalist",
    PREMIUM_CORPORATE = "premium-corporate",
    VINTAGE_PRINT = "vintage-print",
    EXPRESSIVE_PLAYFUL = "expressive-playful",
    TECHNICAL_INFOGRAPHIC = "technical-infographic",
    DATA_DRIVEN_EDITORIAL = "data-driven-editorial"
}
/**
 * Production mode: reuse a template or invent a composition.
 */
declare enum ProductionMode {
    TEMPLATE = "template",
    ART_DIRECTION = "art-direction"
}
/**
 * Visual density of a composition.
 */
declare enum VisualDensity {
    SPARSE = "sparse",
    BALANCED = "balanced",
    DENSE = "dense"
}
/**
 * Live-mode event types exchanged between the studio and the agent.
 */
declare enum LiveEventType {
    GENERATE = "generate",
    STEER = "steer",
    ACCEPT = "accept",
    DISCARD = "discard",
    TIMEOUT = "timeout",
    EXIT = "exit"
}
/**
 * Status of a recorded artwork variant.
 */
declare enum VariantStatus {
    DRAFT = "draft",
    SELECTED = "selected",
    ACCEPTED = "accepted",
    REJECTED = "rejected"
}
/**
 * Raster and document export formats.
 */
declare enum ExportFormat {
    PNG = "png",
    JPEG = "jpeg",
    SVG = "svg",
    PDF = "pdf",
    HTML = "html"
}
/**
 * Brand identity stored with a project.
 */
interface BrandContext {
    name: string;
    tagline?: string;
    voice?: string;
    logos: string[];
    fonts: BrandFonts;
    colors: BrandColors;
    iconStyle?: string;
    spacing?: string;
    references: string[];
}
/**
 * Font pairing for a brand.
 */
interface BrandFonts {
    display: string;
    body: string;
    mono?: string;
}
/**
 * Color tokens for a brand.
 */
interface BrandColors {
    ink: string;
    paper: string;
    accent: string;
    muted?: string;
    extra: string[];
}
/**
 * Communication brief for a piece or campaign.
 */
interface CreativeBrief {
    goal: string;
    audience?: string;
    objective?: string;
    category?: ArtworkCategory;
    formatId?: string;
    tone?: string;
    personality?: string;
    density?: VisualDensity;
    typographicDirection?: string;
    palette?: string;
    compositionStyle?: string;
    emphasis?: string;
    productionMode?: ProductionMode;
    constraints: string[];
    copy: Record<string, string>;
}
/**
 * Durable project file stored under `.artdirector/project.json`.
 */
interface ArtProject {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    root: string;
    brand: BrandContext;
    brief: CreativeBrief;
    selectedDirection?: VisualDirection;
    combinedDirections: VisualDirection[];
    activeVariantId?: string;
    acceptedVariantId?: string;
}
/**
 * Interactive session persisted beside the project.
 */
interface ArtSession {
    id: string;
    projectId: string;
    createdAt: string;
    updatedAt: string;
    phase: SessionPhase;
    lastCommand?: ArtCommand;
    liveEnabled: boolean;
    notes: string[];
}
/**
 * High-level workflow phase shown in the studio.
 */
declare enum SessionPhase {
    INIT = "init",
    BRIEF = "brief",
    SHAPE = "shape",
    CRAFT = "craft",
    GENERATE = "generate",
    LIVE = "live",
    AUDIT = "audit",
    EXPORT = "export",
    DONE = "done"
}
/**
 * A generated or templated artwork variant.
 */
interface ArtworkVariant {
    id: string;
    title: string;
    direction: VisualDirection;
    status: VariantStatus;
    createdAt: string;
    htmlPath: string;
    previewPath?: string;
    width: number;
    height: number;
    templateId?: string;
    formatId?: string;
    notes?: string;
}
/**
 * Element picked in Live Mode.
 */
interface LiveSelection {
    selector: string;
    tagName: string;
    id?: string;
    className?: string;
    text?: string;
    role?: string;
    outerHtml?: string;
}
/**
 * Event posted by the studio for the agent to consume.
 */
interface LiveEvent {
    id: string;
    type: LiveEventType;
    createdAt: string;
    acknowledged: boolean;
    action?: ArtCommand | "freeform";
    prompt?: string;
    selection?: LiveSelection;
    variantId?: string;
    count?: number;
}
/**
 * Named output size used by templates and export.
 */
interface OutputFormat {
    id: string;
    label: string;
    short: string;
    width: number;
    height: number;
    category: ArtworkCategory;
}
/**
 * Structured CLI / HTTP result.
 */
interface CommandResult {
    ok: boolean;
    command: string;
    summary: string;
    data?: Record<string, unknown>;
    error?: string;
}

/**
 * Typed errors with stable codes for CLI and HTTP responses.
 */
declare class ArtDirectorError extends Error {
    readonly code: string;
    readonly status: number;
    /**
     * Creates a typed ArtDirector error.
     *
     * @param code Stable machine-readable code
     * @param message Human-readable explanation
     * @param status HTTP status to use when the server maps this error
     */
    constructor(code: string, message: string, status?: number);
}
/**
 * Helpers for constructing common errors.
 */
declare namespace ArtErrors {
    /**
     * Project files are missing or invalid.
     *
     * @param message Explanation
     * @returns Typed error
     */
    function project(message: string): ArtDirectorError;
    /**
     * Requested path is outside the project root.
     *
     * @param message Explanation
     * @returns Typed error
     */
    function path(message: string): ArtDirectorError;
    /**
     * Authentication failed on the local server.
     *
     * @param message Explanation
     * @returns Typed error
     */
    function auth(message: string): ArtDirectorError;
    /**
     * Requested resource does not exist.
     *
     * @param message Explanation
     * @returns Typed error
     */
    function notFound(message: string): ArtDirectorError;
    /**
     * Renderer or audit could not complete.
     *
     * @param message Explanation
     * @returns Typed error
     */
    function render(message: string): ArtDirectorError;
}

/**
 * Identifier and token helpers.
 */
declare namespace Ids {
    /**
     * Creates a UUID v4 string.
     *
     * @returns UUID
     */
    function uuid(): string;
    /**
     * Creates a short hex id for variants and live events.
     *
     * @param bytes Number of random bytes
     * @returns Hex string
     */
    function short(bytes?: number): string;
    /**
     * Creates a bearer token for the local studio server.
     *
     * @returns Hex token
     */
    function token(): string;
    /**
     * Creates a filesystem-safe slug from a title.
     *
     * @param value Raw title
     * @returns Kebab-case slug
     */
    function slug(value: string): string;
}

/**
 * Resolves package, project, and confined artwork paths.
 */
declare namespace Paths {
    /**
     * Walks up from this module to the ArtDirector package root.
     *
     * @returns Absolute package root
     */
    function packageRoot(): string;
    /**
     * Studio static files shipped with the package.
     *
     * @returns Absolute studio directory
     */
    function studioDir(): string;
    /**
     * HTML template and direction library.
     *
     * @returns Absolute library directory
     */
    function libraryDir(): string;
    /**
     * Canonical skill files.
     *
     * @returns Absolute skill directory
     */
    function skillDir(): string;
    /**
     * Finds an ArtDirector project by walking up from `start`.
     *
     * @param start Directory to start from
     * @returns Project root or null
     */
    function findProjectRoot(start?: string): string | null;
    /**
     * Returns `.artdirector` under a project root, creating it when needed.
     *
     * @param projectRoot Project root
     * @returns Absolute state directory
     */
    function stateDir(projectRoot: string): string;
    /**
     * Variant source directory.
     *
     * @param projectRoot Project root
     * @returns Absolute variants directory
     */
    function variantsDir(projectRoot: string): string;
    /**
     * Export output directory.
     *
     * @param projectRoot Project root
     * @returns Absolute exports directory
     */
    function exportsDir(projectRoot: string): string;
    /**
     * Resolves a path inside the project and rejects escapes.
     *
     * @param projectRoot Project root
     * @param target Absolute or project-relative path
     * @returns Confined absolute path
     */
    function confine(projectRoot: string, target: string): string;
    /**
     * True when a path exists and is a directory.
     *
     * @param path Candidate path
     * @returns Whether the path is a directory
     */
    function isDir(path: string): boolean;
    /**
     * Joins segments with the platform separator after confinement.
     *
     * @param projectRoot Project root
     * @param segments Path segments under the root
     * @returns Confined absolute path
     */
    function under(projectRoot: string, ...segments: string[]): string;
    /**
     * File URL path separator helper for Windows.
     *
     * @param path Absolute path
     * @returns POSIX-looking path for logs
     */
    function posix(path: string): string;
}

/**
 * Local-server token stored beside the project, never in git.
 */
declare namespace Auth {
    /**
     * Reads or creates the studio bearer token.
     *
     * @param projectRoot Project root
     * @returns Hex token
     */
    function loadOrCreate(projectRoot: string): string;
    /**
     * Token file path.
     *
     * @param projectRoot Project root
     * @returns Absolute path
     */
    function tokenPath(projectRoot: string): string;
    /**
     * Compares a presented token with the stored one.
     *
     * @param projectRoot Project root
     * @param presented Token from header or query
     */
    function assert(projectRoot: string, presented: string | undefined): void;
}

/**
 * Reads and writes the shared project + session state under `.artdirector/`.
 */
declare class ProjectContext {
    readonly root: string;
    /**
     * Opens an existing ArtDirector project.
     *
     * @param start Directory to search from
     * @returns Context bound to the project root
     */
    static open(start?: string): ProjectContext;
    /**
     * Creates a new project on disk.
     *
     * @param options Project name and optional root
     * @returns Context for the new project
     */
    static create(options: {
        name: string;
        root?: string;
        brand?: Partial<BrandContext>;
        brief?: Partial<CreativeBrief>;
    }): ProjectContext;
    /**
     * @param root Absolute project root
     */
    constructor(root: string);
    /**
     * Absolute `.artdirector` directory.
     *
     * @returns State directory
     */
    stateDir(): string;
    /**
     * Loads `project.json`.
     *
     * @returns Project snapshot
     */
    project(): ArtProject;
    /**
     * Loads `session.json`.
     *
     * @returns Session snapshot
     */
    session(): ArtSession;
    /**
     * Loads recorded variants.
     *
     * @returns Variant list
     */
    variants(): ArtworkVariant[];
    /**
     * Finds a variant by id.
     *
     * @param id Variant id
     * @returns Variant
     */
    variant(id: string): ArtworkVariant;
    /**
     * Writes the project file and bumps `updatedAt`.
     *
     * @param project Next project state
     */
    writeProject(project: ArtProject): void;
    /**
     * Writes the session file and bumps `updatedAt`.
     *
     * @param session Next session state
     */
    writeSession(session: ArtSession): void;
    /**
     * Replaces the variant catalog.
     *
     * @param variants Variant list
     */
    writeVariants(variants: ArtworkVariant[]): void;
    /**
     * Merges a partial brief into the project.
     *
     * @param patch Brief fields
     * @returns Updated project
     */
    patchBrief(patch: Partial<CreativeBrief>): ArtProject;
    /**
     * Merges a partial brand into the project.
     *
     * @param patch Brand fields
     * @returns Updated project
     */
    patchBrand(patch: Partial<BrandContext>): ArtProject;
    /**
     * Records the chosen visual direction.
     *
     * @param direction Selected direction
     * @param combined Optional additional directions to mix
     * @returns Updated project
     */
    selectDirection(direction: ArtProject["selectedDirection"], combined?: ArtProject["combinedDirections"]): ArtProject;
    /**
     * Sets the current workflow phase.
     *
     * @param phase Next phase
     */
    setPhase(phase: SessionPhase): void;
    /**
     * Upserts a variant in the catalog.
     *
     * @param variant Variant record
     * @returns Updated list
     */
    upsertVariant(variant: ArtworkVariant): ArtworkVariant[];
    /**
     * Appends a JSONL history entry.
     *
     * @param kind Event kind
     * @param payload Serializable payload
     */
    appendHistory(kind: string, payload: unknown): void;
    /**
     * Queues a live event for the agent poll loop.
     *
     * @param event Event without acknowledgement
     * @returns Stored event
     */
    enqueueEvent(event: LiveEvent): LiveEvent;
    /**
     * Pending and historical live events.
     *
     * @returns Event list
     */
    events(): LiveEvent[];
    /**
     * Next unacknowledged event, if any.
     *
     * @returns Pending event or null
     */
    pendingEvent(): LiveEvent | null;
    /**
     * Unacknowledged live events, oldest first.
     *
     * @returns Pending events
     */
    pendingEvents(): LiveEvent[];
    /**
     * Marks an event acknowledged.
     *
     * @param id Event id
     * @returns Updated event
     */
    acknowledge(id: string): LiveEvent;
    /**
     * Writes a gitignore so tokens and live queues stay local.
     */
    ensureGitignore(): void;
}

/**
 * Dispatches ArtDirector CLI commands. Agents should pass `--json`.
 *
 * @param argv Arguments after the binary name
 * @returns Command result
 */
declare function runCli(argv: string[]): Promise<CommandResult>;

/**
 * Local interactive studio server. Bound to 127.0.0.1 with a bearer token.
 * There is no shell endpoint and no path outside the project or package library.
 */
declare class StudioServer {
    private readonly ctx;
    private readonly port;
    private readonly token;
    private renderer;
    private http?;
    /**
     * @param ctx Project context
     * @param port Listen port
     * @param token Studio token
     */
    constructor(ctx: ProjectContext, port: number, token: string);
    /**
     * Starts listening on 127.0.0.1.
     *
     * @returns Public URL including the token
     */
    listen(): Promise<string>;
    /**
     * Stops the server and renderer.
     */
    close(): Promise<void>;
    /**
     * Routes a single request.
     *
     * @param req Request
     * @param res Response
     * @param routes API routes
     */
    private dispatch;
    /**
     * Rejects requests that are not loopback.
     *
     * @param req Request
     */
    private assertLocal;
    /**
     * Requires a matching bearer or query token.
     *
     * @param req Request
     * @param url URL
     */
    private assertToken;
    /**
     * Injects the token into the studio HTML.
     *
     * @param res Response
     */
    private studioIndex;
}
/**
 * Starts a studio server for a project.
 *
 * @param options Port and project context
 * @returns Server and URL
 */
declare function startStudio(options: {
    ctx: ProjectContext;
    port?: number;
}): Promise<{
    server: StudioServer;
    url: string;
    token: string;
    port: number;
}>;

/**
 * Unified render request. Callers do not choose an engine.
 */
interface RenderRequest {
    html: string;
    outputPath?: string;
    format?: ExportFormat;
    quality?: number;
    omitBackground?: boolean;
    beforeCapture?: (page: Page) => Promise<void>;
}
/**
 * Unified render result.
 */
interface RenderResult {
    buffer: Buffer;
    format: ExportFormat;
    width: number;
    height: number;
    path?: string;
    engine: "clickclick" | "playwright";
}

/**
 * Helpers for assembling a locked artboard document.
 */
declare namespace HtmlDocument {
    /**
     * Wraps inner markup in a full document with a fixed artboard.
     *
     * @param options Document parts
     * @returns HTML string
     */
    function artboard(options: {
        title: string;
        width: number;
        height: number;
        css: string;
        body: string;
        fontImport?: string;
    }): string;
    /**
     * Reads width/height from `data-width` / `data-height` or `.artboard` CSS.
     *
     * @param html Document
     * @returns Dimensions
     */
    function dimensions(html: string): {
        width: number;
        height: number;
    };
    /**
     * Splits a full document into ClickClick-style html + css fragments when possible.
     *
     * @param html Full document
     * @returns Fragments
     */
    function fragments(html: string): {
        html: string;
        css: string;
    };
}

/**
 * Production renderer: ClickClick for PNG/JPEG when the library loads,
 * Playwright for PDF, SVG, HTML, and as fallback.
 *
 * ClickClick does not export PDF or SVG and does not host the live studio,
 * so Playwright remains complementary rather than a second template system.
 */
declare class UnifiedRenderer {
    private playwright;
    private clickclick;
    /**
     * Renders through the preferred production engine.
     *
     * @param request Render request
     * @returns Result
     */
    render(request: RenderRequest): Promise<RenderResult>;
    /**
     * Inspects a loaded page via Playwright (audit, live).
     *
     * @param html Document
     * @param fn Callback
     * @returns Callback result
     */
    inspect<T>(html: string, fn: (page: Page) => Promise<T>): Promise<T>;
    /**
     * Closes browsers owned by both engines.
     */
    close(): Promise<void>;
    /**
     * Loads ClickClick once. Missing or failed import is a documented fallback.
     *
     * @returns Module or null
     */
    private loadClickClick;
}

/**
 * One audit finding.
 */
interface AuditFinding {
    id: string;
    severity: "error" | "warn" | "info";
    message: string;
    autoFix?: string;
}
/**
 * Audit report for one artwork file.
 */
interface AuditReport {
    path: string;
    width: number;
    height: number;
    findings: AuditFinding[];
    passed: boolean;
    note: string;
}
/**
 * Deterministic rendering and document checks. Passing this is not a claim of subjective quality.
 */
declare namespace ArtworkAudit {
    /**
     * Audits an HTML artwork file.
     *
     * @param htmlPath Source path
     * @param expected Optional expected size
     * @param renderer Shared renderer
     * @returns Report
     */
    function run(htmlPath: string, expected?: Pick<ArtworkVariant, "width" | "height">, renderer?: UnifiedRenderer): Promise<AuditReport>;
}

/**
 * A reusable HTML template with token slots and optional ClickClick `data-layer` names.
 */
interface TemplateSpec {
    id: string;
    title: string;
    category: ArtworkCategory;
    formatId: string;
    html: string;
    layers: string[];
}
/**
 * Loads templates from `library/templates`.
 */
declare namespace TemplateCatalog {
    /**
     * Lists available templates.
     *
     * @returns Template specs
     */
    function list(): TemplateSpec[];
    /**
     * Reads one template.
     *
     * @param id Template id (filename without extension)
     * @returns Spec
     */
    function read(id: string): TemplateSpec;
}

/**
 * Token map applied to templates (`{{key}}` and `data-layer` text).
 */
type TemplateTokens = Record<string, string>;
/**
 * Fills a template with brand, brief, and extra tokens.
 */
declare namespace TemplateApply {
    /**
     * Builds the default token map for a project.
     *
     * @param options Brand, brief, optional template format, and extras
     * @returns Token map
     */
    function tokens(options: {
        brand: BrandContext;
        brief: CreativeBrief;
        extra?: TemplateTokens;
        formatId?: string;
    }): TemplateTokens;
    /**
     * Substitutes `{{token}}` placeholders.
     *
     * @param html Template HTML
     * @param map Token map
     * @returns Filled HTML
     */
    function fill(html: string, map: TemplateTokens): string;
    /**
     * Fills a spec and injects a Bunny Fonts import when missing.
     *
     * @param spec Template
     * @param map Token map
     * @param fontPairing Pairing id
     * @returns HTML document
     */
    function render(spec: TemplateSpec, map: TemplateTokens, fontPairing?: string): string;
}

/**
 * Specialized composition guidance distilled from Claude HT Skills.
 * The engine picks one technique pack from the requested artifact - it does not load six competing skills.
 */
interface TechniquePack {
    id: string;
    categories: ArtworkCategory[];
    layouts: string[];
    principles: string[];
    htmlNotes: string[];
    avoid: string[];
}
/**
 * Technique selection.
 */
declare namespace Techniques {
    /**
     * Picks the technique pack for a brief or category.
     *
     * @param input Category or brief
     * @returns Matching pack
     */
    function forBrief(input?: ArtworkCategory | Pick<CreativeBrief, "category" | "formatId">): TechniquePack;
    /**
     * Lists pack ids for the studio and CLI.
     *
     * @returns Pack summaries
     */
    function list(): Array<{
        id: string;
        categories: ArtworkCategory[];
    }>;
}

/**
 * Named output sizes used by templates, the studio, and export.
 */
declare const OutputFormats: OutputFormat[];

/**
 * Description of a named visual direction, used for studio cards and agent guidance.
 */
interface DirectionSpec {
    id: VisualDirection;
    label: string;
    summary: string;
    displayFont: string;
    bodyFont: string;
    ink: string;
    paper: string;
    accent: string;
    density: string;
    layout: string;
    avoid: string[];
}
/**
 * The ten built-in directions. Each has a matching HTML preview in `library/directions`.
 */
declare const DirectionCatalog: DirectionSpec[];
/**
 * Direction catalog helpers.
 */
declare namespace Directions {
    /**
     * Finds a direction spec.
     *
     * @param id Direction id
     * @returns Spec
     */
    function byId(id: VisualDirection): DirectionSpec;
    /**
     * Picks a small set of alternatives when the user has not chosen.
     *
     * @param category Optional category hint
     * @returns Three direction specs
     */
    function suggest(category?: string): DirectionSpec[];
}

/**
 * Persistent quality standard adapted from Frontend Design.
 * This is applied by the skill, critique, and HTML generation - not documentation alone.
 */
declare const QualityStandard: {
    readonly name: "ArtDirector quality floor";
    readonly must: readonly ["Commit to one named visual direction and execute it throughout the piece.", "Typography must carry the voice: a distinct display face plus a refined body face. Never Inter, Roboto, Arial, or a system stack as the design.", "Hierarchy is built from scale, weight, spacing, and placement - not from extra boxes.", "Whitespace is a material. Empty fields must be intentional, not leftover.", "Contrast must keep primary text readable against its actual background.", "Every decorative mark (grain, rule, sticker, glow) has to earn its place against the brief.", "Compositions are original. Do not default to a centered card on a gradient."];
    readonly never: readonly ["Generative image APIs, diffusion models, or DALL-E / Midjourney substitutes.", "Purple-to-pink hero gradients on white as a default look.", "Repeating rounded-corner cards with identical drop shadows.", "Unmotivated glassmorphism, neon glow, or 3D pie charts.", "Cookie-cutter three-card rows when the content is a single idea.", "Claiming an edit succeeded before the HTML is written and re-rendered."];
    readonly hierarchy: readonly ["One dominant element. Everything else is supporting.", "Primary type should be readable at the export size without zooming.", "Labels, kicker, and meta sit at least two steps below the headline.", "Align to a real grid (columns, baseline, or modular) even when the layout looks loose."];
    readonly finishing: readonly ["Lock the artboard to the exact export dimensions. Overflow is a defect.", "Load fonts before capture. Fallback stacks are not the design.", "Icons are Lucide or other licensed SVGs, optically aligned, not emoji.", "Export only after audit. Automated checks do not prove subjective quality."];
};

/**
 * Result of the scripted end-to-end demonstration.
 */
interface DemoResult {
    root: string;
    variants: Array<{
        id: string;
        direction: VisualDirection;
        htmlPath: string;
        pngPath?: string;
        auditPassed: boolean;
    }>;
    acceptedId: string;
    liveEdit: string;
    exports: string[];
}
/**
 * Runs init → brief → shape → generate → live edit → accept → audit → export
 * without an LLM, using three authored HTML compositions.
 */
declare namespace DemoWorkflow {
    /**
     * Creates demonstration artifacts under `outDir`.
     *
     * @param outDir Destination directory
     * @param render Whether to capture PNG/JPEG
     * @returns Demo result
     */
    function run(outDir: string, render?: boolean): Promise<DemoResult>;
}

/**
 * Supported agent skill locations.
 */
declare const AgentTargets: {
    readonly opencode: string;
    readonly cursor: string;
    readonly claude: string;
    readonly agents: string;
};
type AgentId = keyof typeof AgentTargets;
/**
 * Copies the single ArtDirector skill into a project or home directory.
 */
declare namespace SkillInstall {
    /**
     * Installs the skill for one or all agents.
     *
     * @param options Target and destination root
     * @returns Installed paths
     */
    function run(options: {
        agent: AgentId | "all";
        dest: string;
    }): string[];
    /**
     * Writes a tiny OpenCode config snippet pointing at the skill.
     *
     * @param dest Project root
     */
    function writeOpenCodeHint(dest: string): void;
    /**
     * Reads the canonical skill body (for tests).
     *
     * @returns SKILL.md text
     */
    function skillSource(): string;
}

/**
 * Command metadata shared by the CLI, studio, and skill.
 */
interface CommandMeta {
    id: ArtCommand;
    label: string;
    category: "build" | "evaluate" | "refine" | "produce";
    summary: string;
    liveAction: boolean;
}
/**
 * Unified vocabulary. Semantics are graphic-design, even when names match Impeccable.
 */
declare const CommandRegistry: CommandMeta[];
/**
 * Live Mode action chips shown on a selected element.
 */
declare const LiveActions: readonly [{
    readonly id: "freeform";
    readonly label: "Apply note";
}, {
    readonly id: ArtCommand.BOLDER;
    readonly label: "Make bolder";
}, {
    readonly id: ArtCommand.DISTILL;
    readonly label: "Simplify";
}, {
    readonly id: ArtCommand.TYPESET;
    readonly label: "Improve typography";
}, {
    readonly id: ArtCommand.LAYOUT;
    readonly label: "Improve hierarchy";
}, {
    readonly id: "composition";
    readonly label: "Try a different composition";
}, {
    readonly id: ArtCommand.QUIETER;
    readonly label: "Reduce decorative noise";
}, {
    readonly id: "contrast";
    readonly label: "Increase contrast";
}, {
    readonly id: "editorial";
    readonly label: "Make more editorial";
}, {
    readonly id: "premium";
    readonly label: "Make more premium";
}, {
    readonly id: "brand";
    readonly label: "Preserve brand identity";
}, {
    readonly id: "direction";
    readonly label: "Try a completely different direction";
}];

export { ArtCommand, ArtDirectorError, ArtErrors, type ArtProject, type ArtSession, ArtworkAudit, ArtworkCategory, type ArtworkVariant, Auth, type BrandContext, CommandRegistry, type CommandResult, type CreativeBrief, DemoWorkflow, DirectionCatalog, Directions, ExportFormat, HtmlDocument, Ids, LiveActions, type LiveEvent, LiveEventType, OutputFormats, Paths, ProductionMode, ProjectContext, QualityStandard, SessionPhase, SkillInstall, StudioServer, Techniques, TemplateApply, TemplateCatalog, UnifiedRenderer, VariantStatus, VisualDensity, VisualDirection, runCli, startStudio };
