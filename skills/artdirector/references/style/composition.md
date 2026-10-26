# Composition

Structures that produce depth and tension. They are named by how they work, not by any example. Combine two in one piece, change proportions, move the focal point. Never ship the same structure for every variant.

## Planes

Stack these layers inside `.artboard`, back to front. Every professional piece uses at least three.

```text
5  finish        grain, light leak, vignette          (fx-grain, fx-scrim-vignette)
4  front         small type, tags, icons, ornaments
3  hero          photo, cutout, object, or monumental word
2  back graphic  giant word, shape, crest, rays, frame
1  field         color, gradient, paper, smoke, treated photo
```

## Structures

### Interlock

A giant word or number sits behind the hero; the hero covers part of it; a second, smaller voice crosses the hero in front. Works with cutouts and with objects.

- **Use for:** celebrations, launches, sports, anything with one strong subject.
- **Key moves:** z-index order field, word, hero, overlay; let the hero hide 15 to 35 percent of the word; keep the word readable from its first and last letters.

### Echo stack

One word repeated three to five times, stacked tight, fading or shifting color line by line. Optionally a script word crosses the stack.

- **Use for:** names, places, dates, short emotional words.
- **Key moves:** `fx-echo` with a gradient fill, line height 0.8 to 0.9, the stack 85 to 95 percent of the width.

### Split editorial

The hero occupies one side and melts into a solid field; the other side holds a quote or argument; a huge headline closes the bottom.

- **Use for:** opinion, thought leadership, interviews, quotes.
- **Key moves:** mask the photo edge with a gradient (no hard crop line), a single accent color repeated in three small places.

### Scrim and headline

Full-bleed photo for the top two thirds, a gradient into a deep solid, then a label pill and a bold headline over the solid.

- **Use for:** news, announcements, articles, case studies.
- **Key moves:** the scrim reaches full opacity before the headline starts; the photo is graded toward the solid color.

### Frame and break

A thin frame, oval, or shape sits in the middle; the hero or the letters cross its edge.

- **Use for:** music, events, fashion, portraits.
- **Key moves:** the frame is a line (6 to 10 px) or a beaded ornament; at least one element breaks it.

### Monument type

Type is the whole image: fitted lines that fill the width, alternating colors, a single hand-drawn mark or number.

- **Use for:** campaigns, statements, manifestos, quotes without a photo.
- **Key moves:** fit each line to the width (`{{> fit-text}}`), two colors only, a texture layer so the solid does not go flat.

### Collage

Several cut elements overlap with tape, stickers, lace, frames, flowers, and micro text blocks; type is condensed and huge, with an elegant script crossing it.

- **Use for:** fashion, beauty, lifestyle, creator brands.
- **Key moves:** rotate elements a few degrees, keep one clear focal point, use small justified text blocks in the corners as texture.

### Object hero

Inflated 3D lettering and one glossy object on a bright gradient with rays or facets.

- **Use for:** holidays, retail dates, kids, festive promotions.
- **Key moves:** `fx-gloss-depth` for the letters, a drop shadow that matches the field color, rays centered behind the object.

## Placement rules

- **Focal point off center:** put the hero's eyes or the main word on a third, not in the exact middle.
- **Safe zones:** in stories (1080 x 1920) keep critical type out of the top 210 px and bottom 250 px; fill the space anyway with image and texture.
- **Margins:** 56 to 80 px for small text on 1080 px wide boards; display type and photos may bleed.
- **Bleed or clear, never near:** an element either clears the edge by the margin or crosses it by a clear amount (a fifth of a letter or more). A headline that ends 0 to 40 px from the edge looks like an accident. Fit display lines to the padded column with `data-fit`, and mark intended bleeds with `data-bleed`.
- **Breathing room around the hero:** ornaments (moons, stars, stickers) do not touch letters; keep 24 px or more between them, or overlap them clearly.
- **Reading order:** hero, headline, offer or date, call to action, brand. Size and contrast must follow that order.
- **Variants:** when you deliver several variants, use a different structure or a different hero treatment in each.
