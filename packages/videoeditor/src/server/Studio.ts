import { createReadStream, existsSync, readFileSync, readdirSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { networkInterfaces } from "node:os";
import { randomBytes } from "node:crypto";
import { basename, extname, join } from "node:path";

import { buildReviewData } from "../features";
import { renderReviewHtml } from "../review";
import { VideoErrors } from "../core/Errors";
import { Json } from "../core/Json";
import { Paths } from "../core/Paths";
import type { ProjectScope } from "../core/Types";

/** Live server details persisted next to the project. */
export interface StudioInfo {
    port: number;
    token: string;
    bind: string;
    startedAt: string;
}

/** What `studio --json` reports. */
export interface StudioResult {
    url: string;
    tailscaleUrls: string[];
    port: number;
    bind: string;
    reused: boolean;
    tokenPath: string;
    note: string;
}

/** Options for starting the review studio. */
export interface StudioOptions {
    scope: ProjectScope;
    port?: number;
    /** Defaults to 127.0.0.1. Use 0.0.0.0 only when LAN or Tailscale access is wanted. */
    bind?: string;
}

const servers = new Map<number, Server>();

const ContentTypes: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".gif": "image/gif",
    ".json": "application/json"
};

/** Tailscale addresses this machine has, if any. */
export function tailscaleUrls(port: number, token: string): string[] {
    const hosts = new Set<string>();
    const interfaces = networkInterfaces();

    for (const [name, addresses] of Object.entries(interfaces)) {
        for (const address of addresses ?? []) {
            if (address.family !== "IPv4" || address.internal) {
                continue;
            }
            const isTailscaleName = /tailscale/i.test(name);
            const isTailscaleAddress = /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(address.address);

            if (isTailscaleName || isTailscaleAddress) {
                hosts.add(address.address);
            }
        }
    }

    return [...hosts].map((host) => `http://${host}:${port}/?token=${encodeURIComponent(token)}`);
}

/** Rendered file names in the exports folder. */
function renders(scope: ProjectScope): string[] {
    if (!existsSync(scope.exportsDir)) {
        return [];
    }

    return readdirSync(scope.exportsDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && [".mp4", ".webm", ".mov", ".gif"].includes(extname(entry.name).toLowerCase()))
        .map((entry) => entry.name)
        .sort();
}

/** The same review page as `review --out`, with render paths served by this token-gated server. */
function page(scope: ProjectScope, token: string): string {
    const query = `?token=${encodeURIComponent(token)}`;
    const data = buildReviewData(scope);
    let html = renderReviewHtml(data);

    for (const render of data.renders) {
        const url = `/media/${encodeURIComponent(basename(render))}${query}`;
        const posix = Paths.posix(render);
        const fileUrl = /^[A-Za-z]:\//.test(posix) ? `file:///${posix}` : posix;
        html = html.split(fileUrl).join(url).split(posix).join(url).split(render).join(url);
    }

    const nav = `<nav style="margin:10px 0 18px;display:flex;gap:16px"><a href="/api/status${query}">Status JSON</a><a href="/api/spec${query}">Timeline JSON</a></nav>`;
    return html.replace("<body>", `<body>${nav}`);
}

/**
 * Starts or reuses the token-gated review studio.
 *
 * It binds to `127.0.0.1` by default. LAN or Tailscale exposure requires an
 * explicit `--bind 0.0.0.0`; the result then lists Tailscale URLs when available.
 *
 * @param options Studio options
 * @returns URLs and port the agent can hand over
 */
