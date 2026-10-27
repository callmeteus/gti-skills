# Pass 6: Data display

## Goal

Charts and illustrations that carry information and tie into the rest of the screen.

## Before and after in the source

- **Revenue chart, before:** seven rounded violet bars labeled `MON` to `SUN`, no axis values, and one bar (`THU`) highlighted in a lighter color with glow for no stated reason. After pass 3 the bars are gray, but still unlabeled.
- **Revenue chart, after:** a series chart over months (`Aug` to `Jan`) with a value axis (`0` to `160k`), one curve per plan in the same colors as the plan dots in the sidebar, and a mirrored set of gray curves below the axis for a second measure. The colored curves have a soft glow, the only glow kept on the screen, and it sits on the data.
- **Stat card illustration, before:** a small emoji-style credit card.
- **Stat card illustration, after:** a rendered, monochrome card illustration (dark cards with a chip and the last four digits) that matches the neutral palette.

## Steps

1. Ask what the chart must answer, and pick the chart type for that question (trend over time, comparison, share). Do not keep a chart type only because it was generated.
2. Label the axes with values and units. Use short, readable tick labels (`80k`, `Sep`).
3. Use category colors that already mean something on the screen, such as the legend dots from pass 4. A legend or matching key is required when there is more than one series.
4. Remove decorative highlighting. Highlight a data point only when the copy explains why.
5. Keep shapes plain: no fully rounded bars or decorative effects unless they help read the data.
6. Replace clip art and emoji illustrations with nothing, or with an illustration in the screen's own palette and style.
7. Use the project's charting library. Do not add one without asking.

## Check

- Every chart has labeled axes and units.
- Every color in a chart maps to a key the user can see.
- No illustration uses emoji or a style that clashes with the palette.
