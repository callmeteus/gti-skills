<div align="center">

# Art Director

> Local-first graphic design studio for coding agents

**One skill, one studio, one renderer: HTML/CSS/SVG in, PNG/JPEG/SVG/PDF out. No generative image APIs.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Node](https://img.shields.io/badge/node-%3E%3D20-blue.svg)](#requirements)
[![Agents](https://img.shields.io/badge/agents-10%20supported-8A63D2.svg)](#installation)
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

Art Director is a local creative application for making **graphic design with code**. You describe a piece or campaign. The agent and the studio share one project: brand, brief, visual direction, variants, element comments, audit, and export.

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
  │ brand · brief · variants        │      │ gallery · preview · export   │
  └────────────────┬────────────────┘      └──────────────┬───────────────┘
                   │                                      │
                   │      copied prompt (click elements,  │
                   │ <───── comment, paste in chat) ──────┘
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
| Serve a token-gated localhost studio with a gallery with accept and reject, and a preview with element comments and export | Run a language model. The agent applies the prompt the user pastes. |
| Teach a professional visual bar: style guides, an effects toolkit, and photo treatments | Ship finished designs to copy. References set the level, never the layout |
| Find openly licensed photos and remove backgrounds with a local model | Generate or alter images |
| Export PNG, JPEG, PDF, HTML, and SVG for compositions with an SVG root | Reconstruct SVG from HTML-only artboards |
| Install one skill into ten coding agents with a single command | Bind to any interface other than `127.0.0.1` |

## Features

- **Rendered directions:** ten visual directions shown as real previews, not adjective lists
- **Visual style guide:** principles, composition structures, type voices, photo treatments, textures, and ornaments for professional social-media design, plus originality rules
- **Effects toolkit:** grain, paper, smoke, duotone, scrims, halftone, cutout shadows, 3D and glossy type, echo stacks, brush edges, ornaments, icons, and line fitting, included with `{{> effect}}`
- **Photo pipeline:** search CC0 photos with credits and cut out subjects locally; local images work in the studio, the audit, and every export
- **Templates for repeatable formats:** infographic, data visual, and carousel slide, filled from the brief or a tokens file
- **Gallery:** every variant at its real ratio, with Accept and Reject; rejected variants move to a Rejected area and can be restored
- **Preview:** the full-size artwork with PNG, JPEG, or PDF export and a progress indicator; audit findings stay with the agent
- **Studio in three languages:** English, Portuguese, and Spanish; the agent passes the language of your prompt with `--lang`, and a switcher in the studio overrides it
- **Element comments:** click elements in the preview, comment on each, and copy one prompt for any agent, with no polling or trigger needed
- **Refinement commands:** `bolder`, `quieter`, `typeset`, `colorize`, `layout`, `distill`, `adapt`, `polish`
- **Quality floor:** every piece is checked against hierarchy, type, and originality rules
- **Render check:** each variant is audited and rendered once before hand-over, and construction defects are fixed in one pass
- **Deterministic audit:** size, overflow, fonts, assets, text at or past the edge, story chrome, and blurred text
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
| Python | 3.8+ | Optional: photo search and background removal scripts | No |
| [rembg](https://github.com/danielgatis/rembg) | Latest | Optional: local background removal | Yes, with `remove_background.py --install` |

| Platform | CLI wrapper used by the skill |
|----------|-------------------------------|
| macOS and Linux | `scripts/artdirector` |
| Windows | `scripts/artdirector.cmd` |

## Installation

Build the engine once. The skill drives the `packages/artdirector` package, so it must be built on the machine that runs the agent:

```bash
cd packages/artdirector
npm install
npx playwright install chromium
npm run build
cd ../..
```

Then install the skill into any supported agent from the repository root:

```bash
node packages/cli install --harness claude --skill artdirector
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--scope user` to install for every project, `--dest <dir>` to choose the project folder, and `--dry-run` to preview.

| Agent | Id | Project folder | User folder |
|-------|----|----------------|-------------|
| Cursor / Cursor CLI | `cursor` | `.cursor/skills` | `~/.cursor/skills` |
| Claude / Claude Code | `claude` | `.claude/skills` | `~/.claude/skills` |
| Antigravity | `antigravity` | `.agents/skills` | `~/.gemini/antigravity/skills` |
| OpenCode | `opencode` | `.opencode/skills` | `~/.config/opencode/skills` |
| Cline | `cline` | `.cline/skills` | `~/.cline/skills` |
| Kilo Code | `kilo` | `.kilocode/skills` | `~/.kilocode/skills` |
| Kiro | `kiro` | `.kiro/skills` | `~/.kiro/skills` |
| Codex | `codex` | `.agents/skills` | `~/.agents/skills` |
| GitHub Copilot | `copilot` | `.github/skills` | `~/.copilot/skills` |
| Muse Code | `muse` | `.agents/skills` | `~/.agents/skills` |

For OpenCode at project scope the installer also adds the `/artdirector` command to `.opencode/commands/`.

> **Keep the package in place.** The installer writes the absolute path of `packages/artdirector` to `scripts/artdirector.root` inside the installed skill. If you move the repository, run `install` again, or set `ARTDIRECTOR_HOME` to the package folder.

To copy by hand instead, put the `skills/artdirector` folder in your agent's folder (for example `cp -r skills/artdirector .claude/skills/`) and set `ARTDIRECTOR_HOME` to the absolute path of `packages/artdirector`. Each agent has a short guide in `skills/artdirector/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

## Quick Start

With the skill installed, start a new agent session and ask:

```text
Design a square social post announcing our spring sale, 30% off, bold and playful.
```

The agent creates a project, opens the studio, and writes variants you can compare, comment on in Preview, and export.

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

Drive the CLI by hand from the repository root: create a project and open the studio.

```bash
node packages/artdirector/dist/bin/artdirector.js init --name "Northfold Press" --json
node packages/artdirector/dist/bin/artdirector.js studio --open --json
```

The JSON `url` is `http://127.0.0.1:4730/?token=...`. The server binds to localhost only.

Run the end-to-end demonstration (three distinct HTML pieces, live edit, accept, audit, PNG/JPEG):

```bash
node packages/artdirector/dist/bin/artdirector.js demo --json
```

Outputs land in `packages/artdirector/demos/artifacts/`. Pass `--out <dir>` to write elsewhere or `--no-render` to skip image export.

## How It Works

```text
init ──> brief ──> shape ──> generate ──> render check ──> studio / live ──> audit ──> export
                                 ^              │
                                 └── bolder, quieter, typeset, colorize,
                                     layout, distill, adapt, polish
```

1. Describe the artwork in natural language (the agent loads this skill).
2. Studio asks only for missing essentials.
3. Choose a **rendered** visual direction (not a paragraph of adjectives).
4. Agent writes HTML/CSS/SVG variants into `.artdirector/variants/`, audits and renders each one once, and fixes construction defects.
5. Gallery compares real artboards.
6. Preview: click elements, write comments, and copy the prompt into the chat.
7. Agent edits the file and runs the render check once; click Reload in Preview.
8. Accept the variants you keep, reject the rest (restorable), and export PNG, JPEG, or PDF from Preview.

Template production (repeatable campaigns) and art direction (original compositions) share the same session.

## Reference

```bash
node packages/artdirector/dist/bin/artdirector.js <command> [flags]
```

Run from source without building with `npm run dev -- <command>` inside `packages/artdirector`. Agents use the wrapper bundled in the installed skill (`scripts/artdirector` on macOS and Linux, `scripts/artdirector.cmd` on Windows). All commands accept `--json`.

### Project and session

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `init` | Create project files, brand tokens, and session state | `--name`, `--new`, `--permanent`, `--lang` |
| `brief` | Record goal, audience, format, and constraints | `--goal`, `--audience`, `--format`, `--tone` |
| `status` | Print project, session, and variants as JSON | |
| `resume` | Recover the project, session, and pending live events | |

### Design

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `shape` | Choose a visual direction from rendered alternatives | `--direction` |
| `generate` | Fill a template for a repeatable format, or return techniques, templates, and effects for original work | `--template`, `--tokens`, `--id` |
| `variants` | List variants; `variants add` registers agent-written HTML | `--file`, `--title` |
| `studio` | Start the browser studio with Gallery and Preview | `--open`, `--port` (default `4730`) |
| `live` | Alias of `studio` | `--open` |
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
| `audit` | Deterministic checks: size, overflow, fonts, assets, edges, story chrome, blurred text | `--id` |
| `export` | Export the accepted artwork | `--id`, `--format`, `--out` |
| `effects` | List the effects toolkit, or print one effect with its usage notes | `--id` |
| `demo` | Run the pipeline check (fills the library templates, no language model) | `--out`, `--no-render` |
| `help` | Show the command list | |

### Photo scripts

Run with `python3` on macOS and Linux, or `python` on Windows.

```bash
python3 skills/artdirector/scripts/photos/find_photos.py "red sneakers" --license cc0 --limit 12 --download ./photos
```

| Argument | Default | Description |
|----------|---------|-------------|
| `query` | Required | What the photo should show, in English for best results |
| `--license` | `cc0` | Comma separated: `cc0`, `pdm`, `by`, `by-sa` |
| `--limit` | `12` | Number of results, 1 to 50 |
| `--aspect` | Any | `tall`, `wide`, or `square` |
| `--source` | Any | One provider, for example `stocksnap` or `wikimedia` |
| `--download` | Off | Folder that receives the images and `credits.json` |

Prints the candidates as JSON (title, creator, license, source page, image URL, size) from [Openverse](https://openverse.org/). Exit code `2` means nothing matched.

```bash
python3 skills/artdirector/scripts/photos/remove_background.py ./photos/01-red-sneakers.jpg --install
```

| Argument | Default | Description |
|----------|---------|-------------|
| `images` | Required | One or more image files |
| `--out`, `-o` | Next to each source | Folder for the cutouts |
| `--model`, `-m` | `isnet-general-use` | `isnet-general-use`, `u2net`, `u2net_human_seg`, `birefnet-portrait`, `birefnet-general` |
| `--install` | Off | Install `rembg[cpu]` first when it is missing |
| `--no-trim` | Off | Keep the original canvas instead of trimming to the subject |

Writes `<name>-cutout.png` and prints the files as JSON. The first run downloads the model (about 170 MB for the default, about 1 GB for `birefnet-portrait`).

### Library

| Library folder | Contents |
|----------------|----------|
| `library/directions/` | Ten rendered direction previews: `bold-promotional`, `data-driven-editorial`, `editorial-typographic`, `expressive-playful`, `minimalist-geometric`, `neo-brutalist`, `premium-corporate`, `swiss-inspired`, `technical-infographic`, `vintage-print` |
| `library/templates/` | Repeatable formats: `infographic`, `data-viz`, `carousel-slide` |
| `library/effects/` | Effects toolkit: `artboard`, `grain`, `paper`, `smoke`, `duotone`, `scrim`, `halftone`, `cutout`, `type-fx`, `ornaments`, `svg-defs`, `fit-text` |

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

See [ARCHITECTURE.md](../../packages/artdirector/ARCHITECTURE.md) for the source assessment, engine split, and design rationale, and the [package README](../../packages/artdirector/README.md) for the source layout.

| Path | Responsibility |
|------|----------------|
| `skills/artdirector/SKILL.md` | Agent instructions |
| `skills/artdirector/references/` | `style/` visual bar, illustration, and originality, `effects/` toolkit catalog, `workflow/` commands and studio comments, `design/` formats, templates, techniques, quality, and `output/` audit and render check |
| `skills/artdirector/scripts/` | CLI wrapper that finds and runs the package; `photos/` search and background removal |
| `skills/artdirector/harnesses/` | One guide per agent, and project files such as the OpenCode `/artdirector` command |
| `packages/artdirector/src/` | CLI, session, studio server, renderer, audit, design rules, and templates |
| `packages/artdirector/studio/` | Browser design studio and element-picking overlay |
| `packages/artdirector/library/` | Effects toolkit, templates for repeatable formats, and rendered direction previews |

## Security

- **Loopback only:** the studio binds to `127.0.0.1`.
- **Token-gated:** every request needs the bearer token from the studio URL, compared in constant time.
- **Path confinement:** file access is limited to the project root and the package library.
- **No shell:** the server never executes shell commands.

Do not share the studio URL; it contains the access token.

## Development

Run these inside `packages/artdirector`.

| Command | Action |
|---------|--------|
| `npm test` | Vitest unit tests in `tests/unit/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run dev -- <command>` | Run the CLI from source with `tsx` |
| `npm run studio` | Start the studio from source |
| `npm run demo` | Generate demonstration artifacts |
| `npm run build` | `tsup` + copy studio and library |
| `npm start` | Run the built CLI |

After editing anything in `skills/artdirector`, run `node packages/cli build` from the repository root so the generated guides stay current.

## Troubleshooting

<details>
<summary><strong><code>npx artdirector</code> does not work</strong></summary>

The package is not published to npm, so `npx` searches the registry instead of using this folder. Use `node packages/artdirector/dist/bin/artdirector.js`, `npm run dev --` inside `packages/artdirector`, or the skill wrapper script.

</details>

<details>
<summary><strong>Exports fail with a missing browser error</strong></summary>

Chromium has not been downloaded for Playwright. Run this inside `packages/artdirector`:

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
<summary><strong>Comments in the studio are not applied</strong></summary>

The studio does not edit files by itself. Click Copy prompt in Preview, paste the prompt into the agent chat, then click Reload after the agent saves the file.

</details>

<details>
<summary><strong>The agent cannot find the CLI after moving the folder</strong></summary>

The installed skill points to the package path recorded at install time. Run `node packages/cli install --harness <id> --skill artdirector` again from the new location, or set `ARTDIRECTOR_HOME` to the absolute path of `packages/artdirector`.

</details>

<details>
<summary><strong>The skill says the CLI was not found</strong></summary>

The package has not been built on this machine. Run `npm install` and `npm run build` inside `packages/artdirector`. Without a build, the wrapper falls back to running the TypeScript source, which needs `npm install` only.

</details>

<details>
<summary><strong>Photos do not appear in the studio or the export</strong></summary>

The image path does not resolve from the artwork folder. Use a path relative to the artwork HTML (for example `assets/portrait.png`), or register the HTML with `variants add`, which copies images referenced by absolute path or `file://` URL into `assets/`.

</details>

<details>
<summary><strong><code>remove_background.py</code> says rembg is not installed</strong></summary>

The optional background removal library is missing. Rerun with `--install`, or install it yourself:

```bash
python3 -m pip install "rembg[cpu]"
```

</details>

## Limitations

- **Agent in the loop:** the studio does not edit files. Comments reach the agent as a prompt the user pastes into the chat.
- **SVG export:** Playwright serializes an SVG root when the composition has one. HTML-only artboards export as PNG, JPEG, PDF, or HTML.
- **ClickClick coverage:** ClickClick handles PNG and JPEG. PDF, live overlay, and audit stay on Playwright.
- **Network fonts:** offline renders fall back to system fonts unless `@font-face` files are added locally.
- **Photo resolution:** cutouts and photos smaller than the area they fill look soft; prefer sources at least as large as the board.
- **Studio reuse:** sharing one running studio between projects (`StudioLock`) is not finished in the package yet; see the known issue in the [package README](../../packages/artdirector/README.md#testing).

## Acknowledgements

Art Director adapts ideas and techniques from these projects. No source or binaries are copied unless noted in [NOTICE.md](../../packages/artdirector/NOTICE.md).

| Project | License | Used for |
|---------|---------|----------|
| [Impeccable](https://github.com/pbakaus/impeccable) | Apache 2.0 | Interaction model and command names |
| [Claude HT Skills](https://github.com/ghoulvspol/claude-ht-skills) | MIT | Composition technique packs |
| [Frontend Design](https://github.com/thekorn/agent-skills/tree/main/skills/frontend-design) | See source | Quality floor |
| [ClickClick](https://github.com/mintyPT/clickclick) | MIT | PNG/JPEG production renderer |
| [Playwright](https://github.com/microsoft/playwright) | Apache 2.0 | Live preview, audit, PDF, SVG |
| [Lucide](https://lucide.dev/license) | ISC | Inlined icon subset |
| [Bunny Fonts](https://fonts.bunny.net/) | SIL OFL 1.1 families | Web fonts at render time |
| [rembg](https://github.com/danielgatis/rembg) | MIT | Optional local background removal, installed on request |
| [Openverse](https://openverse.org/) | API terms, per-photo licenses | Openly licensed photo search |

## License

MIT. See [LICENSE](../../packages/artdirector/LICENSE). Third-party notices: [NOTICE.md](../../packages/artdirector/NOTICE.md).

Playwright 1.64.1 confirmed at [npmjs.com/package/playwright](https://www.npmjs.com/package/playwright) (2026-10-14). ClickClick 0.1.3 confirmed at [github.com/mintyPT/clickclick](https://github.com/mintyPT/clickclick).
