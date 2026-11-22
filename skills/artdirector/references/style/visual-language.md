# Visual language

This is the level Art Director aims for: social-media design as strong Brazilian Instagram feeds publish it, the kind a designer builds in Photoshop or Canva (retail promos, editorial quotes, news cards, campaign typography, holiday posts, sports, music and events, fashion collage, education). It describes how those pieces are built, so you can make new ones at the same level. It is not a set of layouts to reproduce. Read [originality.md](originality.md) before you start.

## Why agent-made pieces look alike

Left alone, a coding agent designs like a web developer. It lays the facts out as a landing page (a label, a kicker, a headline, a card, a meta line) and then decorates the empty space with the same small moves every time. Change the brief and the result is the same layout in another color. The user notices the sameness long before they can name it.

A designer working in Photoshop or Canva starts somewhere else: with **an idea** and **a picture**. The idea is what the piece pretends to be or the metaphor it plays (a magazine cover, a chat window, a boarding pass, a hotel key card, a receipt, a wanted poster). The picture is a big visual subject: a photo, the brand's mascot, a product, an illustration, a 3D object. Type comes third and is built around the picture.

### The default moves

These are the agent's habits, not design decisions. The audit reports them as `house-style`. Use **at most one per piece**, only when it carries meaning for this piece, and never the same one in every variant:

| Default move | What it looks like | Why it fails |
|--------------|--------------------|--------------|
| Letter-spaced monospace labels | `V E M  P R A`, `S Á B A D O` in a code font | Developer-tool language; it reads as a website, not a poster |
| Small vertical text on a side edge | `FURZUÊ · 2027` rotated 90 degrees by the border | Pure filler; nobody reads it |
| Dot-separated meta lines | `MEIA · LOTE 1`, `link fixado no chat · te vejo lá` | Interface microcopy, not headline copy |
| A giant faded or outlined word behind | A ghost `27` or a hollow number in the corner | Fills space without adding a subject |
| Rounded label pills | `● LIVE DE VENDAS` in a capsule | A UI badge; every piece gets one |
| Cards with a hard offset shadow | A slightly tilted ticket with a solid shadow block | The same neo-brutalist card everywhere |
| Faint scattered icons | Paw prints or stars at 10 to 30 percent opacity | Wallpaper; reads as clip art |
| Near-black field with one radial glow and grain | Dark brown to black with an orange glow | The default "premium" look; every dark piece converges to it |

Pieces that use three or more of these look like the same template no matter what they say.

## The principles

1. **An idea before a layout.** Before any markup, write one line: "this piece is a ___". It can borrow a format (magazine cover, chat window, ticket stub, poster on a wall, phone notification, boarding pass, menu, receipt), play a metaphor ("the hotel is the prize", "the doors are opening"), or stage a moment (the mascot holding the key). The facts of the brief then live inside that idea: the date becomes the departure time on the boarding pass, the price becomes the magazine's cover price. **Each variant is a different idea**, not the same layout recolored.
2. **A hero picture fills the board.** Every piece has one visual subject taking 40 to 70 percent of the board. Find it in this order: the user's own assets (mascot, logo, product, event photos: check the mood board, the chat, and the workspace), an openly licensed photo ([photo.md](photo.md)), a licensed vector or emoji set ([illustration.md](illustration.md)), then an object you construct that fits the idea (a key card, a ticket, a phone, a sign). A piece made only of type is allowed when the type itself is the picture: huge, effected, filling most of the board. A layout of small facts on a dark field is never a hero.
3. **Poster scale, not website scale.** Few elements, each large. A 1080 px board holds a hero, a headline, one supporting line, and one fact block (date, price, call to action). If you count more than six separate elements, merge or cut. Small UI parts (pills, kickers, meta lines, side labels) are the first to go.
4. **Depth by overlap.** The hero and the type touch: letters pass behind the subject, the subject breaks a frame, a sticker sits on a corner of the photo. Build the field, the hero, and the front type as separate planes. See [composition.md](composition.md).
5. **Type with a voice.** One display family chosen for the idea (a magazine masthead, a chat app's system font, a ticket's dot matrix, a brush for a street poster), and one supporting family. Display type is 6 to 12 times the supporting text and may carry effects (stroke, extrude, gradient, outline) when the idea calls for them. See [typography.md](typography.md).
6. **Color from the brand and the idea.** Start from the brand's colors or the photo's, commit to a saturated field when the idea allows it, and use one accent. Do not reach for near-black plus one glow by default.
7. **Texture and ornament by choice.** Add a texture only when it belongs to the idea (paper for a poster, halftone for a zine, scanlines for an old screen). Ornaments are optional; each one states a fact the brief needs or frames the hero. Zero is a fine number. See [texture-and-ornament.md](texture-and-ornament.md).
8. **Use the whole canvas.** Bleed photos and type off the edges, crop subjects on purpose, fill the height of stories. Empty bands above and below a centered block are the most common sign of an amateur piece.
9. **Copy in the feed's voice.** Short lines, broken for rhythm, in the user's language. A headline of two to six words, a price or date that reads in under a second, one call to action.

## Vary the set

- **Inside one request:** the two to four variants differ in idea, hero, palette, and display family. Two variants that share three of those four are the same variant.
- **Across the chat:** run `history --json` and open the HTML of the last art. Do not reuse its idea, its display family, or its field color for a new piece unless the user asked for a series.
- **Across the workspace:** the user's guidelines ([../workflow/guidelines.md](../workflow/guidelines.md)) record what they already rejected; read them first.

## Mood families

These are starting moods, described by their ingredients. Mix them; do not treat any as a fixed layout.

| Mood | Field | Type voices | Picture | Typical details |
|------|-------|-------------|---------|-----------------|
| Dark and dramatic | Smoke, curtain, deep color with light on the subject | Drip, condensed heavy | Cutouts, desaturated, rim light | Price tags, brand mark |
| Editorial authority | Black or off-white, generous margins | Heavy grotesk headline, bold caps quote, light caption | Side-lit portrait fading into the field | Quote mark, accent square, handle and avatar |
| News and information | Photo fading into a deep solid | Bold sans headline | Full-bleed portrait with scrim | Category tag, logo tab, masthead |
| Campaign and statement | One saturated solid | Rounded heavy sans in two colors, brush number or word | None, or one cutout | Rules, a hand-drawn mark |
| Celebration and holiday | Light paper or bright gradient with rays | Echoed heavy word with gradient, script overlay, puffy 3D letters | Cutout object or symbol | Glossy 3D icons, ribbons |
| Sports and energy | Aged poster paper | Brush and marker type, motion-blurred words | Big ghosted subject plus a sharp one | Brush stars, crest outline |
| Music and events | Duotone photo or gradient | Wide geometric caps, split words | Duotone cutout or full photo | Thin frames, orbs, diagonal bars |
| Fashion and collage | Pastel paper | Extra-condensed heavy caps, elegant script | Halftone black and white in an ornate frame | Lace, frames, flowers, tape |
| Warm education and services | Brand-colored duotone photo | Stacked syllables in heavy sans, thin italic lead | Smiling person, soft blur | Glossy 3D bubble with icon, contacts footer |
| Nostalgia and internet culture | The interface of an old app or device | That interface's own fonts | The brand mascot inside the interface | The interface's real controls, built precisely |

## The reference test

Before handing over, compare each variant with that bar: would it sit in a feed next to work made in Photoshop or Canva without looking cheaper or more generic? If not, the fix is almost never "add more": make the hero bigger, cut elements, sharpen the idea, or replace a default move with something that belongs to the idea.
