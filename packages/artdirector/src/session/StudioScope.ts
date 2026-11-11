import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { ArtErrors, JsonFile, Paths, type ArtworkVariant } from "../core";
import { ProjectContext } from "./ProjectContext";
import type { SessionRecord } from "./Scope";

/**
 * One piece of art in the studio history: a request and its variants.
 */
export interface ArtSummary {
    /** Request id, absent for a repository project. */
    requestId?: string;
    title: string;
    createdAt: string;
    /** True for the request the agent is working on now. */
    current: boolean;
    acceptedVariantId?: string;
    variants: Array<ArtworkVariant & { htmlFile: string }>;
}

/**
 * Everything one studio serves: every request of a chat session, or a single
 * repository project. The studio follows the session's active request, and
 * older requests stay readable as history.
 */
export class StudioScope {
    private readonly contexts = new Map<string, ProjectContext>();

    /**
     * @param home Context the studio was started from
     * @param sessionDir Session folder holding `session.json` and `requests/`, or null
     */
    private constructor(
        private readonly home: ProjectContext,
        readonly sessionDir: string | null
    ) {
        const id = this.requestIdOf(home);

        if (id) {
            this.contexts.set(id, home);
        }
    }

    /**
     * Builds the scope for a context. A temporary request groups with its session.
     *
     * @param ctx Project context
     * @returns Scope
     */
    static of(ctx: ProjectContext): StudioScope {
        const requests = dirname(ctx.root);
        const sessionDir = dirname(requests);

        if (basename(requests) === "requests" && existsSync(join(sessionDir, "session.json"))) {
            return new StudioScope(ctx, sessionDir);
        }

        return new StudioScope(ctx, null);
    }

    /**
     * Folder for studio-wide state: token, lock, and mood board.
     *
     * @returns Session folder, or the project's `.artdirector`
     */
    stateDir(): string {
        return this.sessionDir ?? this.home.stateDir();
    }

    /**
     * @returns Mood board folder shared by every art in the scope
     */
    moodboardDir(): string {
        return join(this.stateDir(), "moodboard");
    }

    /**
     * The request the agent is working on now.
     *
     * @returns Active context, or the home context
     */
    current(): ProjectContext {
        const active = this.record()?.activeRequestId;

        if (active && this.exists(active)) {
            return this.get(active);
        }

        return this.home;
    }

    /**
     * Opens one request of the session.
     *
     * @param requestId Request id; empty means the current request
     * @returns Context
     */
    get(requestId?: string | null): ProjectContext {
        const id = requestId?.trim();

        if (!id) {
            return this.current();
        }

        const cached = this.contexts.get(id);

        if (cached) {
            return cached;
        }

        if (!this.sessionDir || !this.exists(id)) {
            throw ArtErrors.notFound(`Unknown art "${id}" in this studio.`);
        }

        const ctx = ProjectContext.openAt(join(this.sessionDir, "requests", id), this.home.workspace);
        this.contexts.set(id, ctx);
        return ctx;
    }

    /**
     * @param ctx Context
     * @returns Request id when the context belongs to a session
     */
    requestIdOf(ctx: ProjectContext): string | undefined {
        return this.sessionDir ? basename(ctx.root) : undefined;
    }

    /**
     * Every art in the scope, newest first.
     *
     * @returns Art summaries
     */
    arts(): ArtSummary[] {
        const current = this.current();

        if (!this.sessionDir) {
            return [summarize(current, undefined, true)];
        }

        const record = this.record();
        const requests = [...(record?.requests ?? [])]
            .filter((item) => this.exists(item.id))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        return requests.map((item) => summarize(this.get(item.id), item.id, this.get(item.id) === current, item.title, item.createdAt));
    }

    /**
     * @returns Session index, or null outside a session
     */
    private record(): SessionRecord | null {
        if (!this.sessionDir) {
            return null;
        }

        try {
            return JsonFile.read<SessionRecord>(join(this.sessionDir, "session.json"));
        } catch {
            return null;
        }
    }

    /**
     * @param requestId Request id
     * @returns True when the request is listed in the session and still on disk
     */
    private exists(requestId: string): boolean {
        if (!this.sessionDir || !/^[\w-]+$/.test(requestId)) {
            return false;
        }

        const listed = this.record()?.requests.some((item) => item.id === requestId) ?? false;
        return listed && Paths.hasProject(join(this.sessionDir, "requests", requestId));
    }
}

/**
 * @param ctx Context
 * @param requestId Request id
 * @param current Whether this is the active request
 * @param title Title from the session index
 * @param createdAt Creation time from the session index
 * @returns Summary
 */
function summarize(
    ctx: ProjectContext,
    requestId: string | undefined,
    current: boolean,
    title?: string,
    createdAt?: string
): ArtSummary {
    const project = ctx.project();

    return {
        requestId,
        title: project.name || title || requestId || "Art",
        createdAt: createdAt ?? project.createdAt,
        current,
        acceptedVariantId: project.acceptedVariantId,
        variants: ctx.variants().map((item) => ({
            ...item,
            htmlFile: Paths.confine(ctx.root, item.htmlPath)
        }))
    };
}
