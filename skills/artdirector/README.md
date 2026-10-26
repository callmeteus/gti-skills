<div align="center">

# ArtDirector

> Local-first graphic design studio for coding agents

**One skill, one studio, one renderer: HTML/CSS/SVG in, PNG/JPEG/SVG/PDF out. No generative image APIs.**

[Get Started](#get-started) • [Workflow](#workflow) • [Architecture](#architecture) • [License](#license)

</div>

---

## What Is ArtDirector?

ArtDirector is a local creative application for making **graphic design with code**. You describe a piece or campaign. The agent and the studio share one project: brand, brief, visual direction, variants, live comments, audit, and export.

It combines, rather than stacks, four existing ideas:

- **Impeccable-style** guided choices, live element selection, and session persistence.
- **Claude HT Skills** composition techniques for infographics, covers, social cards, slides, and editorial work.
- **Frontend Design** as a permanent quality floor (hierarchy, type, originality).
- **ClickClick** as the PNG/JPEG production renderer, with Playwright for live preview, audit, PDF, and SVG.

The language model writes HTML. The browser paints it. There is no DALL-E, Midjourney, or diffusion dependency.

## Get Started

Node 20 or newer. Chromium via Playwright (installed with the package).

```bash
cd Pacotes/artdirector
npm install
npx playwright install chromium
npm test
```

Create a project and open the studio:

```bash
npx artdirector init --name "Northfold Press" --json
npx artdirector studio --open --json
```

The JSON `url` is `http://127.0.0.1:4730/?token=...`. The server binds to localhost only.

Install the OpenCode skill and `/artdirector` command (also copies Cursor / Claude / agents paths):

```bash
npx artdirector install --agent opencode
npx artdirector install --agent all --dest .
```

End-to-end demonstration (three distinct HTML pieces, live edit, accept, audit, PNG/JPEG):

```bash
npx artdirector demo --json
```

Outputs land in `demos/artifacts/`.

| Command | Purpose |
| --- | --- |
| `artdirector init` | Project, brand, session |
| `artdirector brief` | Goal, audience, format |
| `artdirector shape --direction editorial-typographic` | Visual direction |
| `artdirector generate --template social-post` | Template fill |
| `artdirector studio --open` | Browser studio + Live Mode |
| `artdirector audit --id <id>` | Deterministic checks |
| `artdirector export --id <id> --format png` | PNG, jpeg, svg, pdf, html |
| `artdirector resume` | Recover session and pending live events |

Pass `--json` for agents.

## Workflow

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

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the source assessment and engine split.

| Path | Responsibility |
| --- | --- |
| `skill/artdirector/` | Single Agent Skill (OpenCode first) |
| `src/server/` | Local studio HTTP API |
| `studio/` | Browser design studio |
| `src/renderer/` | Unified ClickClick + Playwright renderer |
| `library/templates/` | Reusable HTML templates |
| `library/directions/` | Rendered direction previews |
| `src/techniques/` | HT-derived technique packs |
| `src/design/` | Quality floor and formats |

## Development

| Command | Action |
| --- | --- |
| `npm test` | Vitest unit tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run demo` | Demonstration artifacts |
| `npm run build` | `tsup` + copy studio/library/skill |

## License

MIT. Third-party notices: [NOTICE.md](NOTICE.md).

Playwright 1.64.1 confirmed at https://www.npmjs.com/package/playwright (2026-10-14). ClickClick 0.1.3 confirmed at https://github.com/mintyPT/clickclick.
