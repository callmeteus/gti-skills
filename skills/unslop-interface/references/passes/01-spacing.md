# Pass 1: Spacing

## Goal

Every gap on the screen comes from one scale, and related content shares the same edges. Spacing goes first because radius, color, and alignment decisions all depend on the final box sizes.

## Before and after in the source

The clip overlays measurements on the sidebar and main panel, first with the generated values, then with the corrected ones.

| Measured gap | Before | After |
|--------------|-------:|------:|
| Logo row to search field | 26px | 16px |
| Search field to section divider | 44px | 24px |
| Active nav item height band | 46px | 36px |
| Last nav item to the next section | 30px | 18px |
| Plan row height band | 38px | 32px |
| Panel edge to main content start | 13px | 20px |

In the "before" state the nav list also has an irregular rhythm (larger gaps around some items). In the "after" state every row in a list has the same height and the heading, stat cards, and chart card all start at the same left edge.

## Steps

1. Collect every margin, padding, and gap value in the component. In Tailwind, collect the `p-*`, `m-*`, `gap-*`, and `space-*` classes; in CSS, the raw pixel values.
2. Pick one scale. Use the project's existing scale if there is one; otherwise use multiples of 4px (4, 8, 12, 16, 20, 24, 32, 40, 48).
3. Snap each value to the scale. Smaller gaps inside a group, larger gaps between groups.
4. Give every row in a list the same height.
5. Pick one content inset per panel and apply it to the heading, cards, and card content so their left edges line up.
6. Put every block on the page's column lanes. Find the columns the main layout uses (for example a map column and a list column), and make blocks above and below them start and end on those edges. A side card in the header that sits a few dozen pixels off the column below leaves a dead band of space next to it; move it onto the column or span the column it is in.
7. Fix near misses. Two blocks in one column whose left or right edges differ by a few pixels (a map 2px in from the search field, a title 12px in from the cards) read as a mistake, never as a choice. Put them on one edge, or make the offset a clear step on the spacing scale.
8. Fix wrapped rows. A row of chips, tags, or filters that wraps leaves its first line ending short of the full-width blocks around it. Keep it on one line with horizontal scroll, move the less used items behind a More control, or lay the items on an even grid.
9. Make instances of one component match. Cards, tiles, and rows that repeat one component share one size, and their parts sit on the same rows: the title, the tags, the price, and the footer line up across a row of cards even when one card has more tags or a longer description. Use CSS subgrid (each instance spans the parent's rows with `grid-template-rows: subgrid`), give variable parts a fixed or minimum height, keep tag rows to one line with a +N overflow, and push footers down with `margin-top: auto`.
10. Give large blocks even space. A map, chart, image, or big panel has the same space above and below it, on every viewport. The usual cause of a bigger gap above is the margin of the last paragraph before the block added to the parent's gap; set the spacing once, as `gap` on the parent, and remove margins on the neighbors.
11. When the app runs, measure instead of guessing: `node <skill-dir>/scripts/lintapple/probe.mjs <url>` reports `near-miss-edge`, `off-lane`, `ragged-wrap`, `uneven-gap`, `uneven-siblings`, and `misaligned-parts` with positions, at a desktop and a phone viewport, and needs no markers.

## Check

- No spacing value outside the scale remains in the component.
- A vertical line drawn at the content edge touches the heading, every card, and the card text.
- Lists have an even rhythm.
- Every block above and below the main columns starts and ends on a column edge; no block leaves a dead band next to it.
- No two stacked blocks differ by a few pixels at an edge, and no wrapped row ends short beside full-width blocks.
- Instances of one component in a row have the same size, and their matching parts sit at the same height.
- Every large block has the same space above and below it, on desktop and on a phone.
- The probe reports no `near-miss-edge`, `off-lane`, `ragged-wrap`, `uneven-gap`, `uneven-siblings`, or `misaligned-parts` finding, or each one left is explained.
