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
compatibility: Requires Node.js 20+ and the Art Director package from the gti-skills repository (build it once with npm run build). Works in any Agent Skills harness.
metadata:
  display-name: Art Director
  opencode/slash: "true"
---

# ArtDirector

## Core Rule

Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## Overview

One skill, one CLI, one local studio. Do not load Impeccable, Claude HT Skills, Frontend Design, or ClickClick as competing skills. Their capabilities are already integrated here.

**Hard rule:** never call DALL-E, Midjourney, diffusion models, or any image-generation API. Final artwork is HTML, CSS, SVG, Canvas, or licensed/user photography rendered in a browser.

**Ship first:** write variants to disk, check each render once for construction defects, and stop so the user can look. Do not audit-fix-export-redraw in a loop. Taste belongs to the user. One write pass, one render check, then hand over.

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

`<skill-dir>` is wherever your harness loaded this skill from, for example `.claude/skills/artdirector`, `.cursor/skills/artdirector`, or `~/.agents/skills/artdirector`. Work from the user's project directory.

If the wrapper cannot find the package, set `ARTDIRECTOR_HOME` to the package folder (`packages/artdirector` in the gti-skills repository) or ask the user to reinstall the skill with `node packages/cli install`.

If `status` fails with `PROJECT`, init then open the studio:

```powershell
& "<skill-dir>\scripts\artdirector.cmd" init --name "<name>" --lang <en|pt|es> --json
& "<skill-dir>\scripts\artdirector.cmd" studio --open --json
```

Set `--lang` from the language of the user's prompt: `pt` for Portuguese, `es` for Spanish, and `en` for English or any other language. The studio interface and the prompts it produces use that language. Pass `--lang` again on any later command if the user switches language.

Open the returned `url` (includes the localhost token). That UI has two views: **Gallery** (every variant) and **Preview** (one variant with element comments and export). Accepted and rejected status is set in Gallery and shows up in `variants --json`. The studio does not show audit findings; fixing them is your job in the render check.

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.

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

### Verify the registration

`variants add` must answer with `"command": "variants add"` and a summary starting with `Registered <id>`. Then run `variants --json` and confirm it lists every id you wrote. The studio shows "No variants yet" until they are registered.

