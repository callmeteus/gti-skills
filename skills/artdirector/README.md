<div align="center">

# Art Director

> Local-first graphic design studio for coding agents

**One skill, one studio, one renderer: HTML/CSS/SVG in, PNG/JPEG/SVG/PDF out. No generative image APIs.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Node](https://img.shields.io/badge/node-%3E%3D20-blue.svg)](#requirements)
[![Harnesses](https://img.shields.io/badge/harness-Claude%20Code%20%7C%20OpenCode%20%7C%20Cursor-8A63D2.svg)](#installation)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](#requirements)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](#license)

[Quick Start](#quick-start) • [Usage](#usage) • [Reference](#reference) • [Troubleshooting](#troubleshooting)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Reference](#reference)
- [Output](#output)
- [Architecture](#architecture)
- [Security](#security)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Overview

Art Director is a local creative application for making **graphic design with code**. You describe a piece or campaign. The agent and the studio share one project: brand, brief, visual direction, variants, live comments, audit, and export.

It combines, rather than stacks, four existing ideas:

- **Impeccable-style** guided choices, live element selection, and session persistence.
- **Claude HT Skills** composition techniques for infographics, covers, social cards, slides, and editorial work.
- **Frontend Design** as a permanent quality floor (hierarchy, type, originality).
- **ClickClick** as the PNG/JPEG production renderer, with Playwright for live preview, audit, PDF, and SVG.

The language model writes HTML. The browser paints it. There is no DALL-E, Midjourney, or diffusion dependency.

```text
  "Make a launch poster for our spring sale"
                    │
                    v
  ┌─────────────────────────────────┐
  │ Agent + artdirector skill       │
  └────────────────┬────────────────┘
                   │ artdirector <command> --json
                   v
  ┌─────────────────────────────────┐      ┌──────────────────────────────┐
  │ artdirector CLI                 │ ───> │ Studio  127.0.0.1:4730       │
  │ brand · brief · variants        │      │ gallery · Live Mode · audit  │
  └────────────────┬────────────────┘      └──────────────┬───────────────┘
                   │                                      │
                   │        Live Mode events (click an    │
                   │ <───── element, request a change) ───┘
                   v
  ┌─────────────────────────────────┐
  │ UnifiedRenderer                 │
  │ ClickClick: PNG, JPEG           │
  │ Playwright: PDF, SVG, audit     │
  └─────────────────────────────────┘
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Keep brand tokens, brief, direction, variants, and history in one project | Call image-generation APIs |
| Serve a token-gated localhost studio with gallery, Live Mode, audit, and export | Run a language model. The agent answers studio events. |
| Ship templates, rendered direction previews, and technique packs per artifact type | Reconstruct SVG from HTML-only artboards |
| Install one skill into Claude Code, OpenCode, Cursor, and `.agents` layouts | Bind to any interface other than `127.0.0.1` |

## Features

- **Rendered directions:** ten visual directions shown as real previews, not adjective lists
- **Templates:** ten production templates for social, editorial, data, and promotional work
- **Live Mode:** click an element in the studio, pick a refinement or type a request, and the agent edits the source
- **Refinement commands:** `bolder`, `quieter`, `typeset`, `colorize`, `layout`, `distill`, `adapt`, `polish`
- **Quality floor:** every piece is checked against hierarchy, type, and originality rules
- **Deterministic audit:** size, overflow, fonts, and asset checks before export
- **Multi-format export:** PNG, JPEG, SVG, PDF, and HTML
- **Session isolation:** each chat gets its own temporary project unless you ask for permanent repository state
- **Agent-native CLI:** every command accepts `--json`

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| Node.js | 20+ | Runs the CLI and studio (declared in `engines`) | No |
| npm | Bundled with Node | Installs dependencies and runs scripts | No |
| [Playwright](https://github.com/microsoft/playwright) | 1.64.1 | Live preview, audit, PDF, SVG | Yes, by `npm install` |
| Chromium | Matched to Playwright | Browser that renders the artwork | No, run `npx playwright install chromium` |
| [ClickClick](https://github.com/mintyPT/clickclick) | 0.1.3 | PNG/JPEG production renderer | Yes, by `npm install` |
| Network access | At render time | Fonts load from Bunny Fonts | No |

| Platform | CLI wrapper used by the skill |
|----------|-------------------------------|
| macOS and Linux | `scripts/artdirector` |
| Windows | `scripts/artdirector.cmd` |

## Installation

Install dependencies and build the package:

```bash
cd skills/artdirector
npm install
npx playwright install chromium
npm run build
npm test
```

Install the skill into your agent. `--dest` is the root that receives `.claude/`, `.opencode/`, `.cursor/`, or `.agents/`, and defaults to the current directory.

User scope for Claude Code (macOS and Linux):

```bash
node dist/bin/artdirector.js install --agent claude --dest ~
```

User scope for Claude Code (Windows PowerShell):

```powershell
node dist\bin\artdirector.js install --agent claude --dest $env:USERPROFILE
```

Project scope for every supported agent:

```bash
node dist/bin/artdirector.js install --agent all --dest /path/to/your/project
```

| `--agent` | Installed to |
|-----------|--------------|
| `opencode` (default) | `.opencode/skills/artdirector/`, the `/artdirector` command in `.opencode/commands/`, and an `opencode.json` hint if none exists |
| `claude` | `.claude/skills/artdirector/` |
| `cursor` | `.cursor/skills/artdirector/` |
| `agents` | `.agents/skills/artdirector/` |
| `all` | Every location above |

> **Keep the package in place.** The installed skill stores a pointer to this folder in `scripts/artdirector.root`. If you move the package, run `install` again.

Unlike the copy-based skills, Art Director is not installed by copying its folder. See the [root installation table](../../README.md#installation) for how the other skills are installed.

## Quick Start

With the skill installed, start a new agent session and ask:

```text
Design a square social post announcing our spring sale, 30% off, bold and playful.
```

The agent creates a project, opens the studio, and writes variants you can compare, refine in Live Mode, and export.

## Usage

### Input

The studio asks only for missing essentials.

| Input | Required | Example |
|-------|:--------:|---------|
| Artwork request | Yes | "A launch poster for our spring sale" |
| Format | No | Square social post, story, cover, slide, banner |
| Brand | No | Name, colors, fonts, logo |
| Visual direction | No | Chosen from rendered previews in the studio |
| Audience and tone | No | "Young professionals, playful" |
| Permanent state | No | "Keep the project in this repository" |

### Examples

```text
Make an infographic about our Q3 results using the technical-infographic direction.
```

```text
Adapt the approved poster into a 9:16 story and export both as PNG.
```

```text
Start an Art Director project for this repo and keep it in Git.
```

Drive the CLI by hand: create a project and open the studio.

```bash
node dist/bin/artdirector.js init --name "Northfold Press" --json
node dist/bin/artdirector.js studio --open --json
```

The JSON `url` is `http://127.0.0.1:4730/?token=...`. The server binds to localhost only.

Run the end-to-end demonstration (three distinct HTML pieces, live edit, accept, audit, PNG/JPEG):

```bash
node dist/bin/artdirector.js demo --json
```

Outputs land in `demos/artifacts/`. Pass `--out <dir>` to write elsewhere or `--no-render` to skip image export.

## How It Works

```text
init ──> brief ──> shape ──> generate ──> studio / live ──> audit ──> export
                                 ^              │
                                 └── bolder, quieter, typeset, colorize,
                                     layout, distill, adapt, polish
```

1. Describe the artwork in natural language (the agent loads this skill).
2. Studio asks only for missing essentials.
3. Choose a **rendered** visual direction (not a paragraph of adjectives).
4. Agent writes HTML/CSS/SVG variants into `.artdirector/variants/`.
5. Gallery compares real artboards.
6. Live Mode: click an element, pick "Make bolder" / "Improve typography" / freeform.
7. Agent edits source, replies only after the file exists, preview reloads.
8. Accept or reject. History is JSONL under `.artdirector/`.
9. Audit, then export.

Template production (repeatable campaigns) and art direction (original compositions) share the same session.

## Reference

```bash
node dist/bin/artdirector.js <command> [flags]
```

Run from source without building with `npm run dev -- <command>`. Agents use the wrapper bundled in the installed skill. All commands accept `--json`.

### Project and session

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `init` | Create project files, brand tokens, and session state | `--name`, `--new`, `--permanent` |
| `brief` | Record goal, audience, format, and constraints | `--goal`, `--audience`, `--format`, `--tone` |
| `status` | Print project, session, and variants as JSON | |
| `resume` | Recover the project, session, and pending live events | |

### Design

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `shape` | Choose a visual direction from rendered alternatives | `--direction` |
| `generate` | Fill a template, or return techniques for an original composition | `--template` |
| `variants` | List variants; `variants add` registers agent-written HTML | `--file`, `--title` |
| `studio` | Start the browser studio with gallery and Live Mode | `--open`, `--port` (default `4730`) |
| `live` | Alias of `studio` focused on Live Mode | `--open` |
| `critique` | Review against the quality floor | |

### Refinement

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `craft` | Design a complete piece or campaign | |
| `polish` | Final refinement pass before export | |
| `bolder` / `quieter` | Increase or reduce visual impact | |
| `typeset` | Refine typographic hierarchy, measure, and pairing | |
| `colorize` | Explore color treatments inside the chosen direction | |
| `layout` | Adjust composition, alignment, and spatial rhythm | |
| `distill` | Remove anything that does not serve the goal | |
| `adapt` | Adapt an approved piece to another format or size | |

Refinement commands return guidance, quality rules, and techniques that the agent applies to the active variant before waiting for accept or reject in the studio.

### Output and tooling

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `audit` | Deterministic checks: size, overflow, fonts, assets | `--id` |
| `export` | Export the accepted artwork | `--id`, `--format`, `--out` |
| `install` | Copy the skill into an agent layout | `--agent`, `--dest` |
| `demo` | Run the end-to-end demonstration | `--out`, `--no-render` |
| `help` | Show the command list | |

### Library

| Visual directions (`library/directions/`) | Templates (`library/templates/`) |
|-------------------------------------------|----------------------------------|
| `bold-promotional` | `announcement` |
| `data-driven-editorial` | `carousel-slide` |
| `editorial-typographic` | `coupon` |
| `expressive-playful` | `cover` |
| `minimalist-geometric` | `data-viz` |
| `neo-brutalist` | `editorial` |
| `premium-corporate` | `infographic` |
| `swiss-inspired` | `promo-banner` |
| `technical-infographic` | `social-post` |
| `vintage-print` | `story` |

## Output

| Format | `--format` | Renderer |
|--------|-----------|----------|
| PNG | `png` | ClickClick (Playwright fallback) |
| JPEG | `jpeg` | ClickClick (Playwright fallback) |
| PDF | `pdf` | Playwright |
| SVG | `svg` | Playwright, only for compositions with an SVG root |
| HTML | `html` | Source artwork |

Art Director isolates project state per chat. The CLI reads agent session variables such as `OPENCODE_SESSION_ID` and `PASEO_AGENT_ID` and keeps each chat's project in its own folder under the OS temp directory.

| Mode | How to get it | Where state lives |
|------|---------------|-------------------|
| Temporary (default) | `init --name "<name>"` | Per-chat folder under the OS temp directory |
| Fresh context in the same chat | `init --new --name "<name>"` | New per-chat folder |
| Permanent | `init --permanent --name "<name>"` | `.artdirector/` in the current repository |

```text
.artdirector/
├── project.json                 # Brand, brief, and selected direction
├── session.json                 # Session phase and scope
├── variants.json                # Variant catalog
├── variants/<id>/artwork.html   # Agent-written artwork
├── history.jsonl                # Accept, reject, and edit history
├── events.json                  # Pending Live Mode events
├── studio.json                  # Running studio details
├── exports/                     # Rendered output
└── token                        # Studio access token (gitignored)
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the source assessment, engine split, and design rationale.

| Path | Responsibility |
|------|----------------|
| `skill/artdirector/` | Canonical agent skill (`SKILL.md`, references, CLI wrapper) |
| `skill/opencode/commands/` | OpenCode `/artdirector` slash command |
| `templates/<agent>/` | Prebuilt skill layouts per supported agent |
| `src/cli/` | Argument parsing and command dispatch |
| `src/commands/` | Command registry and metadata |
| `src/session/` | Per-chat project scope and context resolution |
| `src/server/` | Local studio HTTP API |
| `studio/` | Browser design studio and Live Mode overlay |
| `src/renderer/` | Unified ClickClick + Playwright renderer |
| `src/audit/` | Deterministic rendering checks |
| `src/design/` | Quality floor, directions, and formats |
| `src/techniques/` | HT-derived technique packs |
| `src/templates/` | Template catalog and token application |
| `src/install/` | Skill installer |
| `library/` | HTML templates and rendered direction previews |

## Security

- **Loopback only:** the studio binds to `127.0.0.1`.
- **Token-gated:** every request needs the bearer token from the studio URL, compared in constant time.
- **Path confinement:** file access is limited to the project root and the package library.
- **No shell:** the server never executes shell commands.

Do not share the studio URL; it contains the access token.

## Development

| Command | Action |
|---------|--------|
| `npm test` | Vitest unit tests in `tests/unit/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run dev -- <command>` | Run the CLI from source with `tsx` |
| `npm run studio` | Start the studio from source |
| `npm run demo` | Generate demonstration artifacts |
| `npm run build` | `tsup` + copy studio/library/skill |
| `npm start` | Run the built CLI |

## Troubleshooting

<details>
<summary><strong><code>npx artdirector</code> does not work</strong></summary>

The package is not published to npm, so `npx` searches the registry instead of using this folder. Use `node dist/bin/artdirector.js`, `npm run dev --`, or the skill wrapper script.

</details>

<details>
<summary><strong>Exports fail with a missing browser error</strong></summary>

Chromium has not been downloaded for Playwright. Run this inside `skills/artdirector`:

```bash
npx playwright install chromium
```

On Linux CI, use `npx playwright install --with-deps chromium` to install the required system libraries.

</details>

<details>
<summary><strong>Fonts look wrong when offline</strong></summary>

Fonts load from Bunny Fonts at render time. Without network access, rendering falls back to system fonts unless the artwork ships its own `@font-face` files.

</details>

<details>
<summary><strong>Live Mode requests are not applied</strong></summary>

The studio does not edit files by itself. An agent with the skill loaded must be running so it can poll events, edit the HTML, and reply.

</details>

<details>
<summary><strong>The agent cannot find the CLI after moving the folder</strong></summary>

The installed skill points to the package path recorded at install time. Run `install` again from the new location.

</details>

## Limitations

- **Agent in the loop:** Live Mode queues events on localhost. An agent must poll `/v1/events/poll`, edit HTML, and reply.
- **SVG export:** Playwright serializes an SVG root when the composition has one. HTML-only artboards export as PNG, JPEG, PDF, or HTML.
- **ClickClick coverage:** ClickClick handles PNG and JPEG. PDF, live overlay, and audit stay on Playwright.
- **Network fonts:** offline renders fall back to system fonts unless `@font-face` files are added locally.

## Acknowledgements

Art Director adapts ideas and techniques from these projects. No source or binaries are copied unless noted in [NOTICE.md](NOTICE.md).

| Project | License | Used for |
|---------|---------|----------|
| [Impeccable](https://github.com/pbakaus/impeccable) | Apache 2.0 | Interaction model and command names |
| [Claude HT Skills](https://github.com/ghoulvspol/claude-ht-skills) | MIT | Composition technique packs |
| [Frontend Design](https://github.com/thekorn/agent-skills/tree/main/skills/frontend-design) | See source | Quality floor |
| [ClickClick](https://github.com/mintyPT/clickclick) | MIT | PNG/JPEG production renderer |
| [Playwright](https://github.com/microsoft/playwright) | Apache 2.0 | Live preview, audit, PDF, SVG |
| [Lucide](https://lucide.dev/license) | ISC | Inlined icon subset |
| [Bunny Fonts](https://fonts.bunny.net/) | SIL OFL 1.1 families | Web fonts at render time |

## License

MIT. See [LICENSE](LICENSE). Third-party notices: [NOTICE.md](NOTICE.md).

Playwright 1.64.1 confirmed at [npmjs.com/package/playwright](https://www.npmjs.com/package/playwright) (2026-10-14). ClickClick 0.1.3 confirmed at [github.com/mintyPT/clickclick](https://github.com/mintyPT/clickclick).
