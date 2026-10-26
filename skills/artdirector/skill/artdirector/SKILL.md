---
name: artdirector
description: >-
  Unified local-first graphic design studio. Designs HTML/CSS/SVG artwork
  (infographics, covers, social cards, slides, editorial, promotions), guides
  visual direction in a local studio, iterates in Live Mode, audits, and
  exports PNG/JPEG/SVG/PDF. Never uses generative image APIs. Use when the
  user mentions ArtDirector, artdirector, graphic design, posters, social
  cards, infographics, HTML graphics, ClickClick rendering, or live visual
  editing of artwork.
license: MIT
compatibility: opencode, cursor, claude, agents
metadata:
  opencode/slash: "true"
---

# ArtDirector

One skill, one CLI, one local studio. Do not load Impeccable, Claude HT Skills, Frontend Design, or ClickClick as competing skills. Their capabilities are already integrated here.

**Hard rule:** never call DALL-E, Midjourney, diffusion models, or any image-generation API. Final artwork is HTML, CSS, SVG, Canvas, or licensed/user photography rendered in a browser.

**Ship first:** write variants to disk and stop so the user can look. Do not audit-fix-export-redraw in a loop. Taste belongs to the user. One write pass, then hand over.

## Setup

The CLI is the wrapper in this skill. **Do not search npm, npx cache, PATH hunts, GitHub, or the disk for an `artdirector` binary.** Never run `npx artdirector` (the package is local; npx will wander).

Skill directory = the folder that contains this `SKILL.md`.

Windows:

```powershell
& "<skill-dir>\scripts\artdirector.cmd" status --json
```

Unix:

```bash
"<skill-dir>/scripts/artdirector" status --json
```

In Cursor with the global link, `<skill-dir>` is `%USERPROFILE%\.cursor\skills\artdirector`. Work from the user's project directory.

If `status` fails with `PROJECT`, init then open the studio:

```powershell
& "<skill-dir>\scripts\artdirector.cmd" init --name "<name>" --json
& "<skill-dir>\scripts\artdirector.cmd" studio --open --json
```

Open the returned `url` (includes the localhost token). That UI is the creative surface: brief, visual directions, gallery, Live Mode, audit, export.

## Session storage

ArtDirector isolates state by chat. The CLI reads `OPENCODE_SESSION_ID`, `PASEO_AGENT_ID`, and similar agent session variables automatically, then keeps each chat's project in its own temporary folder under the OS temp directory.

- **Default:** a new request is temporary. Nothing is written into the user's repository. The `init`/`status` JSON includes `scope.workspace`, `scope.root`, `scope.stateDir`, `scope.variantsDir`, and `scope.exportsDir`.
- **New artwork request in the same chat:** start a fresh isolated context with `init --new --name "<name>" --json`. Do not reuse the previous request's brand, brief, or variants for an unrelated piece.
- **Permanent repository state:** only when the user asks to keep the project in the repository, for example to commit it to Git, run `init --permanent --name "<name>" --json`. This writes `.artdirector/` in the repository. Every later command in that chat keeps using it.
- **Explicit chat id:** pass `--session <id>` when the agent does not expose a session variable. Never invent the same id for two chats.
- **Exports:** `export` writes to the session temp folder by default. Pass `--out <path inside the workspace>` when the user wants the final file delivered into the repository.

Always read paths from the JSON instead of assuming `.artdirector/` exists in the working directory. Write agent-authored HTML to the absolute `scope.variantsDir` path, then register it with:

```powershell
& "<skill-dir>\scripts\artdirector.cmd" variants add --id "<id>" --file "<absolute html path>" --json
```

## Workflow

Follow the user's intent. Do not run a long questionnaire when the brief already implies defaults. Do not read ArtDirector package source (`src/`, `Routes.ts`, `Audit.ts`) to discover how to work - use this skill and the CLI wrapper.

