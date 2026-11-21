import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { GtiHome } from "../core/GtiHome";
import { Ids } from "../core/Ids";
import { Json } from "../core/Json";
import { VideoErrors } from "../core/Errors";
import type { ProjectRecord, ProjectScope, TimelineSpec } from "../core/Types";
import { defaultSpec } from "./Spec";

/** Options shared by every command that needs a project. */
export interface ProjectRef {
    workspace: string;
    session?: string;
    request?: string;
    permanent?: boolean;
}

/** Result of init or open. */
export interface ProjectContext {
    scope: ProjectScope;
    project: ProjectRecord;
    created: boolean;
}

/** Result of init. */
export interface InitResult extends ProjectContext {
    spec: TimelineSpec;
}

/** One line of `history`. */
export interface HistoryEntry {
    id: string;
    name: string;
    createdAt: string;
    lastRender: string | null;
    active: boolean;
}

/**
 * Per chat state under `~/.gti/video-editor`. Every path is outside the user's
 * repository; `workspace` is only used to derive stable folder names.
 */
export const Project = {
    /** Session id from the harness, or `default` when the agent exposes none. */
    sessionFromEnv(explicit?: string): string {
        const value = explicit
            ?? process.env.VIDEOEDITOR_SESSION
            ?? process.env.PASEO_AGENT_ID
            ?? process.env.OPENCODE_SESSION_ID
            ?? process.env.CLAUDE_SESSION_ID
            ?? process.env.CODEX_SESSION_ID
            ?? process.env.CURSOR_SESSION_ID;
        const key = Ids.slug(value ?? "default");
        return key || "default";
    },

    /** Parent folder that holds all requests for one workspace and session. */
    baseDir(ref: ProjectRef): string {
        const workspaceKey = GtiHome.workspaceKey(ref.workspace);

        if (ref.permanent) {
            return join(GtiHome.projectsDir(), workspaceKey);
        }

        return join(GtiHome.sessionsDir(), workspaceKey, this.sessionFromEnv(ref.session));
    },

    /** Folder of one request. */
    requestDir(base: string, requestId: string): string {
        return join(base, "requests", Ids.slug(requestId) || requestId);
    },

    /** Paths the CLI reports in JSON and that the skill uses to write files. */
    scopeOf(base: string, requestId: string, ref: ProjectRef): ProjectScope {
        const stateDir = this.requestDir(base, requestId);

        return {
            workspace: ref.workspace,
            root: ref.workspace,
            stateDir,
            specPath: join(stateDir, "timeline.json"),
            mediaDir: join(stateDir, "media"),
            exportsDir: join(stateDir, "exports"),
            storage: ref.permanent ? "permanent" : "session",
            session: this.sessionFromEnv(ref.session),
            request: requestId
        };
    },

    /** Creates a request or returns the current one. */
    init(ref: ProjectRef, name = "untitled", newRequest = false): InitResult {
        const base = this.baseDir(ref);
        const activeFile = join(base, "active.json");
        const active = Json.maybe<{ requestId: string }>(activeFile);
        const requestId = newRequest || !active
            ? Ids.short()
            : active.requestId;
        const scope = this.scopeOf(base, requestId, ref);
        const specPath = scope.specPath;
        const recordPath = join(scope.stateDir, "project.json");
        const created = !existsSync(recordPath);

        mkdirSync(scope.exportsDir, { recursive: true });
        mkdirSync(scope.mediaDir, { recursive: true });

        const project: ProjectRecord = created
            ? {
                id: requestId,
                name,
                createdAt: new Date().toISOString(),
                workspace: ref.workspace,
                phase: "init",
                specPath,
                lastRender: null
            }
            : Json.read<ProjectRecord>(recordPath);

        if (created) {
            Json.write(recordPath, project);
        }
        if (!existsSync(specPath)) {
            Json.write(specPath, defaultSpec(name));
        }
        Json.write(activeFile, { requestId });

        return { scope, project, created, spec: Json.read<TimelineSpec>(specPath) };
    },

    /** Opens the active request. Throws when init has not run. */
    open(ref: ProjectRef): ProjectContext {
        const base = this.baseDir(ref);
        const active = Json.maybe<{ requestId: string }>(join(base, "active.json"));

        if (!active?.requestId) {
            throw VideoErrors.project("No active video project. Run `videoeditor init` first.");
        }

        const requested = ref.request ?? active.requestId;
        const scope = this.scopeOf(base, requested, ref);
        const recordPath = join(scope.stateDir, "project.json");

        if (!existsSync(recordPath)) {
            throw VideoErrors.project(`Request "${requested}" does not exist. Run \`videoeditor history --json\`.`);
        }

        return { scope, project: Json.read<ProjectRecord>(recordPath), created: false };
    },

    /** Lists requests in a session or permanent project. */
    history(ref: ProjectRef): HistoryEntry[] {
        const base = this.baseDir(ref);
        const active = Json.maybe<{ requestId: string }>(join(base, "active.json"));
        const requestsDir = join(base, "requests");

        if (!existsSync(requestsDir)) {
            return [];
        }

        return readdirSync(requestsDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => {
                const path = join(requestsDir, entry.name, "project.json");
                const record = Json.maybe<ProjectRecord>(path);

                return record ? {
                    id: record.id,
                    name: record.name,
                    createdAt: record.createdAt,
                    lastRender: record.lastRender,
                    active: entry.name === active?.requestId
                } : null;
            })
            .filter((entry): entry is HistoryEntry => entry !== null)
            .sort((left, right) => left.createdAt < right.createdAt ? 1 : -1);
    },

    /** Reads the timeline of a request. */
    spec(scope: ProjectScope): TimelineSpec {
        return Json.read<TimelineSpec>(scope.specPath);
    },

    /** Writes the timeline of a request. */
    saveSpec(scope: ProjectScope, spec: TimelineSpec): void {
        Json.write(scope.specPath, spec);
    },

    /** Writes the project record. */
    saveRecord(scope: ProjectScope, record: ProjectRecord): void {
        Json.write(join(scope.stateDir, "project.json"), record);
    },

    /** Updates the phase stored in the project record. */
    setPhase(scope: ProjectScope, phase: string): ProjectRecord {
        const path = join(scope.stateDir, "project.json");
        const record = Json.read<ProjectRecord>(path);
        record.phase = phase;
        this.saveRecord(scope, record);
        return record;
    }
};
