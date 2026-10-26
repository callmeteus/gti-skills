# artdirector

Local-first design engine: studio server, renderer, templates, audit, and the CLI behind the Art Director skill.

## Overview

This package owns the TypeScript source of the `artdirector` CLI, the browser studio, the effects toolkit, the template and direction library, and the renderer that exports PNG, JPEG, SVG, and PDF. Artwork may include effects with `{{> effect}}` and reference local images by relative path; the studio, the audit, and the renderer expand and resolve both. It binds only to `127.0.0.1` and never calls an image-generation API.

It does not contain the agent instructions or the install logic. The skill that agents load is [Art Director](../../skills/artdirector/README.md) in `skills/artdirector`; install it with `node packages/cli install`. Design decisions are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Run

From the repository root:

```bash
cd packages/artdirector
npm install
npx playwright install chromium
npm run build
node dist/bin/artdirector.js help
```

Run from source without building:

```bash
npm run dev -- help
```

## Layout

| Path | Responsibility |
|------|----------------|
| `src/cli/` | Argument parsing and command dispatch |
| `src/commands/` | Command registry and metadata |
| `src/session/` | Per-chat project scope and context resolution |
| `src/server/` | Local studio HTTP API and the per-project studio lock |
| `src/renderer/` | ClickClick and Playwright renderer |
| `src/audit/` | Deterministic rendering checks |
| `src/design/` | Quality floor, directions, and formats |
| `src/techniques/` | Composition technique packs |
| `src/templates/` | Template catalog, token defaults, image copying, and the effects loader |
| `src/demo/` | Scripted pipeline check (init to export without a language model) |
| `studio/` | Browser studio and Live Mode overlay |
| `library/effects/` | Effects toolkit included with `{{> effect}}`: textures, photo treatments, type effects, ornaments, SVG filters and icons |
| `library/templates/` | Templates for repeatable formats |
| `library/directions/` | Rendered direction previews |
| `tests/unit/` | Vitest suites |

## Scripts

| Command | Action |
|---------|--------|
| `npm run build` | `tsup` plus copy studio and library into `dist/` |
| `npm run dev -- <command>` | Run the CLI from source with `tsx` |
| `npm start` | Run the built CLI |
| `npm run studio` | Start the studio from source |
| `npm run demo` | Run the pipeline check into `demos/artifacts/` |
| `npm test` | Vitest unit tests |
| `npm run typecheck` | `tsc --noEmit` |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `ARTDIRECTOR_PORT` | `4730` | Preferred studio port |
| `ARTDIRECTOR_JSON` | unset | Set to `1` to make every command print JSON |
| `ARTDIRECTOR_STORAGE` | unset | Set to `repository` to keep projects in the repository instead of a temporary folder |
| `ARTDIRECTOR_BIN` | unset | Path of a built CLI the skill wrapper should run |
| `ARTDIRECTOR_HOME` | unset | Package folder the skill wrapper should use |
| `ARTDIRECTOR_STATE_HOME` | `<temp>/artdirector` | Folder that holds temporary sessions |

## Testing

```bash
npm test
```

The suites cover the core, formats, templates, session scope, the studio server (including port fallback and lock reuse), and the skill wrapper and demo workflow.

See [../../README.md](../../README.md) for the full repository.
