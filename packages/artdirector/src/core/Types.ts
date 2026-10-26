/**
 * Shared domain types for ArtDirector projects, sessions, and artwork.
 */

/**
 * Closed command vocabulary used by the CLI, skill, and studio.
 */
export enum ArtCommand {
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
export enum ArtworkCategory {
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
export enum VisualDirection {
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
export enum ProductionMode {
    TEMPLATE = "template",
    ART_DIRECTION = "art-direction"
}

/**
 * Visual density of a composition.
 */
export enum VisualDensity {
    SPARSE = "sparse",
    BALANCED = "balanced",
    DENSE = "dense"
}

/**
 * Live-mode event types exchanged between the studio and the agent.
 */
export enum LiveEventType {
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
export enum VariantStatus {
    DRAFT = "draft",
    SELECTED = "selected",
    ACCEPTED = "accepted",
    REJECTED = "rejected"
}

/**
 * Where project state lives: an isolated temp session or the repository itself.
 */
export enum StorageScope {
    SESSION = "session",
    REPOSITORY = "repository"
}

/**
 * Raster and document export formats.
 */
export enum ExportFormat {
    PNG = "png",
    JPEG = "jpeg",
    SVG = "svg",
    PDF = "pdf",
    HTML = "html"
}

/**
 * Brand identity stored with a project.
 */
export interface BrandContext {
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
export interface BrandFonts {
    display: string;
    body: string;
    mono?: string;
}

/**
 * Color tokens for a brand.
 */
export interface BrandColors {
    ink: string;
    paper: string;
    accent: string;
    muted?: string;
    extra: string[];
}

/**
 * Colors a new project starts with. Templates keep their own palette while the brand still uses these.
 */
export const DefaultBrandColors: Pick<BrandColors, "ink" | "paper" | "accent" | "muted"> = {
    ink: "#14110e",
    paper: "#f4efe6",
    accent: "#c23b22",
    muted: "#8a8178"
};

/**
 * Project name used when the user did not name the project.
 */
export const DefaultProjectName = "Untitled project";

/**
 * Communication brief for a piece or campaign.
 */
export interface CreativeBrief {
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
export interface ArtProject {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    root: string;
    workspace: string;
    storage: StorageScope;
    brand: BrandContext;
    brief: CreativeBrief;
    selectedDirection?: VisualDirection;
    combinedDirections: VisualDirection[];
    activeVariantId?: string;
    acceptedVariantId?: string;
    /** Studio interface language, taken from the language of the user's prompt. */
    language?: StudioLanguage;
}

/**
 * Languages the studio interface ships in.
 */
export type StudioLanguage = "en" | "pt" | "es";

/**
 * Interactive session persisted beside the project.
 */
export interface ArtSession {
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
export enum SessionPhase {
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
export interface ArtworkVariant {
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
export interface LiveSelection {
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
export interface LiveEvent {
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
export interface OutputFormat {
    id: string;
    label: string;
    short: string;
    width: number;
    height: number;
    category: ArtworkCategory;
}

/**
 * Asset origin record for licensing.
 */
export interface AssetRecord {
    id: string;
    path: string;
    origin: string;
    license: string;
    attribution?: string;
    notes?: string;
}

/**
 * Structured CLI / HTTP result.
 */
export interface CommandResult {
    ok: boolean;
    command: string;
    summary: string;
    data?: Record<string, unknown>;
    error?: string;
}
