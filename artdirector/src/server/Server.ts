import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";

import { ArtErrors, Auth, Paths } from "../core";
import { UnifiedRenderer } from "../renderer";
import { ProjectContext } from "../session";
import { Http } from "./Http";
import { StudioRoutes } from "./Routes";
import { StudioLock } from "./StudioLock";

/**
 * Local interactive studio server. Bound to 127.0.0.1 with a bearer token.
 * There is no shell endpoint and no path outside the project or package library.
 */
export class StudioServer {
    private renderer = new UnifiedRenderer();
    private http?: ReturnType<typeof createServer>;
    private actualPort: number;

    /**
     * @param ctx Project context
     * @param port Listen port
     * @param token Studio token
     */
    constructor(
        private readonly ctx: ProjectContext,
        private readonly port: number,
        private readonly token: string
    ) {
        this.actualPort = port;
    }

    /**
     * Port chosen by the operating system when `port` was 0, or the bound port.
     *
     * @returns Active port
     */
    activePort(): number {
        return this.actualPort;
    }

    /**
     * Starts listening on 127.0.0.1.
     *
     * @returns Public URL including the token
     */
    async listen(): Promise<string> {
        const routes = new StudioRoutes(this.ctx, this.renderer);

        this.http = createServer((req, res) => {
            void this.dispatch(req, res, routes);
        });

        await new Promise<void>((resolve, reject) => {
            this.http?.once("error", reject);
            this.http?.listen(this.port, "127.0.0.1", () => resolve());
        });

        const address = this.http.address();

        if (address && typeof address === "object") {
            this.actualPort = address.port;
        }

        return `http://127.0.0.1:${this.actualPort}/?token=${this.token}`;
    }

    /**
     * Stops the server and renderer.
     */
    async close(): Promise<void> {
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
            .replaceAll("%%PORT%%", String(this.actualPort))
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
 * Starts a studio server for a project, reusing a healthy one when possible.
 *
 * Two chats in the same repository get different state roots and tokens. If
 * the preferred port is busy, the next free port is used.
 *
 * @param options Port, project context, and reuse toggle
 * @returns Server and URL
 */
export async function startStudio(options: {
    ctx: ProjectContext;
    port?: number;
    reuse?: boolean;
}): Promise<{ server?: StudioServer; url: string; token: string; port: number; reused: boolean }> {
    const token = Auth.loadOrCreate(options.ctx.root);
    const requested = options.port ?? Number(process.env.ARTDIRECTOR_PORT ?? 4730);

    if (options.reuse !== false) {
        const existing = StudioLock.read(options.ctx);

        if (existing && await StudioLock.alive(existing, token)) {
            return {
                url: existing.url,
                token,
                port: existing.port,
                reused: true
            };
        }

        StudioLock.clear(options.ctx);
    }

    const candidates = requested > 0
        ? [...Array.from({ length: 20 }, (_, index) => requested + index), 0]
        : [0];
    let lastError: unknown;

    for (const port of candidates) {
        const server = new StudioServer(options.ctx, port, token);

        try {
            const url = await server.listen();
            const active = server.activePort();

            StudioLock.write(options.ctx, {
                port: active,
                url,
                pid: process.pid,
                startedAt: new Date().toISOString()
            });

            return {
                server,
                url,
                token,
                port: active,
                reused: false
            };
        } catch (err) {
            lastError = err;

            if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE") {
                throw err;
            }
        }
    }

    throw lastError instanceof Error
        ? lastError
        : ArtErrors.server("Could not find a free studio port.");
}
