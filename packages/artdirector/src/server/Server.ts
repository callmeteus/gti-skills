import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";

import { ArtErrors, Auth, Paths } from "../core";
import { UnifiedRenderer } from "../renderer";
import { ProjectContext } from "../session";
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

    /**
     * @param ctx Project context
     * @param port Listen port
     * @param token Studio token
     */
    constructor(
        private readonly ctx: ProjectContext,
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
        const routes = new StudioRoutes(this.ctx, this.renderer);
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
        StudioLock.release(this.ctx.stateDir(), this.port);
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

                if (asset.length > 0 && asset.join("/")) {
                    routes.artworkAsset(id, asset.join("/"), res);
                } else {
                    routes.artwork(id, res);
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
        Auth.assert(this.ctx.root, bearer ?? cookieToken(req) ?? Http.query(url, "token"));
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
            "Set-Cookie": `artdirector_token=${this.token}; Path=/; HttpOnly; SameSite=Strict`
        });
        res.end(html);
    }
}

/**
 * Reads the studio token from the request cookie.
 *
 * @param req Request
 * @returns Token or undefined
 */
function cookieToken(req: IncomingMessage): string | undefined {
    const header = req.headers.cookie;

    if (!header) {
        return undefined;
    }

    for (const part of header.split(";")) {
        const [name, ...rest] = part.trim().split("=");

        if (name === "artdirector_token") {
            return rest.join("=");
        }
    }

    return undefined;
}

/**
 * Starts a studio server for a project, or reuses the healthy one in its lock.
 *
 * @param options Port and project context
 * @returns Server (absent when reused), URL, and whether it was reused
 */
export async function startStudio(options: {
    ctx: ProjectContext;
    port?: number;
}): Promise<{ server?: StudioServer; url: string; token: string; port: number; reused: boolean }> {
    const token = Auth.loadOrCreate(options.ctx.root);
    const stateDir = options.ctx.stateDir();
    const lock = StudioLock.read(stateDir);

    if (lock && await StudioLock.healthy(lock, token)) {
        return { url: lock.url, token, port: lock.port, reused: true };
    }

    const port = options.port ?? Number(process.env.ARTDIRECTOR_PORT ?? 4730);
    const server = new StudioServer(options.ctx, port, token);
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
        reused: false
    };
}