- If `variants add` answers `"command": "variants"` with `N variants`, it only listed: the CLI build in `dist/` is stale. Run `npm run build` in `packages/artdirector` and register again.
- Never register by hand-editing `variants.json`. If you must, write UTF-8 without BOM (PowerShell's `Set-Content -Encoding utf8` adds a BOM and the CLI then reads an empty list).
- Put each HTML at `<scope.variantsDir>/<id>/artwork.html` (one folder per id).

## Workflow

Follow the user's intent. Do not run a long questionnaire when the brief already implies defaults. Do not read ArtDirector package source (`src/`, `Routes.ts`, `Audit.ts`) to discover how to work - use this skill and the CLI wrapper.

1. **init** once when `status` returns `PROJECT`. The CLI reuses the chat's active request; for a new unrelated piece in the same chat use `init --new`. Skip exploring the whole repo. Use `init --permanent` only when the user asks to keep state in the repository.
2. **brief** only for missing essentials (goal, format, audience). If the user already said "story teaser for X", that is enough.
3. **generate** - write **2 to 4 complete HTML variants** on disk in one pass (different directions, or the same art at the sizes they asked for). Vary the backgrounds deliberately: do not ship only dark pieces - include at least one lighter or contrasting treatment unless the brief clearly calls for darkness. Original work: write each piece to an absolute path inside the `scope.variantsDir` returned by `init`, then register it with `variants add --id "<id>" --file "<absolute html path>"`. Never invent a repository `.artdirector/variants/<id>/artwork.html` path. Templates: `generate --template <id> --json` with `formatIds` when they want several sizes of the same piece.
4. **Render check, once.** For each variant run `audit --id <id> --json` and `export --id <id> --format png --json`, then look at the PNG. Fix construction defects only: text touching or crossing the edge, copy in the story chrome, an empty band where the art ends early, a floating or crooked object, blurred type, collisions, missing glyphs, broken assets. One fix pass, no taste edits. Follow [references/output/render-check.md](references/output/render-check.md).
5. **Hand over.** Start `studio --open --json` if it is not running. Tell the user the variant ids and the studio URL. **Stop. Wait for them.** Do not audit again. Do not rewrite the tail, the tree, or the gradient because you dislike the render.
6. **Changes** arrive as a prompt the user copies from Preview and pastes into the chat: variant id, file path, and numbered comments with a CSS selector each. Edit only those elements in that file, run the render check once, then stop again. See [references/workflow/live.md](references/workflow/live.md).
7. **Final audit / export** when they accept a variant or explicitly ask to export.

Forbidden after the render check:

- a second audit-fix-export round on the same variant
- a rewrite of the same file because a decoration "still looks like a blob"
- changing direction, palette, type, or copy without the user asking
- polishing until it feels perfect

Do not audit as a beauty gate: the render check is for construction defects. If a defect survives the one fix pass, **say it in one sentence** and leave the files. They test; you wait.

**resume** reads session + pending events: `& "<skill-dir>\scripts\artdirector.cmd" resume --json`.

## Commands

`init` `brief` `shape` `craft` `generate` `live` `critique` `audit` `polish` `bolder` `quieter` `typeset` `colorize` `layout` `distill` `adapt` `export` `resume`

Details: [references/workflow/commands.md](references/workflow/commands.md). Studio comments: [references/workflow/live.md](references/workflow/live.md). Audit and export checks: [references/output/audit.md](references/output/audit.md).

## Visual bar

The target is professional social-media design: photo-led, layered, textured, with type that interlocks with the subject. Read these while you plan the first markup; each one is short.

- [references/style/visual-language.md](references/style/visual-language.md) - the eight principles and mood families. Read first.
- [references/style/composition.md](references/style/composition.md) - planes of depth and structures to combine.
- [references/style/typography.md](references/style/typography.md) - type voices, scale, and moves.
- [references/style/photo.md](references/style/photo.md) - finding photos, removing backgrounds, treatments.
- [references/style/texture-and-ornament.md](references/style/texture-and-ornament.md) - textures and native furniture.
- [references/style/illustration.md](references/style/illustration.md) - where drawn objects and characters come from, construction rules, and how to hide a spoiler. Read it before you draw anything.
- [references/style/originality.md](references/style/originality.md) - references set the level, never the layout; self-check before hand-over.

**References are not recipes.** When the user shares example images, learn their level (depth, texture, contrast, finish) and make something new. Never reproduce a reference's layout, copy, brand, or subject.

Build with the effects toolkit instead of rewriting textures and type effects: write `{{> grain}}`, `{{> duotone}}`, `{{> type-fx}}`, and the others into the artwork. They are tools to combine and adjust, not finished designs. See [references/effects/catalog.md](references/effects/catalog.md).

Photos: ask the user first; otherwise search openly licensed photos with `scripts/photos/find_photos.py` and cut out subjects with `scripts/photos/remove_background.py` (local model, not generative; tell the user before the first model download). Details in [references/style/photo.md](references/style/photo.md).

## Composition rules

- Lock `.artboard` to the export size. `overflow: hidden`. `data-artdirector-root` plus `data-width` / `data-height`.
- **Story (1080×1920):** the board is a phone screen. Fill the height with stacked, huge type (headline 180px or larger). Safe chrome: keep critical copy out of the top 210px and bottom 250px. Never letterbox a square poster in the middle, and never end the art above a flat strip. See [references/design/formats.md](references/design/formats.md).
- **Edges:** text either clears the side by 56px or more, or bleeds clearly past it and carries `data-bleed`. Never 0 to 40px from the edge. Size display lines to the padded column, not to the board.
- **Drawn objects and characters:** never draw people, animals, or mascots by hand; ask for the brand's file or use a licensed vector. Build simple objects on one grid with identical gaps and no per-part rotation. Never hide text with blur. See [references/style/illustration.md](references/style/illustration.md).
- Bunny Fonts for open-source families. Lucide SVGs for icons. Record third-party assets in `.artdirector/assets.json`.
- **Search the web for public-domain elements, especially SVGs**, when the composition needs icons, illustrations, maps, diagrams, or decorative marks beyond the bundled Lucide subset. Choose assets that **make sense for the proposed theme and the brand** (subject, industry, audience, tone) - do not grab generic clip art just because it is free. Prefer sources with a clear CC0 / public-domain license (Wikimedia Commons, OpenClipArt, Feather, Tabler, Heroicons, etc.). Download the file into the project, inline the SVG so its strokes and fills can be themed, and record it in `.artdirector/assets.json` with source and license. Never hotlink a remote asset, and never use copyrighted or unclearly licensed imagery.
- Mark selectable regions with `data-ad-select` or ClickClick `data-layer`.
- Backgrounds are a design choice: the AI may use solid color, gradients, patterns, or public-domain SVG/image backgrounds when they serve the piece and the brand - or keep the background empty when restraint is stronger. Do not default to empty backgrounds; choose deliberately based on the theme, the brand, and the format.
- Do not default every variant to a dark background. Deliver a range of treatments (light, dark, and contrasting) so the user can choose.
- If a suitable photo is missing and the user does not want a licensed one, build a typographic or vector composition at the same level (monument type, echo stacks, textures). Do not invent a generated picture.
- Reference photos with relative paths from the artwork folder (for example `assets/portrait.png`). The studio and the exporter resolve them.

Template production vs art direction: [references/design/templates.md](references/design/templates.md). Composition techniques per artifact type: [references/design/techniques.md](references/design/techniques.md).

## Quality

Read [references/design/quality.md](references/design/quality.md) **once**, while writing the first markup. The floor is for that first pass: named direction, intentional type, original composition. It is not a license to iterate until perfect.

Automated audit is not a beauty certificate. It catches construction defects during the render check; taste stays with the user.