1. **init** once when `status` returns `PROJECT`. The CLI reuses the chat's active request; for a new unrelated piece in the same chat use `init --new`. Skip exploring the whole repo. Use `init --permanent` only when the user asks to keep state in the repository.
2. **brief** only for missing essentials (goal, format, audience). If the user already said "story teaser for X", that is enough.
3. **generate** - write **2 to 4 complete HTML variants** on disk in one pass (different directions, or the same art at the sizes they asked for). Vary the backgrounds deliberately: do not ship only dark pieces - include at least one lighter or contrasting treatment unless the brief clearly calls for darkness. Original work: write each piece to an absolute path inside the `scope.variantsDir` returned by `init`, then register it with `variants add --id "<id>" --file "<absolute html path>"`. Never invent a repository `.artdirector/variants/<id>/artwork.html` path. Templates: `generate --template <id> --json` with `formatIds` when they want several sizes of the same piece.
4. **Hand over.** Start `studio --open --json` if it is not running. Tell the user the variant ids and the studio URL. **Stop. Wait for them.** Do not audit. Do not export a PNG to inspect it yourself. Do not rewrite the tail, the tree, or the gradient because you dislike the first render.
5. **live** only after they click, comment, or ask for a change. Poll `/v1/events/poll`. Edit the HTML they pointed at. Then stop again.
6. **audit / export** only when they accept a variant or explicitly ask to export.

Forbidden after the first write:

- `audit` as a self-review gate
- `export` just to look
- a second rewrite of the same file because a decoration "still looks like a blob"
- polishing until it feels perfect

If you notice a defect, **say it in one sentence** and leave the files. They test; you wait.

**resume** reads session + pending events: `& "<skill-dir>\scripts\artdirector.cmd" resume --json`.

## Commands

`init` `brief` `shape` `craft` `generate` `live` `critique` `audit` `polish` `bolder` `quieter` `typeset` `colorize` `layout` `distill` `adapt` `export` `resume`

Details: [reference/commands.md](reference/commands.md). Live protocol: [reference/live.md](reference/live.md).

## Composition rules

- Lock `.artboard` to the export size. `overflow: hidden`. `data-artdirector-root` plus `data-width` / `data-height`.
- **Story (1080×1920):** the board is a phone screen. Fill the height with stacked, huge type (headline 180px or larger). Safe chrome: keep critical copy out of the top 210px and bottom 250px. Never letterbox a square poster in the middle. See [reference/formats.md](reference/formats.md).
- Bunny Fonts for open-source families. Lucide SVGs for icons. Record third-party assets in `.artdirector/assets.json`.
- **Search the web for public-domain elements, especially SVGs**, when the composition needs icons, illustrations, maps, diagrams, or decorative marks beyond the bundled Lucide subset. Choose assets that **make sense for the proposed theme and the brand** (subject, industry, audience, tone) - do not grab generic clip art just because it is free. Prefer sources with a clear CC0 / public-domain license (Wikimedia Commons, OpenClipArt, Feather, Tabler, Heroicons, etc.). Download the file into the project, inline the SVG so its strokes and fills can be themed, and record it in `.artdirector/assets.json` with source and license. Never hotlink a remote asset, and never use copyrighted or unclearly licensed imagery.
- Mark selectable regions with `data-ad-select` or ClickClick `data-layer`.
- Backgrounds are a design choice: the AI may use solid color, gradients, patterns, or public-domain SVG/image backgrounds when they serve the piece and the brand - or keep the background empty when restraint is stronger. Do not default to empty backgrounds; choose deliberately based on the theme, the brand, and the format.
- Do not default every variant to a dark background. Deliver a range of treatments (light, dark, and contrasting) so the user can choose.
- If a suitable photo is missing, build a vector or typographic composition. Do not invent a generated picture.

Template production vs art direction: [reference/templates.md](reference/templates.md).

## Quality

Read [reference/quality.md](reference/quality.md) **once**, while writing the first markup. The floor is for that first pass: named direction, intentional type, original composition. It is not a license to iterate until perfect.

Automated audit is not a beauty certificate and is not a prerequisite for showing work.
