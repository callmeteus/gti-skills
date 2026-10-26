# Illustration

Drawn objects and characters are where agent-made artwork looks cheapest. A wobbly building or a freehand mascot pulls a good layout down to clip-art level. Decide the source of every illustration before you write markup.

## Choose the source, in this order

1. **The user's own asset.** A mascot, character, logo, or product photo belongs to the brand. Ask for the file. Never redraw a brand mascot from memory or from a description.
2. **A licensed vector or photo.** Search openly licensed sets that fit the theme: Fluent Emoji (MIT), Noto Emoji (Apache 2.0), OpenMoji (CC BY-SA 4.0, credit required), Twemoji graphics (CC BY 4.0, credit required), OpenClipArt and Wikimedia Commons public-domain files, Tabler or Lucide for icons, or a photo through [photo.md](photo.md). Download, inline, recolor to the palette, and record source and license in `.artdirector/assets.json`.
3. **Type as the image.** A monumental word, a symbol glyph, or a big "?" often carries a teaser better than a drawing. See [typography.md](typography.md).
4. **A geometric object you construct.** Only simple objects: buildings, boxes, tickets, cards, signs, phones, calendars, arrows, badges. Follow the construction rules below.

**Never draw by hand:** people, faces, animals, mascots, hands, or any character. If none of options 1 to 3 is available, leave the character out and say so in one sentence when you hand over.

## Construction rules for drawn objects

- **One SVG, one grid:** draw the object in a single `<svg>` with a `viewBox` on an 8 or 10 unit grid. Every coordinate is a multiple of the grid unit.
- **Repeat with math, not by eye:** repeated parts (windows, rows, bars, stripes) come from a `<pattern>`, from `<use>` with computed offsets, or from CSS grid with a fixed `gap`. Gaps and sizes are identical across a row and a column.
- **Straight by default:** no `rotate` or `skew` on individual parts. If the object should tilt, rotate the whole group once, by 2 to 6 degrees.
- **One line system:** one stroke width for the whole object (for example 8 units), the same `stroke-linejoin` and `stroke-linecap`, and the same corner radius on every repeated part.
- **Plausible proportions:** a door is about one floor high, windows are smaller than the gaps between floors, a sign sits on the roof and is narrower than the roof.
- **Ground it:** the object stands on something (a ground line, a shadow that matches the field color, or the frame edge where it is cropped on purpose). It never floats above an unrelated band.
- **Size it to matter:** the hero object fills 55 to 80 percent of the board width. A small drawing in a big field reads as an icon, not a hero.
- **Flat or textured, not both:** pick flat vector with a hard offset shadow, or a textured treatment (`fx-grain`, `fx-halftone`). A hand-drawn look comes from one consistent filter on the whole object (`fx-rough`), never from crooked parts.

## Hiding and teasing

For spoilers, reveals, and countdowns, the hidden part is a designed element.

| Do | Instead of |
|----|------------|
| A redaction bar or strips of tape over the word, slightly rotated | `filter: blur()` on text, which reads as a rendering bug |
| A sticker or stamp ("em breve", "?", "segredo") covering the sign | Lowering the text opacity |
| The letters replaced by "? ? ?" in the same type voice | A smeared or pixelated name |
| A switched-off neon sign: outlined letters with no glow | Random noise over the word |
| A cropped view: only the corner of the object, the rest off the frame | Showing everything and then hiding the key part badly |
| A silhouette in the accent color with a single highlight | A detailed drawing with a fog layer |

## Self-check

- [ ] Was every character or mascot supplied by the user or taken from a licensed set?
- [ ] Are repeated parts aligned on one grid, with identical gaps?
- [ ] Does the object stand on something, with no flat band under it?
- [ ] Is anything hidden with a designed element instead of blur?
