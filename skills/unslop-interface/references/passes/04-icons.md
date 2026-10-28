# Pass 4: Icons and alignment

## Goal

One icon family, one icon size, and one icon column, so the eye can scan labels in a straight line.

## Before and after in the source

The clip overlays two guides on the sidebar: the inset from the panel edge to the icon, and the gap from the icon to the label.

| Guide | Before | After |
|-------|-------:|------:|
| Panel edge to icon column | 13px | 16px |
| Icon to label gap | 8px | 10px |

Other changes in this pass:

- **Nav icons:** emoji (house, inbox tray, rocket, people, money, chart) become one outlined line icon set (grid, inbox, layers, users, receipt, trend line), all the same size and stroke.
- **Plan list:** emoji per plan (building, briefcase, lightning, sprout, gift) become small color dots. The dots are a key that the chart reuses in pass 6.
- **Header:** the sparkle logo in a gradient tile becomes a simple monochrome mark; the notification bell emoji becomes a line icon (a sidebar toggle in the source); the page title emoji becomes a line icon.
- **Expandable items:** items with children (Projects, Customers, Invoices) get a small chevron on the right.
- **Search:** the shortcut hint becomes separate keycaps.

### Affordance

A third source, a clip by Emil Kowalski, shows a trial card ("Your trial ends in 3 days") with two actions, `Upgrade` and `Compare plans`, set as identical plain text. With affordance, `Upgrade` becomes a filled button and `Compare plans` becomes an underlined link with a small external arrow (↗). The clip defines affordance as the visual signal that tells you how something can be used: a button looks like a button, and an external link has an external icon.

## Steps

1. Pick one icon library already in the project (for example Lucide, Heroicons, Phosphor, Tabler, or SF Symbols). If none exists, ask the user before adding a dependency, or use inline SVG.
2. Replace every emoji used as an icon with an icon from that set. Use one size and one stroke width.
3. Fix the icon column: the same inset from the panel edge for every row and section header, and the same gap between icon and label.
4. Where icons only decorate a category, replace them with something that carries information, such as a color dot that matches the category's color elsewhere on the screen.
5. Add affordance icons where behavior needs them (chevrons for expandable rows, an external arrow on links that leave the product), and nowhere else.
6. Give every action the look of what it does: the main action is a button, a navigation is a link, and two different actions never share the same plain-text style.

## Check

- No emoji remain as icons.
- Every action looks clickable, and a button and a link are never styled the same.
- A vertical line touches the left edge of every icon, and another touches the start of every label.
