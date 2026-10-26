import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
    ArtErrors,
    Ids,
    JsonFile,
    Paths,
    ProductionMode,
    SessionPhase,
    StorageScope,
    VisualDensity,
    type ArtProject,
    type ArtSession,
    type ArtworkVariant,
    type BrandContext,
    type CreativeBrief,
    type LiveEvent
} from "../core";

/**
 * Reads and writes the shared project + session state under `.artdirector/`.
 */
export class ProjectContext {
    /**
     * Opens an existing ArtDirector project in repository mode.
     *
     * @param start Directory to search from
     * @returns Context bound to the project root
     */
    static open(start = process.cwd()): ProjectContext {
        const root = Paths.findProjectRoot(start);

        if (!root) {
            throw ArtErrors.project("No ArtDirector project found. Run `artdirector init` first.");
        }

        return new ProjectContext(root);
    }

    /**
     * Opens a context at an exact root, without walking up.
     *
     * @param root Project root
     * @param workspace Directory the user is working in
     * @returns Context
     */
    static openAt(root: string, workspace = root): ProjectContext {
        if (!Paths.hasProject(root)) {
            throw ArtErrors.project(`No ArtDirector project found at ${root}. Run \`artdirector init\` first.`);
        }

        return new ProjectContext(root, workspace);
    }

    /**
     * Creates a new project on disk.
     *
     * @param options Project name, root, storage scope, and optional brand/brief
     * @returns Context for the new project
     */
    static create(options: {
        name: string;
        root?: string;
        workspace?: string;
        storage?: StorageScope;
        brand?: Partial<BrandContext>;
        brief?: Partial<CreativeBrief>;
    }): ProjectContext {
        const root = options.root ?? process.cwd();
        const workspace = options.workspace ?? root;
        const storage = options.storage ?? StorageScope.REPOSITORY;
        const now = new Date().toISOString();
        const ctx = new ProjectContext(root, workspace);
        const brand = defaultBrand(options.name, options.brand);
        const brief = defaultBrief(options.brief);
        const project: ArtProject = {
            id: Ids.uuid(),
            name: options.name,
            createdAt: now,
            updatedAt: now,
            root,
            workspace,
            storage,
            brand,
            brief,
            combinedDirections: []
        };
        const session: ArtSession = {
            id: Ids.short(6),
            projectId: project.id,
            createdAt: now,
            updatedAt: now,
            phase: SessionPhase.INIT,
            liveEnabled: false,
            notes: []
        };

        mkdirSync(Paths.stateDir(root), { recursive: true });
        ctx.writeProject(project);
        ctx.writeSession(session);
        ctx.writeVariants([]);

        if (storage === StorageScope.REPOSITORY) {
            ctx.ensureGitignore();
        }

        return ctx;
    }

    /**
     * @param root Absolute project root
     * @param workspace Directory the user is working in
     */
    constructor(
        public readonly root: string,
        public readonly workspace: string = root
    ) {}

    /**
     * Absolute `.artdirector` directory.
     *
     * @returns State directory
     */
    stateDir(): string {
        return Paths.stateDir(this.root);
    }

    /**
     * Loads `project.json`.
     *
     * @returns Project snapshot
     */
    project(): ArtProject {
        const project = JsonFile.read<ArtProject>(join(this.stateDir(), "project.json"));
        project.storage ??= StorageScope.REPOSITORY;
        project.workspace ??= project.root ?? this.workspace;
        return project;
    }

    /**
     * Loads `session.json`.
     *
     * @returns Session snapshot
     */
    session(): ArtSession {
        return JsonFile.read<ArtSession>(join(this.stateDir(), "session.json"));
    }

    /**
     * Loads recorded variants.
     *
     * @returns Variant list
     */
    variants(): ArtworkVariant[] {
        return JsonFile.readOr<ArtworkVariant[]>(join(this.stateDir(), "variants.json"), []);
    }

