# Effects catalog

Effects are reusable building blocks shipped with the Art Director engine: textures, photo treatments, type effects, ornaments, SVG filters, and icons. They are tools for original work, not finished designs.

## Including an effect

Write `{{> effect-id}}` in the artwork HTML. CSS effects go inside the `<style>` element; `svg-defs` goes once at the top of `<body>`; `fit-text` goes at the end of `<body>`. The studio, the audit, and the exporter expand the markers, so the source file stays short.

```html
<style>
    @import url("https://fonts.bunny.net/css?family=anton:400|great-vibes:400");
    {{> artboard}}
    {{> grain}}
    {{> duotone}}
    {{> type-fx}}
</style>
<body>
    {{> svg-defs}}
    <div class="artboard fx-grain" data-artdirector-root data-width="1080" data-height="1350">
        ...
    </div>
    {{> fit-text}}
</body>
```

List them, or print one with its full source and usage notes:

```bash
"<skill-dir>/scripts/artdirector" effects --json
"<skill-dir>/scripts/artdirector" effects --id duotone --json
```

## Catalog

| Id | Kind | Provides | Main controls |
|----|------|----------|---------------|
| `artboard` | CSS | Reset, locked artboard, `.layer`, `.vertical`, `.vertical-down` | none |
| `grain` | CSS | `fx-grain` film grain overlay | `--grain-opacity`, `--grain-blend`, `--grain-size` |
| `paper` | CSS | `fx-paper` aged paper, `fx-paper-soft` pastel paper, `fx-creases` folds | `--paper`, `--paper-stain`, `--paper-burn` |
| `smoke` | CSS | `fx-smoke` colored smoke and curtain backdrop (needs `svg-defs`) | `--smoke-base`, `--smoke-glow`, `--smoke-hot`, `--curtain` |
| `duotone` | CSS | `fx-duotone` for photos, `fx-duotone-cutout` for transparent PNGs | `--duo-dark`, `--duo-light`, `--duo-contrast`, `--duo-brightness`, `--duo-position`, `--src` |
| `scrim` | CSS | `fx-scrim-bottom`, `-top`, `-left`, `-right`, `-vignette` | `--scrim`, `--scrim-from` |
| `halftone` | CSS | `fx-halftone` for images, `fx-halftone-dots` overlay | `--dot`, `--dot-size`, `--dot-alpha` |
| `cutout` | CSS | `fx-cutout` shadow, `fx-rim` rim light, `fx-ghost` duplicate, `fx-sticker` outline | `--shadow`, `--rim` |
| `type-fx` | CSS | `fx-extrude`, `fx-gloss`, `fx-gloss-depth`, `fx-gradient`, `fx-echo`, `fx-outline`, `fx-glow`, `fx-motion`, `fx-rough`, `fx-rough-strong`, `fx-melt` | `--extrude`, `--step`, `--gloss-top`, `--gloss-mid`, `--gloss-bottom`, `--g1`, `--g2`, `--g-angle`, `--stroke`, `--stroke-color`, `--glow`, `--motion-blur` |
| `ornaments` | CSS | `.pill`, `.price-tag`, `.logo-tab`, `.arrow-circle`, `.glossy-bubble`, `.orb`, `.x-mark`, `.dot-grid`, `.chevrons`, `.bar`, `.tape`, `.icon-row` | `--pill-bg`, `--tag-bg`, `--tab-accent`, `--ring`, `--bubble`, `--orb-1`, `--orb-2`, `--size`, `--mark` |
| `svg-defs` | SVG | Filters `#fx-rough`, `#fx-rough-strong`, `#fx-brush`, `#fx-melt`, `#fx-wave`, `#fx-smoke`; icons `#i-heart`, `#i-chat`, `#i-send`, `#i-bookmark`, `#i-arrow-right`, `#i-instagram`, `#i-phone`, `#i-at`, `#i-quote`; shapes `#flower`, `#sparkle`, `#star`, `#heart-gloss`, `#doily`, `#oval-frame` | `currentColor`, `--flower-center` |
| `fit-text` | Script | Sizes each `[data-fit]` line to fill its parent's width | `data-fit`, `data-fit-max` |

## Notes

- **Symbols:** use an outer `<svg>` whose `viewBox` starts at `0 0` (for example `viewBox="0 0 100 100"`) and put `<use href="#flower"/>` inside; the symbol scales into it. A viewBox that starts at negative coordinates shifts the drawing.
- **Gloss with depth:** repeat the text in `data-text` (`<span class="fx-gloss-depth" data-text="VERÃO">VERÃO</span>`); the depth and the shine are drawn from that attribute.
- **Cutout duotone:** set `--src: url('cutout.png')` on the wrapper to the same file as the inner `<img>`, so the color stays inside the subject's outline.
- **Filters need the defs:** `fx-rough`, `fx-rough-strong`, `fx-melt`, and `fx-smoke` reference filters from `svg-defs`; include it in every artwork that uses them.
- **Combine and adjust:** effects are starting points. Change the variables, layer several, and add your own CSS on top. Do not stop at the defaults.
