# Third-party notices

ArtDirector is MIT. The following third-party work is used or adapted. Include this file with distributions.

## ClickClick

`@maurogoncalo/clickclick` 0.1.3 - MIT
https://github.com/mintyPT/clickclick

Used as the preferred PNG/JPEG production renderer when the package resolves.

## Playwright

`playwright` 1.64.1 - Apache 2.0
https://github.com/microsoft/playwright

Used for live previews, audit inspection, PDF, SVG serialization, and as the ClickClick fallback.

## Lucide

ISC License (Lucide). Some icons derive from Feather (MIT).
https://lucide.dev/license

A small SVG subset is inlined in `src/assets/Lucide.ts` and demonstration artwork.

## Fonts

Families are loaded at render time from Bunny Fonts (https://fonts.bunny.net/), a Google Fonts-compatible CDN.

- Fraunces - SIL Open Font License 1.1
- Newsreader - SIL Open Font License 1.1
- IBM Plex Sans / IBM Plex Mono - SIL Open Font License 1.1
- Space Grotesk - SIL Open Font License 1.1
- Syne - SIL Open Font License 1.1
- Archivo Black - SIL Open Font License 1.1

## Design sources (adapted, not vendored)

- Impeccable by Paul Bakaus - Apache 2.0. Interaction model and command names inspired; no source or binary copied.
  https://github.com/pbakaus/impeccable
- Claude HT Skills - MIT. Technique packs distilled.
  https://github.com/ghoulvspol/claude-ht-skills
- Frontend Design skill in thekorn/agent-skills. Quality floor adapted.
  https://github.com/thekorn/agent-skills/tree/main/skills/frontend-design

Publicly reachable files are not treated as public domain. User-supplied images must carry their own license row in `.artdirector/assets.json`.

## Optional tools used by the skill scripts

- rembg - MIT. https://github.com/danielgatis/rembg
  Installed on request by `skills/artdirector/scripts/photos/remove_background.py` for local background removal. Its segmentation models download on first use under their own licenses. Not bundled.
- Openverse - https://openverse.org/
  Searched by `skills/artdirector/scripts/photos/find_photos.py`. Each photo keeps its own license; the script records creator, source, and license in `credits.json`.
