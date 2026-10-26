import {
    ArtErrors,
    Paths,
    StorageScope,
    type BrandContext,
    type CreativeBrief
} from "../core";
import { ProjectContext } from "./ProjectContext";
import { Scope, type SessionIdentity, type SessionRecord } from "./Scope";

/**
 * Input shared by open and init.
 */
export interface ContextOptions {
    /** Directory the user is working in. */
    workspace: string;
    /** Explicit chat id from `--session`. */
    session?: string;
    /** Explicit request id from `--request`. */
    request?: string;
    /** Force repository storage. */
    permanent?: boolean;
}

/**
 * Init input.
 */
export interface CreateOptions extends ContextOptions {
    name: string;
    brand?: Partial<BrandContext>;
    brief?: Partial<CreativeBrief>;
    /** Start a new isolated request instead of reusing the active one. */
    newRequest?: boolean;
}

/**
 * Resolved context plus the scope needed for status output.
 */
export interface ContextResolution {
    ctx: ProjectContext;
    storage: StorageScope;
    identity: SessionIdentity;
    record: SessionRecord | null;
    requestId?: string;
}

/**
 * Chooses between an isolated temp request and a permanent repository project.
 *
 * Defaults to temporary, per-chat storage. Repository state is used only when
 * the user passed `--permanent`, the session was started in repository mode,
 * or no temporary session exists but a repository project does.
 */
export namespace ContextResolver {
    /**
     * Opens the context for the current command.
     *
     * @param options Workspace, session, request, and storage overrides
     * @returns Resolution
     */
    export function open(options: ContextOptions): ContextResolution {
        const identity = Scope.identity(options.session, options.workspace);
        const record = Scope.readRecord(identity);
        const requested = options.request?.trim();

        if (requested) {
            return openRequest(identity, record, requested, options.workspace);
        }

        if (options.permanent) {
            return openRepository(identity, record, options.workspace, true);
        }

        if (record?.preferRepository) {
            const repository = openRepository(identity, record, options.workspace, false);

            if (repository) {
                return repository;
            }
        }

        if (record?.activeRequestId) {
            const active = tryOpenRequest(identity, record.activeRequestId, options.workspace);

            if (active) {
                return active;
            }
        }

        const repository = openRepository(identity, record, options.workspace, false);

        if (repository) {
            return repository;
        }

        throw ArtErrors.project(
            "No ArtDirector session or repository project found. Run `artdirector init` first. " +
            "Sessions are isolated per chat; use `--session <id>` when the agent does not expose OPENCODE_SESSION_ID."
        );
    }

    /**
     * Creates a project for a new request or opens the active one.
     *
     * @param options Name, workspace, session, storage, and brand/brief
     * @returns Resolution
     */
    export function init(options: CreateOptions): ContextResolution {
        const identity = Scope.identity(options.session, options.workspace);

        if (options.permanent) {
            return initRepository(identity, options);
        }

        const record = Scope.readRecord(identity);
        const requested = options.request?.trim();

        if (requested) {
            return openRequest(identity, record, requested, options.workspace);
        }

        if (record?.activeRequestId && !options.newRequest) {
            const active = tryOpenRequest(identity, record.activeRequestId, options.workspace);

            if (active) {
                return active;
            }
        }

        const requestId = Scope.newRequestId();
        const root = Scope.requestDir(identity, requestId);
        const ctx = ProjectContext.create({
            name: options.name,
            root,
            workspace: options.workspace,
            storage: StorageScope.SESSION,
            brand: options.brand,
            brief: options.brief
        });
        const requests = [...(record?.requests ?? []), {
            id: requestId,
            createdAt: new Date().toISOString(),
            title: options.name
        }];

        Scope.writeRecord(identity, {
            workspace: options.workspace,
            activeRequestId: requestId,
            requests,
            preferRepository: false
        });

        return {
            ctx,
            storage: StorageScope.SESSION,
            identity,
            record: Scope.readRecord(identity),
            requestId
        };
    }

    /**
     * Serializes scope details for CLI output.
     *
     * @param resolution Resolution
     * @returns JSON-safe summary
     */
    export function describe(resolution: ContextResolution): Record<string, unknown> {
        const ctx = resolution.ctx;

        return {
            storage: resolution.storage,
            ephemeral: resolution.storage === StorageScope.SESSION,
            session: {
                id: resolution.identity.id,
                key: resolution.identity.key,
                source: resolution.identity.source
            },
            requestId: resolution.requestId,
            workspace: ctx.workspace,
            root: ctx.root,
            stateDir: ctx.stateDir(),
            variantsDir: Paths.variantsDir(ctx.root),
            exportsDir: Paths.exportsDir(ctx.root)
        };
    }

    /**
     * Opens a specific request inside the session.
     *
     * @param identity Session identity
     * @param record Session record
     * @param requestId Request id
     * @param workspace Workspace path
     * @returns Resolution
     */
    function openRequest(
        identity: SessionIdentity,
        record: SessionRecord | null,
        requestId: string,
        workspace: string
    ): ContextResolution {
        const root = Scope.requestPath(identity, requestId);

        if (!Paths.hasProject(root)) {
            throw ArtErrors.project(
                `Unknown request "${requestId}" in session ${identity.id}. Run \`artdirector status --json\` to inspect it.`
            );
        }

        return {
            ctx: ProjectContext.openAt(root, workspace),
            storage: StorageScope.SESSION,
            identity,
            record,
            requestId
        };
    }

    /**
     * Opens a request when it still exists on disk.
     *
     * @param identity Session identity
     * @param requestId Request id
     * @param workspace Workspace path
     * @returns Resolution or null
     */
    function tryOpenRequest(
        identity: SessionIdentity,
        requestId: string,
        workspace: string
    ): ContextResolution | null {
        const root = Scope.requestPath(identity, requestId);

        if (!Paths.hasProject(root)) {
            return null;
        }

        return {
            ctx: ProjectContext.openAt(root, workspace),
            storage: StorageScope.SESSION,
            identity,
            record: Scope.readRecord(identity),
            requestId
        };
    }

    /**
     * Opens a repository project when one exists.
     *
     * @param identity Session identity
     * @param record Session record
     * @param workspace Workspace path
     * @param required Throw when missing
     * @returns Resolution or null
     */
    function openRepository(
        identity: SessionIdentity,
        record: SessionRecord | null,
        workspace: string,
        required: boolean
    ): ContextResolution | null {
        const root = Paths.findProjectRoot(workspace);

        if (!root) {
            if (required) {
                throw ArtErrors.project(
                    "No permanent ArtDirector project found. Run `artdirector init --permanent` to store state in this repository."
                );
            }

            return null;
        }

        return {
            ctx: ProjectContext.openAt(root, workspace),
            storage: StorageScope.REPOSITORY,
            identity,
            record
        };
    }

    /**
     * Creates or reuses a repository project.
     *
     * @param identity Session identity
     * @param options Init options
     * @returns Resolution
     */
    function initRepository(identity: SessionIdentity, options: CreateOptions): ContextResolution {
        const existing = Paths.findProjectRoot(options.workspace);
        const root = existing ?? options.workspace;
        const ctx = Paths.hasProject(root)
            ? ProjectContext.openAt(root, options.workspace)
            : ProjectContext.create({
                name: options.name,
                root,
                workspace: options.workspace,
                storage: StorageScope.REPOSITORY,
                brand: options.brand,
                brief: options.brief
            });
        const record = Scope.writeRecord(identity, {
            workspace: options.workspace,
            preferRepository: true
        });

        return {
            ctx,
            storage: StorageScope.REPOSITORY,
            identity,
            record
        };
    }
}
