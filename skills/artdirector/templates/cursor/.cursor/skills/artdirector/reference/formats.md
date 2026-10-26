# Output formats

Use the named size. Do not invent a square layout and paste it into another ratio.

## Story / Reel cover - 1080×1920

The artboard **is** a phone. Viewed full-screen, at arm's length.

Must:

- `width: 1080px; height: 1920px` on `.artboard`.
- Fill the vertical. Flex column, space-between, padding about `220px 64px 260px`.
- Display type **180px or larger**. Supporting 36-48px. Kicker 28-34px.
- One idea, stacked. CTA near the bottom, still above the 250px chrome.

Must not:

- A square card floating in a tall navy field.
- Headlines under 140px.
- `align-items: center` plus huge padding that wastes half the height.
- Reusing a 1080×1080 post CSS with only the height token changed.

## Instagram square - 1080×1080

Feed post. One claim. Type can be smaller than a story because the card is already short.

## Instagram portrait - 1080×1350

4:5 feed. Still a post, not a story.

When the user asks for the same piece in several sizes, write **one composition per size**. Do not letterbox. Adapt type scale and stack to the new ratio.