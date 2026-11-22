# Quality floor

Applied to every Art Director composition. The visual bar is described in [../style/visual-language.md](../style/visual-language.md); this page is the short checklist.

Must:

- Name one visual direction and execute it with intent.
- Start from an idea ("this piece is a ___"); each variant has a different one.
- Give the piece a hero picture that fills 40 to 70 percent of the board (the user's asset, a photo, a licensed vector, or a constructed object) and lock the type to it.
- Build depth by overlap: the hero and the type touch. Add texture only when it belongs to the idea.
- Pair two distinct type voices with extreme scale contrast. Not Inter, Roboto, Arial, or system UI as the design.
- Keep the palette tight: one field, one accent repeated in a few places, one neutral.
- Use the whole canvas: bleed, crop with intent, fill the height of stories.
- Keep primary text readable on its actual background.
- Let every ornament carry a purpose (frame, point, or state a fact), or leave it out.
- Build precision objects exactly (barcodes, starbursts with text, interface chrome; see [../style/texture-and-ornament.md](../style/texture-and-ornament.md)).
- Build drawn objects on one grid and take characters from the brand or a licensed set (see [../style/illustration.md](../style/illustration.md)).
- Keep text 56 px or more from the edges unless it bleeds on purpose.
- Render each variant once and fix construction defects before handing over (see [../output/render-check.md](../output/render-check.md)).
- Make it original. References set the level, never the layout (see [../style/originality.md](../style/originality.md)).

Never:

- Generative image APIs.
- A flat single-color card with centered text.
- Reproducing a reference's layout, copy, or brand.
- Purple-pink hero gradients as a default.
- Repeating rounded cards with identical shadows.
- Two or more of the default moves on one board: tracked monospace labels, small vertical edge text, dot-separated meta lines, a giant faded word behind, label pills, offset-shadow cards, faint scattered icons, near-black with one glow (audit `house-style`; see [../style/visual-language.md](../style/visual-language.md)).
- A layout of small facts on a dark field with no picture.
- Text cut by or spilling out of its shape (audit `shape-clip`, `shape-spill`).
- Decoration floating far from what it is about.
- Claiming success before HTML is written and rendered.
- Freehand characters, mascots, people, or animals.
- Crooked repeated parts: windows, rows, or bars placed by eye.
- Blur as a way to hide text.
- A flat strip where the art ends early.
- More than one render-check fix pass before the user has seen the variants.
- Rewriting the same board because you dislike a decoration.

Ship 2-4 drafts, then stop. Visual taste is the user's.

Directions: editorial-typographic, bold-promotional, swiss-inspired, minimalist-geometric, neo-brutalist, premium-corporate, vintage-print, expressive-playful, technical-infographic, data-driven-editorial.
