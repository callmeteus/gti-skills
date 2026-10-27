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

## Check

- No spacing value outside the scale remains in the component.
- A vertical line drawn at the content edge touches the heading, every card, and the card text.
- Lists have an even rhythm.
