# Texture and ornament

Texture makes a board feel printed and alive; ornaments carry small facts. Both are optional and must belong to the piece's idea ([visual-language.md](visual-language.md)). Added by habit, they are what makes every piece look the same. The effect names below are explained in [the effects catalog](../effects/catalog.md).

## Textures

| Texture | Effect | Feels like |
|---------|--------|-----------|
| Film grain | `fx-grain` | Film, print, and vintage ideas. Opacity 0.08 to 0.25; `multiply` on light fields, `overlay` on dark ones. Not a default |
| Aged poster paper | `fx-paper`, `fx-creases` | Sports, vintage, street |
| Soft pastel paper | `fx-paper fx-paper-soft` | Fashion, beauty, collage |
| Smoke and curtain | `fx-smoke` | Drama, nightlife, horror, premium launches |
| Halftone dots | `fx-halftone`, `fx-halftone-dots` | Zine, retro, pop |
| Light rays | `repeating-conic-gradient` masked by a radial gradient | Celebrations, holidays, reveals |
| Glass facets | translucent polygons with `clip-path` and `mix-blend-mode: soft-light` | Festive gradients, tech |
| Faint grid | 1 px lines at 3 to 5 percent opacity, faded with a mask | News, data, editorial |
| Lace and doily | the `#doily` symbol | Romantic, fashion, retro feminine |

A flat field is fine when the hero fills the board. Texture belongs on a field that shows, and only the one that fits the idea.

## Ornaments

| Ornament | Effect or symbol | Use |
|----------|------------------|-----|
| Label pill | `.pill` | A category the brief names ("feriado nacional", "novidade"). A default move: not in every piece |
| Slanted price tag | `.price-tag` | Offers above a price |
| Logo tab | `.logo-tab` | Publisher or brand mark hanging from the top edge |
| Circled arrow | `.arrow-circle` with `#i-arrow-right` | Next, read more, decision |
| Glossy 3D bubble | `.glossy-bubble` with `#heart-gloss` or any icon | Friendly brands, holidays, education |
| Gradient orb | `.orb` | Music, sports, tech energy |
| X marks, dots, chevrons, lines | `.x-mark`, `.dot-grid`, `.chevrons`, `.bar` | Geometric posters, events |
| Tape | `.tape` | Collage, scrapbook |
| Flowers and sparkles | `#flower`, `#sparkle` | Fashion, beauty, celebrations |
| Beaded oval frame | `#oval-frame` | Portraits in collage |
| Brush stars and crests | `#star` with `fx-rough` or `fx-brush` and blur | Sports, national dates |
| Social icon row | `.icon-row` with `#i-heart`, `#i-chat`, `#i-send`, `#i-bookmark` | Native feed feeling |
| Footer contacts | `#i-instagram`, `#i-phone`, `#i-at` | Services, schools, local businesses |

## Density

- **Count:** zero to three kinds of ornament per piece. Each one is there because the idea or the brief needs it.
- **Scale ladder:** when you use several, one large (frame, orb, crest), the rest small.
- **Color:** ornaments use the accent or a neutral, never a new color.
- **Placement:** cluster near the hero or along the edges; leave the headline's area clean.
- **Purpose:** every ornament either frames the hero, points to something, or carries a fact (price, date, category, handle). If you cannot say which, delete it.
- **Attached, not floating:** an ornament touches or points at what it is about. Marks floating alone near an edge read as dirt.

## Precision objects

Some objects only work when they are exact. Drawn loosely they look broken, and the user sees nothing else.

| Object | Build it like this | Never |
|--------|--------------------|-------|
| Barcode | One `<svg>` with bars at integer x positions and integer widths (1 to 4 units), all the same height, from one row of data; the whole group upright, or rotated once as a group | Bars as separate divs, random widths with fractions, per-bar transforms, a tilted group on a straight cover |
| QR code | A real QR generated from a real payload, or none | A random grid of squares |
| Starburst, seal, badge with text | Shape first, then text sized to the shape's inner circle: the text block fits inside 70 percent of the shape's width and height; check it in the audit (`shape-clip`, `shape-spill`) | Text the same size as the shape, letters touching or cut by the points |
| Speech bubble, chat window, app interface | The real proportions of that interface: title bar, buttons, padding, and fonts all on one grid | Approximate chrome, buttons of different sizes |
| Motion and attention marks | Short strokes attached to the moving or shaking object, three to five, the same length and angle | Loose bars floating near the board's edge, far from anything |
| Stars, sparkles, confetti | One symbol, a few sizes, placed near the hero | Dozens of random shapes everywhere |

When an object cannot be built exactly, leave it out.
