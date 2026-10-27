# Pass 3: Color and effects

## Goal

A neutral base where color only appears when it means something: a status, a trend, a category key, or the brand mark.

## Before and after in the source

- **Before:** a purple gradient page background, violet-tinted glass cards with colored borders, a purple to blue gradient on the active nav item, a logo in a glowing gradient tile, gradient heading and number text, glowing violet chart bars with one bar highlighted, and saturated pill badges (red, violet).
- **After:** a gray page background, near-black panels and cards with a thin neutral border, a dark gray active nav item, white heading and number text, gray chart bars with no glow, and neutral dark badges. Green stays only on the positive trend values.

## Steps

1. Remove every `linear-gradient`, `radial-gradient`, `bg-gradient-*`, `bg-clip-text`, and `text-transparent` used for decoration.
2. Remove glow: colored `box-shadow`, `drop-shadow`, `shadow-<color>-*`, and `blur` used as light effects. Keep at most one subtle neutral shadow for raised surfaces.
3. Replace tinted, transparent card backgrounds with solid neutral surfaces and a 1px neutral border.
4. Build a neutral ramp of about five steps (page, panel, raised surface, border, muted text) plus the primary text color. Reuse the project's gray scale if it has one.
5. Keep semantic colors only: success, warning, danger, and category colors that a legend explains. Pick one brand accent at most, and use it sparingly.
6. Check text contrast on the new surfaces; muted text must still be readable.

## Check

- No gradient remains except where it encodes data.
- Every colored element can answer "what does this color mean?".
- The screen still reads correctly in grayscale.
