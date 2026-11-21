# videoeditor

Local-first video editing engine: measured ffmpeg tools, a deterministic timeline renderer, caption burning, platform exports, seekable HTML motion graphics, and a static review page.

## Overview

This package owns the TypeScript source of the `videoeditor` CLI. It has two layers. The timeline layer turns a JSON document into one inspectable ffmpeg command for composed edits. The measured tool layer exposes one command per operation: `doctor`, `tools`, `cut`, `trim-silence`, `speed`, `reframe`, `loudness`, `export`, `waveform`, `frame`, `captions`, and `review`. Every edit tool prints a `checks` array with measured values and records it in the request so the review page can show the edit-then-measure history.

Inputs are validated before any external tool runs: unreadable, empty, unsupported, and wrong-kind files are refused with a reason. The motion layer writes HTML compositions that expose `window.__seek(t)`, seeks them frame by frame in headless Chromium, and encodes MP4 or alpha WebM with ffmpeg. The review server binds to `127.0.0.1` by default; exposing it on the LAN or Tailscale requires an explicit `--bind 0.0.0.0`. Credits for ideas ported from other projects are in [NOTICE.md](NOTICE.md).

It does not contain the agent instructions or the install logic. The skill that agents load is [Video Editor](../../skills/video-editor/README.md) in `skills/video-editor`; install it with `node packages/cli install`. Design decisions are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Run

From the repository root:

```bash
cd packages/videoeditor
npm install
npm run build
node dist/bin/videoeditor.js doctor --json
node dist/bin/videoeditor.js tools --json
```

Run from source without building:

```bash
npm run dev -- help
```

A sample timeline and its planned command can be generated without ffmpeg installed:

```bash
node dist/bin/videoeditor.js demo --out ./demo-artifacts --json
```

A motion composition needs Playwright and Chromium (`npm install && npx playwright install chromium`):

```bash
node dist/bin/videoeditor.js motion styles --json
node dist/bin/videoeditor.js motion new --template lower-third --text "Ada Lovelace" --preset reels --json
node dist/bin/videoeditor.js motion render --preset reels --duration 1 --json
```

## Layout

| Path | Responsibility |
|------|----------------|
| `src/cli/` | Flag parsing, help text, and command dispatch with JSON output |
| `src/core/` | Typed errors, measured checks, GTI home paths, ids, JSON files, path confinement, and shared types |
| `src/input/` | Pre-flight validation that refuses bad files before ffmpeg runs |
| `src/motion/` | Motion.md guides, brand kit, templates, Chromium renderer, and reference analyzer |
| `src/ffmpeg/` | ffprobe capabilities, the pure timeline planner, measurement helpers, and the process runner |
| `src/captions/` | SRT/VTT parsing, local transcriber detection, ASS generation, and caption burning |
| `src/features/` | The measured edit tools and the review data collector |
| `src/presets/` | Platform export presets |
| `src/review/` | Static HTML review page with phone frame, safe area, and timeline notes |
| `src/server/` | Local, token-gated review studio |
| `src/tools/` | Machine-readable tool contract with stability levels |
| `src/session/` | Per-chat request state and timeline creation, validation, and edits |
| `src/bin/` | CLI entry point |
| `src/index.ts` | Public library exports |
| `tests/unit/` | Vitest suites for pure logic, state, paths, and studio |
| `tests/integration/` | Real ffmpeg tests for cut, reframe, loudness, export, captions, and Chromium motion rendering |

## Scripts

| Command | Action |
|---------|--------|
| `npm run build` | Bundle the library and CLI with `tsup` and emit declarations |
| `npm run dev -- <command>` | Run the CLI from source with `tsx` |
| `npm start` | Run the built CLI |
| `npm test` | Vitest unit and integration tests; ffmpeg tests skip with a message when ffmpeg is absent |
| `npm run typecheck` | `tsc --noEmit` |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `GTI_HOME` | `~/.gti` | Root of everything GTI skills generate; Video Editor uses `<GTI_HOME>/video-editor` |
| `VIDEOEDITOR_SESSION` | unset | Chat session id when the agent does not expose one |
| `VIDEOEDITOR_STORAGE` | unset | Set to `repository` to make requests permanent |
| `VIDEOEDITOR_PORT` | `4870` | Preferred review studio port |
| `VIDEOEDITOR_JSON` | unset | Set to `1` to make every command print JSON |
| `VIDEOEDITOR_BIN` | unset | Path of a built CLI the skill wrapper should run |
| `VIDEOEDITOR_HOME` | unset | Package folder the skill wrapper should use |

## Testing

```bash
npm test
```

Unit tests need no external tools. Integration tests generate a short clip with ffmpeg's lavfi sources and verify `cut`, `reframe`, `loudness`, `export`, captions import and burn from an SRT fixture, and input refusal. The motion integration test composes a template, renders one second at 30 fps in Chromium, and asserts the ffprobe size, fps, and frame count. They skip with a printed message when ffmpeg or Chromium is not available.

See [../../README.md](../../README.md) for the full repository.
