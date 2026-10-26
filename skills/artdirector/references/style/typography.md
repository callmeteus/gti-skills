# Typography

Type carries most of the emotion in a social piece. Use two voices by default and a third only when it adds feeling.

## Voices and families

All families below load from Bunny Fonts: `@import url("https://fonts.bunny.net/css?family=anton:400|great-vibes:400");` (family names in kebab case, weights after a colon, families separated by `|`).

| Voice | Families | Use it for |
|-------|----------|-----------|
| Heavy grotesk | Archivo Black, Archivo 800, Montserrat 800-900, Bricolage Grotesque 800 | Headlines with authority, news, editorial |
| Condensed heavy | Anton, Bebas Neue, Oswald 700, Big Shoulders Display | Fashion, retail, posters, stacked words |
| Rounded heavy | Rubik 800, Baloo 2 800, Fredoka 700, Lilita One | Campaigns, kids, holidays, friendly brands |
| Geometric caps | Montserrat 600, Plus Jakarta Sans 700 | Spaced titles, labels, events |
| Drip and horror | Creepster, Nosifer, Eater | Halloween, horror, edgy streetwear |
| Brush and marker | Permanent Marker, Sedgwick Ave Display, Rubik Dirt | Sports, street, energy, hand-made marks |
| Script | Great Vibes, Sacramento, Yellowtail, Pinyon Script | Overlays, names, emotional words |
| Editorial serif | Fraunces, DM Serif Display, Playfair Display | Premium, culture, long quotes |
| Light italic lead | Plus Jakarta Sans 300 italic, Fraunces 300 italic | Small lead-ins such as "edição" or "especial" |

Do not use Inter, Roboto, Arial, or system UI fonts as the design voice.

## Scale and spacing on a 1080 px board

| Role | Size | Leading | Tracking |
|------|------|---------|----------|
| Monumental word | 220 to 400 px | 0.78 to 0.9 | -0.02 to -0.06 em |
| Headline | 90 to 180 px | 0.9 to 1.0 | -0.02 to -0.04 em |
| Quote or lead | 32 to 48 px, bold caps | 1.15 to 1.25 | 0 |
| Small caps label | 18 to 30 px | 1.4 | 0.2 to 0.4 em |
| Micro text (texture) | 13 to 16 px | 1.2 | 0, justified |

## Moves that make type feel designed

- **Weight within a line:** set one or two words bolder or in the accent color ("Semana do **Cliente** Fiel").
- **Script overlay:** a script word rotated -4 to -8 degrees, crossing a heavy word or the hero, in the accent color.
- **Fitted lines:** stacked lines that each fill the column width at different sizes (`{{> fit-text}}`, `data-fit`).
- **Echo:** repeat the key word and fade or recolor the copies (`fx-echo`).
- **Split words:** break a word into syllables on separate lines ("Ve / rão", "INVER / NO").
- **3D and gloss:** puffy holiday letters with `fx-gloss-depth`; hard 3D with `fx-extrude`.
- **Rough edges:** brush and stamp edges with `fx-rough` or `fx-rough-strong`; melting bottoms with `fx-melt` on drip fonts.
- **Motion:** a blurred, smeared word in the background with `fx-motion`.
- **Vertical labels:** dates, categories, and slogans along the edges with `.vertical` or `.vertical-down`.
- **Prices:** small currency, huge whole number, raised cents (`<small>R$</small>49<sup>,90</sup>`), with a slanted label above.

## Rules

- **Readable at thumbnail size:** the headline must survive at 25 percent zoom.
- **Contrast:** every line meets its background with enough contrast; add a scrim or shadow instead of shrinking the type.
- **Accents and diacritics:** check that the chosen family covers the user's language (Portuguese needs á, ã, ç, é, ê, í, ó, õ, ú).
- **Two voices first:** add a third only for emotion (script, brush, drip), never as a third neutral sans.
