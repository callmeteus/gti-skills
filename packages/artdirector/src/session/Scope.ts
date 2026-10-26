import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Ids, JsonFile } from "../core";

/**
 * Stable chat or terminal identity used to isolate temporary project state.
 */
export interface SessionIdentity {
    /** Raw identity reported by the agent or flag. */
    id: string;
    /** Filesystem-safe directory name. */
    key: string;
    /** Where the identity came from. */
    source: string;
}

/**
 * One isolated request inside a session. Requests never share brand, brief,
 * variants, or live events.
 */
export interface SessionRequest {
    id: string;
    createdAt: string;
    title?: string;
}

/**
 * Session-level index stored beside the request directories.
 */
export interface SessionRecord {
    id: string;
    key: string;
    source: string;
    workspace: string;
    createdAt: string;
    updatedAt: string;
    activeRequestId?: string;
    requests: SessionRequest[];
    preferRepository: boolean;
}

/**
 * Environment variables that identify the current agent chat.
 */
const SessionVariables = [
    "ARTDIRECTOR_SESSION",
    "OPENCODE_SESSION_ID",
    "PASEO_AGENT_ID",
    "CLAUDE_SESSION_ID",
    "CURSOR_SESSION_ID",
    "CODEX_SESSION_ID",
    "TERM_SESSION_ID"
] as const;

const RecordFile = "session.json";

/**
 * Resolves the temporary session directory and its request index.
 *
 * Temporary state lives under `%TEMP%/artdirector` by default and can be
 * redirected with `ARTDIRECTOR_HOME`.
 */
export namespace Scope {
    /**
     * Root directory for temporary ArtDirector sessions.
     *
     * @returns Absolute temporary home
     */
    export function home(): string {
        const override = process.env.ARTDIRECTOR_HOME?.trim();

        if (override) {
            return resolve(override);
        }

        return join(tmpdir(), "artdirector");
    }

    /**
     * Resolves the current chat identity.
     *
     * Explicit flags win over agent environment variables. A plain terminal
     * without a chat id falls back to a workspace-scoped session.
     *
     * @param explicit Session id from `--session`
     * @param workspace Current working directory
     * @returns Identity
     */
    export function identity(explicit: string | undefined, workspace = process.cwd()): SessionIdentity {
        if (explicit?.trim()) {
            return describe(explicit.trim(), "--session");
        }

        for (const name of SessionVariables) {
            const value = process.env[name]?.trim();

            if (value) {
                return describe(value, name);
            }
        }

        return describe(`workspace:${resolve(workspace)}`, "workspace");
    }

    /**
     * Directory holding one session's index and request folders.
     *
     * @param identity Session identity
     * @returns Absolute session directory
     */
    export function sessionDir(identity: SessionIdentity): string {
        const dir = join(home(), "sessions", identity.key);
        mkdirSync(dir, { recursive: true });
        return dir;
    }

    /**
     * Directory for one isolated request, without creating it.
     *
     * @param identity Session identity
     * @param requestId Request id
     * @returns Absolute request root
     */
    export function requestPath(identity: SessionIdentity, requestId: string): string {
        return join(sessionDir(identity), "requests", requestId);
    }

    /**
     * Directory for one isolated request.
     *
     * @param identity Session identity
     * @param requestId Request id
     * @returns Absolute request root
     */
    export function requestDir(identity: SessionIdentity, requestId: string): string {
        const dir = requestPath(identity, requestId);
        mkdirSync(dir, { recursive: true });
        return dir;
    }

    /**
     * Reads the session index.
     *
     * @param identity Session identity
     * @returns Record or null
     */
    export function readRecord(identity: SessionIdentity): SessionRecord | null {
        const file = join(sessionDir(identity), RecordFile);

        try {
            const record = JsonFile.read<SessionRecord>(file);
            record.requests ??= [];
            record.preferRepository ??= false;
            return record;
        } catch {
            return null;
        }
    }

    /**
     * Creates or updates the session index.
     *
     * @param identity Session identity
     * @param patch Fields to merge
     * @returns Stored record
     */
    export function writeRecord(identity: SessionIdentity, patch: Partial<SessionRecord> = {}): SessionRecord {
        const now = new Date().toISOString();
        const existing = readRecord(identity);
        const record: SessionRecord = {
            id: identity.id,
            key: identity.key,
            source: identity.source,
            workspace: patch.workspace ?? existing?.workspace ?? process.cwd(),
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            activeRequestId: patch.activeRequestId ?? existing?.activeRequestId,
            requests: patch.requests ?? existing?.requests ?? [],
            preferRepository: patch.preferRepository ?? existing?.preferRepository ?? false
        };

        JsonFile.write(join(sessionDir(identity), RecordFile), record);
        return record;
    }

    /**
     * Creates a new request id.
     *
     * @returns Sortable id, for example `req-20261026-143012-ab12`
     */
    export function newRequestId(): string {
        const now = new Date();
        const stamp = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0")
        ].join("");
        const time = [
            String(now.getHours()).padStart(2, "0"),
            String(now.getMinutes()).padStart(2, "0"),
            String(now.getSeconds()).padStart(2, "0")
        ].join("");

        return `req-${stamp}-${time}-${Ids.short(2)}`;
    }
}

/**
 * Builds an identity with a readable, collision-resistant directory key.
 *
 * @param id Raw identity
 * @param source Origin
 * @returns Identity
 */
function describe(id: string, source: string): SessionIdentity {
    const readable = id.startsWith("workspace:")
        ? "workspace"
        : Ids.slug(id.replace(/^ses_/, "chat-")).slice(0, 40) || "session";
    const digest = createHash("sha256").update(id).digest("hex").slice(0, 10);

    return {
        id,
        key: `${readable}-${digest}`,
        source
    };
}