export async function startStudio(options: StudioOptions): Promise<StudioResult> {
    const { scope } = options;
    const infoPath = join(scope.stateDir, "studio.json");
    const existing = Json.maybe<StudioInfo>(infoPath);
    const bind = options.bind ?? "127.0.0.1";

    if (existing && servers.has(existing.port)) {
        return describe(existing, scope, false);
    }

    if (existing) {
        try {
            const response = await fetch(`http://127.0.0.1:${existing.port}/api/status?token=${encodeURIComponent(existing.token)}`, {
                signal: AbortSignal.timeout(1000)
            });

            if (response.ok) {
                return describe(existing, scope, false);
            }
        } catch {
            // Stale info file: start a fresh server below.
        }
    }

    const token = existing?.token ?? randomBytes(18).toString("base64url");
    let preferred = options.port ?? Number(process.env.VIDEOEDITOR_PORT ?? 4870);
    if (!Number.isFinite(preferred) || preferred < 0) {
        preferred = 4870;
    }

    const server = createServer((req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const supplied = req.headers["x-videoeditor-token"];
        const authorized = url.searchParams.get("token") === token || supplied === token;

        if (!authorized) {
            res.writeHead(401, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "AUTH", summary: "A valid token is required." }));
            return;
        }

        const pathname = url.pathname;

        if (pathname === "/") {
            res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
            res.end(page(scope, token));
            return;
        }

        if (pathname === "/api/status") {
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({
                ok: true,
                request: scope.request,
                storage: scope.storage,
                renders: renders(scope),
                scope
            }, null, 2));
            return;
        }

        if (pathname === "/api/spec") {
            res.writeHead(200, { "content-type": "application/json" });
            res.end(existsSync(scope.specPath) ? readFileSync(scope.specPath, "utf8") : "{}");
            return;
        }

        if (pathname.startsWith("/media/")) {
            const name = decodeURIComponent(pathname.slice("/media/".length));
            const file = Paths.confine(scope.exportsDir, join(scope.exportsDir, name));

            if (!existsSync(file)) {
                res.writeHead(404, { "content-type": "application/json" });
                res.end(JSON.stringify({ ok: false, error: "NOT_FOUND" }));
                return;
            }

            res.writeHead(200, {
                "content-type": ContentTypes[extname(file).toLowerCase()] ?? "application/octet-stream"
            });
            createReadStream(file).pipe(res);
            return;
        }

        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "NOT_FOUND" }));
    });

    const port = await listen(server, preferred, bind);
    const info: StudioInfo = { port, token, bind, startedAt: new Date().toISOString() };

    servers.set(port, server);
    Json.write(infoPath, info);

    return describe(info, scope, true);
}

/** Binds a server, trying consecutive ports when the preferred one is busy. */
function listen(server: Server, preferred: number, bind: string): Promise<number> {
    return new Promise((resolve, reject) => {
        let attempt = preferred;

        const tryPort = (): void => {
            const onError = (error: NodeJS.ErrnoException): void => {
                if (error.code === "EADDRINUSE" && attempt < preferred + 20) {
                    attempt += 1;
                    server.removeListener("error", onError);
                    tryPort();
                    return;
                }
                reject(VideoErrors.server(`Could not bind the studio: ${error.message}`));
            };
            server.once("error", onError);
            server.listen(attempt, bind, () => {
                server.removeListener("error", onError);
                const address = server.address();
                resolve(typeof address === "object" && address ? address.port : attempt);
            });
        };

        tryPort();
    });
}

/** Turns persisted info into the JSON result. */
function describe(info: StudioInfo, scope: ProjectScope, started: boolean): StudioResult {
    const tailscale = tailscaleUrls(info.port, info.token);

    return {
        url: `http://localhost:${info.port}/?token=${encodeURIComponent(info.token)}`,
        tailscaleUrls: tailscale,
        port: info.port,
        bind: info.bind,
        reused: !started,
        tokenPath: join(scope.stateDir, "studio.json"),
        note: info.bind === "127.0.0.1"
            ? "Local only. Pass --bind 0.0.0.0 explicitly to expose it on the LAN or Tailscale."
            : tailscale.length > 0
                ? "Explicitly exposed and reachable over Tailscale at the listed addresses."
                : `Explicitly bound to ${info.bind}; open it with this machine's Tailscale IP and port ${info.port}.`
    };
}

/** Stops a studio started in this process. */
export function stopStudio(port?: number): number {
    if (port !== undefined) {
        const server = servers.get(port);

        if (server) {
            server.close();
            servers.delete(port);
            return 1;
        }
        return 0;
    }

    let closed = 0;

    for (const [id, server] of servers) {
        server.close();
        servers.delete(id);
        closed += 1;
    }
    return closed;
}
