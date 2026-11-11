import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";

import { ArtErrors, Auth, Paths } from "../core";
import { UnifiedRenderer } from "../renderer";
import { MoodBoard, ProjectContext, StudioScope } from "../session";
import { Http } from "./Http";
import { StudioRoutes } from "./Routes";
import { StudioLock } from "./StudioLock";

/** Ports tried after the preferred one before the OS picks a free port. */
const PORT_ATTEMPTS = 20;

/**
 * Local interactive studio server. Bound to 127.0.0.1 with a bearer token.
 * There is no shell endpoint and no path outside the project or package library.
 */
export class StudioServer {
    private renderer = new UnifiedRenderer();
    private http?: ReturnType<typeof createServer>;
    /** Package folder this server was started from; an update may delete it while the server runs. */
    private readonly packageRoot = Paths.packageRoot();

    /**
     * @param scope Arts the studio serves
     * @param port Listen port
     * @param token Studio token
     */
    constructor(
        private readonly scope: StudioScope,
        private port: number,
        private readonly token: string
    ) {}

    /**
     * Starts listening on 127.0.0.1. When the port is taken, tries the next
     * ports, then lets the OS assign one.
     *
     * @returns Public URL including the token
     */
    async listen(): Promise<string> {
        const routes = new StudioRoutes(this.scope, this.renderer);
        const candidates = Array.from({ length: PORT_ATTEMPTS + 1 }, (_, i) => this.port + i);
        candidates.push(0);

        for (const candidate of candidates) {
            const http = createServer((req, res) => {
                void this.dispatch(req, res, routes);
            });

            try {
                await new Promise<void>((resolve, reject) => {
                    http.once("error", reject);
                    http.listen(candidate, "127.0.0.1", () => resolve());
                });
            } catch (err) {
                if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
                    continue;
                }

                throw err;
            }

            const address = http.address();
            this.http = http;
            this.port = typeof address === "object" && address ? address.port : candidate;
            return `http://127.0.0.1:${this.port}/?token=${this.token}`;
        }

        throw ArtErrors.server("No free port for the studio.");
    }

    /**
     * @returns Port the server is bound to
     */
    boundPort(): number {
        return this.port;
    }

    /**
     * Stops the server and renderer.
     */
    async close(): Promise<void> {
        StudioLock.release(this.scope.stateDir(), this.port);
        await this.renderer.close();
        await new Promise<void>((resolve, reject) => {
            if (!this.http) {
                resolve();
                return;
            }

            this.http.close((err) => (err ? reject(err) : resolve()));
        });
    }

    /**
     * Routes a single request.
     *
     * @param req Request
     * @param res Response
     * @param routes API routes
     */
    private async dispatch(req: IncomingMessage, res: ServerResponse, routes: StudioRoutes): Promise<void> {
        if (!existsSync(join(this.packageRoot, "package.json"))) {
            this.retire(res);
            return;
        }

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
                const file = Paths.confine(Paths.studioDir(), join(Paths.studioDir(), url.pathname.slice("/studio/".length)));

                if (!Http.file(res, file)) {
                    throw ArtErrors.notFound("Studio asset not found.");
                }

                return;
            }

            if (req.method === "GET" && (url.pathname === "/studio.css" || url.pathname === "/studio.js" || url.pathname === "/live.js")) {
                const file = join(Paths.studioDir(), url.pathname.slice(1));

                if (!Http.file(res, file)) {
                    throw ArtErrors.notFound("Studio asset not found.");
                }

                return;
            }

            if (req.method === "GET" && url.pathname.startsWith("/library/")) {
                const file = Paths.confine(Paths.libraryDir(), join(Paths.libraryDir(), url.pathname.slice("/library/".length)));

                if (!Http.file(res, file)) {
                    throw ArtErrors.notFound("Library file not found.");
                }

                return;
            }

            if (req.method === "GET" && url.pathname.startsWith("/artwork/")) {
                const [id = "", ...asset] = url.pathname.slice("/artwork/".length).split("/").map(decodeURIComponent);

                const request = Http.query(url, "request");

                if (asset.length > 0 && asset.join("/")) {
                    routes.artworkAsset(id, asset.join("/"), res, request);
                } else {
                    routes.artwork(id, res, request);
                }

                return;
            }

            if (req.method === "GET" && url.pathname.startsWith("/moodboard/")) {
                const id = decodeURIComponent(url.pathname.slice("/moodboard/".length));
                const board = new MoodBoard(this.scope.moodboardDir());

                if (!Http.file(res, Paths.confine(board.dir, board.imagePath(id)))) {
                    throw ArtErrors.notFound("Mood board image not found.");
                }

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
     * Answers a studio whose package folder was removed (usually by an update), then shuts it down
     * and frees the port so the next `studio` command starts a working one.
     *
     * @param res Response
     */
    private retire(res: ServerResponse): void {
        res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        res.end(
            "This Art Director studio was started from an install that has since been updated or removed.\n" +
            "Ask the agent to run `studio --open` again; it opens a new studio with the same artwork.\n"
        );
        res.once("finish", () => {
            void this.close().catch(() => undefined);
        });
    }

    /**
     * Rejects requests that are not loopback.
     *
     * @param req Request
     */
    private assertLocal(req: IncomingMessage): void {
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
    private assertToken(req: IncomingMessage, url: URL): void {
        const header = req.headers.authorization;
        const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
        // An explicit token wins over the cookie, which may be stale from an earlier studio on this host.
        Auth.matches(this.token, bearer ?? Http.query(url, "token") ?? cookieToken(req, this.port));
    }

    /**
     * Injects the token into the studio HTML.
     *
     * @param res Response
     */
    private studioIndex(_req: IncomingMessage, res: ServerResponse): void {
        const file = join(Paths.studioDir(), "index.html");

        if (!existsSync(file)) {
            throw ArtErrors.notFound("Studio UI is missing from the package.");
        }

        const html = readFileSync(file, "utf8")
            .replaceAll("%%TOKEN%%", this.token)
            .replaceAll("%%PORT%%", String(this.port))
            .replaceAll('href="/studio.css"', `href="/studio.css?token=${this.token}"`)
            .replaceAll('src="/studio.js"', `src="/studio.js?token=${this.token}"`);
        res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Set-Cookie": `${cookieName(this.port)}=${this.token}; Path=/; HttpOnly; SameSite=Strict`
        });
        res.end(html);
    }
}

