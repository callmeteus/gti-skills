# ArtDirector architecture

## Assessment (sources inspected)

Inspected current GitHub trees and READMEs, not just marketing copy:

| Source | License | What we reuse | What we do not copy |
|---|---|---|---|
| [Impeccable](https://github.com/pbakaus/impeccable) (Apache 2.0) | Command names, guided choices, live select/poll/accept, session persistence | The closed helper binary, 13k-line live overlay, app-HMR wrapping. Graphic production is a different runtime (fixed artboards, export, templates). Reimplementing the protocol in TypeScript keeps one OSS codebase. |
| [Claude HT Skills](https://github.com/ghoulvspol/claude-ht-skills) (MIT) | Infographic layouts, cover dimensions, social/slide/editorial techniques | Six competing skills and EXTEND.md questionnaires. Folded into one technique registry selected by artifact type. |
| [Frontend Design](https://github.com/thekorn/agent-skills/tree/main/skills/frontend-design) | Quality floor: named direction, type, hierarchy, anti-generic-AI | A second skill. The floor is always on. |
| [ClickClick](https://github.com/mintyPT/clickclick) `@maurogoncalo/clickclick@0.1.3` (MIT) | PNG/JPEG from HTML, `data-layer` templates, batch `createRenderer` | PDF, SVG, Live Mode, audit DOM. Those stay on Playwright as a complement, not a second template language. |
| [Lucide](https://lucide.dev/license) (ISC; some icons MIT via Feather) | Inlined subset for templates and demos | The full icon package. |
| [Bunny Fonts](https://fonts.bunny.net/) / [Google Fonts](https://fonts.google.com/) | SIL OFL / Apache families via Bunny CSS | Downloading whole families into git. |

**No generative image APIs.** Language models write HTML; Chromium paints it.

## Why a new local server (not the Impeccable binary)

Impeccable's helper is built for product UI with HMR. ArtDirector needs:

- Project-scoped brand + brief + variant catalog
- Rendered direction gallery
- HTML artboard export
- Token-gated localhost studio

Adapting the interaction model (poll, generate, accept, element selection) avoids two competing live systems. Wrapping the binary would fork session state and keep a closed dependency at the core of an open-source product.

## Why Playwright still exists beside ClickClick

ClickClick is the production PNG/JPEG path when the module loads (`UnifiedRenderer`). It does not export PDF/SVG, host Live Mode, or inspect overflow. Playwright covers those. Callers use one `render()` interface and never choose an engine.

## Runtime

```text
Agent skill (SKILL.md)
        |
        v
artdirector CLI --json
        |
        +-- .artdirector/  project, brand, brief, session, variants, history, token
        |
        +-- StudioServer  127.0.0.1 + bearer token
        |     studio UI, live overlay, /v1 API
        |
        +-- UnifiedRenderer  ClickClick PNG/JPEG, Playwright PDF/SVG/audit
        |
        +-- Technique registry + template catalog + quality floor
```

Security: loopback bind, timing-safe token, path confinement to the project or package library, no shell, no arbitrary filesystem.

OpenCode is first (`node dist/bin/artdirector.js install --agent opencode`). The same skill copies to `.cursor/skills`, `.claude/skills`, and `.agents/skills`.

## Effects and local images

The engine ships building blocks, not finished designs. `library/effects` holds CSS, SVG, and one small script (textures, photo treatments, type effects, ornaments, filters, icons, line fitting). Artwork includes them with `{{> effect-id}}` markers; `Effects.expand` inlines each one once when the studio serves the artwork, when the audit inspects it, and when the renderer exports it. The source HTML stays short and every piece shares one implementation.

Photos stay as files next to the artwork. `TemplateApply.materialize` copies images a template or registered HTML references (relative paths, absolute paths, `file://` URLs) into the variant's `assets/` folder. The studio rewrites relative references to `/artwork/<id>/<path>` and serves them confined to the project; the renderer inlines them as data URIs, because pages are loaded with `setContent` and have no file origin.

The style knowledge that tells the agent how to use these blocks lives in the skill (`skills/artdirector/references/style`), so the engine never encodes a house style.

## Limitations

- **Agent in the loop:** Live Mode queues events on localhost. An OpenCode/Cursor/Claude agent must poll `/v1/events/poll`, edit HTML, and reply. The studio does not call a language model by itself.
- **SVG export:** Playwright serializes an SVG root when the composition has one. HTML-only artboards export as PNG/JPEG/PDF/HTML, not a reconstructed SVG.
- **ClickClick coverage:** `@maurogoncalo/clickclick@0.1.3` does PNG/JPEG and `data-layer` templates. PDF, live overlay, and audit stay on Playwright (documented complement, not a second template language).
- **Network fonts:** Bunny Fonts load at render time. Offline captures fall back to whatever the OS has unless `@font-face` files are added locally.
- **Workspace location:** ArtDirector lives in `skills/artdirector` of the gti-skills repository, as a standalone package that does not depend on any other project.
