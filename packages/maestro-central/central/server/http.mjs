// Local HTTP server for the Maestro central: static UI, a JSON snapshot, and a Server-Sent Events stream.
// Binds to 127.0.0.1 only, checks the Host header, and requires the session token on every API call.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import { buildSnapshot } from "./state.mjs";
import { watchLedger } from "./watch.mjs";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const PAGES = new Set(["/", "/live", "/map", "/settings", "/cluster"]);
const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
};
const HEARTBEAT_MS = 15000;

function tokenMatches(expected, given) {
    if (typeof given !== "string" || given.length !== expected.length) {
        return false;
    }
    return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

function hostAllowed(host, port) {
    return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

function send(res, status, body, type = "application/json; charset=utf-8") {
    res.writeHead(status, {
        "content-type": type,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
    });
    res.end(body);
}

async function serveStatic(res, pathname) {
    const file = PAGES.has(pathname) ? "index.html" : pathname.slice(1);
    const full = normalize(join(PUBLIC_DIR, file));
    if (!full.startsWith(PUBLIC_DIR + sep)) {
        send(res, 404, "not found", "text/plain; charset=utf-8");
        return;
    }
    try {
        const body = await readFile(full);
        send(res, 200, body, TYPES[extname(full)] || "application/octet-stream");
    } catch {
        send(res, 404, "not found", "text/plain; charset=utf-8");
    }
}

function listen(server, port, host) {
    return new Promise((resolve, reject) => {
        const onError = (error) => {
            server.off("listening", onListening);
            reject(error);
        };
        const onListening = () => {
            server.off("error", onError);
            resolve(server.address().port);
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, host);
    });
}

/**
 * Starts the central server.
 * @param {{ root: string, token: string, port?: number, tries?: number, pollMs?: number, log?: (line: string) => void }} options
 * @returns {Promise<{ port: number, url: string, close: () => Promise<void>, refresh: () => void }>}
 */
export async function startCentral(options) {
    const { root, token } = options;
    const host = "127.0.0.1";
    const log = options.log || (() => {});
    const clients = new Set();
    let snapshot = buildSnapshot(root);
    let port = 0;

    const server = createServer(async (req, res) => {
        const url = new URL(req.url || "/", "http://127.0.0.1");
        if (!hostAllowed(req.headers.host, port)) {
            log(`[central] denied host ${req.headers.host}`);
            send(res, 403, JSON.stringify({ error: "host not allowed" }));
            return;
        }
        if (!url.pathname.startsWith("/api/")) {
            await serveStatic(res, url.pathname);
            return;
        }
        if (!tokenMatches(token, url.searchParams.get("token"))) {
            send(res, 401, JSON.stringify({ error: "token required" }));
            return;
        }
        if (url.pathname === "/api/health") {
            send(res, 200, JSON.stringify({ ok: true, root, version: snapshot.version }));
            return;
        }
        if (url.pathname === "/api/state") {
            send(res, 200, JSON.stringify(snapshot));
            return;
        }
        if (url.pathname === "/api/events") {
            res.writeHead(200, {
                "content-type": "text/event-stream; charset=utf-8",
                "cache-control": "no-store",
                connection: "keep-alive",
            });
            res.write(`retry: 2000\nevent: state\ndata: ${JSON.stringify(snapshot)}\n\n`);
            clients.add(res);
            req.on("close", () => clients.delete(res));
            return;
        }
        send(res, 404, JSON.stringify({ error: "not found" }));
    });

    const refresh = () => {
        const next = buildSnapshot(root);
        if (next.version === snapshot.version) {
            return;
        }
        snapshot = next;
        log(`[central] ledger changed, version ${snapshot.version}, ${clients.size} viewer(s)`);
        const frame = `event: state\ndata: ${JSON.stringify(snapshot)}\n\n`;
        for (const client of clients) {
            client.write(frame);
        }
    };
    const stopWatch = watchLedger(root, refresh, { pollMs: options.pollMs });
    const heartbeat = setInterval(() => {
        for (const client of clients) {
            client.write(`: ping ${Date.now()}\n\n`);
        }
    }, HEARTBEAT_MS);
    heartbeat.unref?.();

    const first = options.port ?? 4731;
    const tries = first === 0 ? 1 : options.tries ?? 20;
    let lastError = null;
    for (let attempt = 0; attempt < tries; attempt += 1) {
        try {
            port = await listen(server, first === 0 ? 0 : first + attempt, host);
            lastError = null;
            break;
        } catch (error) {
            lastError = error;
            if (error.code !== "EADDRINUSE") {
                break;
            }
        }
    }
    if (lastError) {
        stopWatch();
        clearInterval(heartbeat);
        throw lastError;
    }
    log(`[central] listening on ${host}:${port}, root ${root}`);

    return {
        port,
        url: `http://${host}:${port}`,
        refresh,
        close: () =>
            new Promise((resolve) => {
                stopWatch();
                clearInterval(heartbeat);
                for (const client of clients) {
                    client.end();
                }
                server.close(() => resolve());
            }),
    };
}