/**
 * Cookie name for one studio. Browsers share cookies across ports on the same host, so each port
 * gets its own name and two studios never overwrite each other's token.
 *
 * @param port Studio port
 * @returns Cookie name
 */
function cookieName(port: number): string {
    return `artdirector_token_${port}`;
}

/**
 * Reads the studio token from the request cookie.
 *
 * @param req Request
 * @param port Studio port
 * @returns Token or undefined
 */
function cookieToken(req: IncomingMessage, port: number): string | undefined {
    const header = req.headers.cookie;

    if (!header) {
        return undefined;
    }

    for (const part of header.split(";")) {
        const [name, ...rest] = part.trim().split("=");

        if (name === cookieName(port)) {
            return rest.join("=");
        }
    }

    return undefined;
}

/**
 * Starts a studio server for a project, or reuses the healthy one in its lock.
 * A temporary request shares one studio with every other request of its chat.
 *
 * @param options Port and project context
 * @returns Server (absent when reused), URL, and whether it was reused
 */
export async function startStudio(options: {
    ctx: ProjectContext;
    port?: number;
}): Promise<{ server?: StudioServer; url: string; token: string; port: number; reused: boolean; tokenPath: string }> {
    const scope = StudioScope.of(options.ctx);
    const stateDir = scope.stateDir();
    const tokenPath = join(stateDir, "token");
    const token = Auth.loadOrCreateFile(tokenPath);
    const lock = StudioLock.read(stateDir);

    if (lock && await StudioLock.healthy(lock, token)) {
        return { url: lock.url, token, port: lock.port, reused: true, tokenPath };
    }

    const port = options.port ?? Number(process.env.ARTDIRECTOR_PORT ?? 4730);
    const server = new StudioServer(scope, port, token);
    const url = await server.listen();
    StudioLock.write(stateDir, {
        pid: process.pid,
        port: server.boundPort(),
        url,
        startedAt: new Date().toISOString()
    });
    return {
        server,
        url,
        token,
        port: server.boundPort(),
        reused: false,
        tokenPath
    };
}
