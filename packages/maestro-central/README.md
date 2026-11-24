# Maestro Central

A local, real-time dashboard that shows every Maestro run on this machine: the worker fleet around Maestro, the task map, and the run feed.

## Overview

This package owns the central: a dependency-free Node server and a static browser UI. It reads the Maestro ledger in `~/.gti/maestro/` (`run.json`, `workers.jsonl`, `hosts.json`, `audit.jsonl`, `decisions.jsonl`, `orchestrators.json`, `preferences.json`, `providers.json`, `history.jsonl`), never writes to it, and pushes a new snapshot to every open tab over Server-Sent Events as soon as a ledger file changes. It is used by the [Maestro skill](../../skills/maestro/README.md); `node packages/cli build` copies the `central/` folder into the skill as `scripts/central/`.

It has four views:

- **Fleet (`/`):** an amber band at the top lists what Maestro is waiting on you for (gated actions and open decisions), and hides when there is nothing; click an item to see the run around it, recent decisions, and buttons that copy an approval or a refusal to paste in the Maestro chat. Below it, Maestro in the middle, one cluster per project, one card per worker chat with its tier, model, and current state, and a line to Maestro that moves while the worker is busy. Hover a card for a summary and click it for the worker's details: model, runtime, chat id, routing reason, attempts, files, and its own event history, which keeps updating while it is open. Below it, the run feed (it scrolls inside its card and keeps your place on updates), and the latest reviews.
- **Map (`/map`):** a dark map with one cluster per project and one dot per worker task, rings by wave, with pan, zoom, a minimap, and search. Dots have the same hover summary and click details as the fleet cards.
- **Cluster (`/cluster`):** every machine Maestro can run workers on, from `~/.gti/maestro/hosts.json` and the `host` field of the worker records: status, how it is reached (Paseo, OpenCode, or this machine), address without credentials, last contact, providers, and the workers on it. With more than one machine, a bar above Fleet and Map filters them by machine, and each worker card shows its machine.
- **Settings (`/settings`):** provider health from the catalog, then the saved preferences of this machine and of each project, with the file they come from: roles and defaults, routing rules (fallbacks, routes, avoided models), and run profiles. Read only.

It does not start, stop, or prompt workers, and it does not read worker transcripts. The server binds to `127.0.0.1` only, rejects any other `Host` header, and requires the session token on every API call. It requires Node.js 20 or newer.

## Run

From the repository root:

```bash
node packages/maestro-central/central/bin/central.mjs start --open
node packages/maestro-central/central/bin/central.mjs status --json
node packages/maestro-central/central/bin/central.mjs stop
node packages/maestro-central/central/bin/central.mjs demo --open
```

From this folder:

```bash
npm start
npm run demo
npm test
```

`start` runs the server in the background and prints the URL with its token; a second `start` reuses the running server. `demo` writes three sample runs to `~/.gti/maestro/_demo/` and replays events every few seconds, so the views move without a real run.

## Layout

| Path | Responsibility |
|------|----------------|
| `central/bin/central.mjs` | CLI: `start`, `serve`, `stop`, `status`, `demo` |
| `central/server/state.mjs` | Reads the ledger and builds the snapshot the UI renders |
| `central/server/cluster.mjs` | Builds the cluster from `hosts.json` and the workers, and strips credentials from addresses |
| `central/server/watch.mjs` | Watches the ledger with `fs.watch` plus a light poll |
| `central/server/http.mjs` | HTTP server: pages, `/api/state`, `/api/events`, token and Host checks |
| `central/server/lock.mjs` | Lock file per ledger folder, health check, opening the browser |
| `central/server/demo.mjs` | Sample ledger and the event simulator |
| `central/public/` | The browser UI: `index.html`, `css/`, and `js/` modules (`detail.mjs` holds the worker tooltip and details modal, `pending.mjs` the waiting-on-you details, `settings.mjs` the Settings tab) and `icon.svg`, the Maestro mark |
| `tests/` | `node:test` suites for the snapshot and the server |

## Scripts

| Command | Action |
|---------|--------|
| `npm start` | Start the central in the background and open the fleet view |
| `npm run serve` | Run the central in the foreground |
| `npm run demo` | Start a central on the sample ledger and open it |
| `npm test` | Run the tests |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `MAESTRO_HOME` | `GTI_HOME/maestro` | Ledger folder to read |
| `GTI_HOME` | `~/.gti` | GTI home, used when `MAESTRO_HOME` is not set |
| `MAESTRO_CENTRAL_PORT` | `4731` | Preferred port; the next free port up to 20 above it is used when it is taken |
| `MAESTRO_CENTRAL_DEBUG` | Not set | Print server decisions to stderr |

## Testing

`npm test` runs `node --test` over `tests/`. The suites cover ledger parsing (half-written JSONL lines, the last record per worker, project discovery), the snapshot version, the token and Host checks, static path containment, and a live update: a line appended to `workers.jsonl` reaches an open event stream. The root `npm test` runs them too.

See [../../README.md](../../README.md) for the full repository.