    /**
     * Finds a variant by id.
     *
     * @param id Variant id
     * @returns Variant
     */
    variant(id: string): ArtworkVariant {
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
    writeProject(project: ArtProject): void {
        project.updatedAt = new Date().toISOString();
        JsonFile.write(join(this.stateDir(), "project.json"), project);
    }

    /**
     * Writes the session file and bumps `updatedAt`.
     *
     * @param session Next session state
     */
    writeSession(session: ArtSession): void {
        session.updatedAt = new Date().toISOString();
        JsonFile.write(join(this.stateDir(), "session.json"), session);
    }

    /**
     * Replaces the variant catalog.
     *
     * @param variants Variant list
     */
    writeVariants(variants: ArtworkVariant[]): void {
        JsonFile.write(join(this.stateDir(), "variants.json"), variants);
    }

    /**
     * Merges a partial brief into the project.
     *
     * @param patch Brief fields
     * @returns Updated project
     */
    patchBrief(patch: Partial<CreativeBrief>): ArtProject {
        const project = this.project();
        project.brief = {
            ...project.brief,
            ...patch,
            constraints: patch.constraints ?? project.brief.constraints,
            copy: {
                ...project.brief.copy,
                ...(patch.copy ?? {})
            }
        };
        this.writeProject(project);
        this.setPhase(SessionPhase.BRIEF);
        this.appendHistory("brief", patch);
        return project;
    }

    /**
     * Merges a partial brand into the project.
     *
     * @param patch Brand fields
     * @returns Updated project
     */
    patchBrand(patch: Partial<BrandContext>): ArtProject {
        const project = this.project();
        project.brand = {
            ...project.brand,
            ...patch,
            fonts: {
                ...project.brand.fonts,
                ...(patch.fonts ?? {})
            },
            colors: {
                ...project.brand.colors,
                extra: patch.colors?.extra ?? project.brand.colors.extra,
                ...(patch.colors ?? {})
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
    selectDirection(direction: ArtProject["selectedDirection"], combined: ArtProject["combinedDirections"] = []): ArtProject {
        const project = this.project();
        project.selectedDirection = direction;
        project.combinedDirections = combined;
        this.writeProject(project);
        this.setPhase(SessionPhase.SHAPE);
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
    setPhase(phase: SessionPhase): void {
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
    upsertVariant(variant: ArtworkVariant): ArtworkVariant[] {
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
    appendHistory(kind: string, payload: unknown): void {
        const line = JSON.stringify({
            at: new Date().toISOString(),
            kind,
            payload
        });
        const file = join(this.stateDir(), "history.jsonl");
        writeFileSync(file, `${line}\n`, {
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
    enqueueEvent(event: LiveEvent): LiveEvent {
        const events = this.events();
        events.push(event);
        JsonFile.write(join(this.stateDir(), "events.json"), events);
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
    events(): LiveEvent[] {
        return JsonFile.readOr<LiveEvent[]>(join(this.stateDir(), "events.json"), []);
    }

    /**
     * Next unacknowledged event, if any.
     *
     * @returns Pending event or null
     */
    pendingEvent(): LiveEvent | null {
        return this.pendingEvents()[0] ?? null;
    }

    /**
     * Unacknowledged live events, oldest first.
     *
     * @returns Pending events
     */
    pendingEvents(): LiveEvent[] {
        return this.events().filter((event) => !event.acknowledged);
    }

    /**
     * Marks an event acknowledged.
     *
     * @param id Event id
     * @returns Updated event
     */
    acknowledge(id: string): LiveEvent {
        const events = this.events();
        const event = events.find((item) => item.id === id);

        if (!event) {
            throw ArtErrors.notFound(`Unknown live event: ${id}`);
        }

        event.acknowledged = true;
        JsonFile.write(join(this.stateDir(), "events.json"), events);
        return event;
    }

    /**
     * Writes a gitignore so tokens and live queues stay local.
     */
    ensureGitignore(): void {
        const file = join(this.stateDir(), ".gitignore");

        if (existsSync(file)) {
            return;
        }

        writeFileSync(
            file,
            ["token", "live/", "exports/", "events.json", "studio.json", ""].join("\n"),
            "utf8"
        );
    }
}

/**
 * Default brand when the user has not supplied one.
 *
 * @param name Project name
 * @param patch Optional overrides
 * @returns Brand context
 */
function defaultBrand(name: string, patch?: Partial<BrandContext>): BrandContext {
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

/**
 * Default brief with empty copy slots.
 *
 * @param patch Optional overrides
 * @returns Brief
 */
function defaultBrief(patch?: Partial<CreativeBrief>): CreativeBrief {
    return {
        goal: patch?.goal ?? "",
        audience: patch?.audience,
        objective: patch?.objective,
        category: patch?.category,
        formatId: patch?.formatId,
        tone: patch?.tone,
        personality: patch?.personality,
        density: patch?.density ?? VisualDensity.BALANCED,
        typographicDirection: patch?.typographicDirection,
        palette: patch?.palette,
        compositionStyle: patch?.compositionStyle,
        emphasis: patch?.emphasis,
        productionMode: patch?.productionMode ?? ProductionMode.ART_DIRECTION,
        constraints: patch?.constraints ?? [],
        copy: patch?.copy ?? {}
    };
}
