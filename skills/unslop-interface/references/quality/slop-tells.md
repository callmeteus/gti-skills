# Slop tells

Use this list twice: to inventory the screen before the first pass, and to check it after the last one. Every row seen in the source "before" frame is marked **Source**; rows from the clips by Nexvyn and Emil Kowalski are marked **Source (Nexvyn clip)** and **Source (Kowalski clip)**. Rows marked **Common** are frequent in generated UIs but not shown in the source clip.

## Spacing and layout

| Tell | Seen in | Pass |
|------|---------|------|
| Gaps between sections and items with no shared scale (13, 26, 30, 38, 44, 46px on one screen) | Source | 01 |
| Uneven rhythm in a list: some rows far apart, others tight | Source | 01 |
| Content in neighboring panels starting at different left edges | Source | 01 |
| Content inset from the panel edge that differs between sections | Source | 04 |
| Stacked blocks whose edges miss each other by a few pixels (a map 2px in from the search field above it) | Common | 01 |
| A block off the page's column lanes, leaving a dead band beside it (a header card that misses the column below) | Common | 01 |
| A wrapping chip or filter row whose first line ends short of the full-width blocks around it | Common | 01 |
| A tall page band that holds only the title, then a wide empty gap | Common | 01 |
| A map or large panel with a wide gap above and a tight gap below (a paragraph margin added to the parent gap) | Common | 01 |
| Cards of one component whose parts drift: the price sits lower in one card because its tag row wrapped | Common | 01 |
| Instances of one component in a row with different widths or heights | Common | 01 |

## Shape

| Tell | Seen in | Pass |
|------|---------|------|
| Pill-shaped search fields, nav items, and badges next to rounded rectangle cards | Source | 02 |
| Many unrelated radius values on one screen | Source | 02 |
| Large cards and sheets whose corners start their curve abruptly where smoothing is supported | Common | 02 |
| One-side accent border on a rounded card, curving around the corners into a crescent | Common | 02 |
| Accent border inside a card that already has one, stacking two curved strokes | Common | 02 |
| Fully rounded bars in charts used as decoration | Source | 06 |

## Color and effects

| Tell | Seen in | Pass |
|------|---------|------|
| Purple or violet gradient page background | Source | 03 |
| Gradient text in headings and numbers | Source | 03 |
| Gradient fill on the active nav item or primary button | Source | 03 |
| Outer glow or colored shadow on cards, bars, and badges | Source | 03 |
| Tinted, semi-transparent "glass" cards with colored borders | Source | 03 |
| Every badge in a saturated accent color | Source | 03 |
| One bar in a chart highlighted for no stated reason | Source | 06 |
| Rainbow accents with no meaning | Common | 03 |
| Raw hex, `rgb()`, or Tailwind palette classes (`bg-red-500`) in components instead of semantic tokens | Common | 03 |
| A semantic color used for something else (danger red as a category, success green as decoration) | Common | 03 |

## Icons and decoration

| Tell | Seen in | Pass |
|------|---------|------|
| Emoji used as icons in navigation, labels, and stats | Source | 04 |
| Sparkle emoji or sparkle logo, "AI" in the product name | Source | 04, 05 |
| Logo set inside a glowing gradient tile | Source | 03 |
| Decorative emoji per category where a color key would carry information | Source | 04 |
| Icons that are not on one vertical line | Source | 04 |
| Main action and secondary link set as the same plain text, external links with no arrow | Source (Kowalski clip) | 04 |
| Icons or labels in one list that start at different x positions | Pritam Paul (/gridlines) | 04 |
| Section headers aligned to the labels instead of the icon edge | Pritam Paul (/gridlines) | 04 |
| Toolbar controls on different center lines (a select 4px higher than the button next to it) | Pritam Paul (/gridlines) | 04 |
| One row nudged with its own margin instead of fixing the shared row or the container | Pritam Paul (/gridlines) | 04 |
| Hand-drawn inline SVG or image-file icons with no icon library (suggest one, do not swap it in) | Common | 04 |

## Type and copy

| Tell | Seen in | Pass |
|------|---------|------|
| "Welcome back, Name!" with a waving hand as the page title | Source | 05 |
| Exclamation marks in data ("+12%!!", "this month!!") | Source | 05 |
| Emoji in front of numbers and trends | Source | 05 |
| ALL CAPS, wide tracked section labels and card titles | Source | 05 |
| Heavy bold on every number | Source | 05 |
| Timer, counter, or live value that wobbles sideways as its digits change (proportional figures) | Source (Nexvyn clip) | 05 |
| Change values with no comparison ("+12%" vs what?) | Source | 05 |
| Placeholder copy such as "Search anything..." | Source | 05 |
| "New" badges and "PRO" tags that carry no information | Source | 05 |
| Counts wrapped in colored pill badges with a person icon | Source | 05 |
| Filler marketing copy ("Supercharge your workflow") | Common | 05 |
| Paragraphs with heading-tight line height (around 1.2) | Source (Kowalski clip) | 05 |
| Decorative ligatures in body or UI text | Source (Kowalski clip) | 05 |
| A tagline under every page title, restating it ("Settings" / "Manage your account settings") | Common | 05 |
| Chips, tags, and metadata shown as underlined links | Common | 05 |
| A heading that leaves one word alone on its last line | Common | 05 |
| Stacked nouns, things doing human actions ("The dashboard wants..."), and long, passive sentences in UI copy | Common | 05 |
| Three dots instead of `…`, hand-built date and money formats | Common | 05 |
| A section heading that repeats the page title ("Auctions" over "Auction for attendees"), and tags that repeat the heading again ("Attendees only") | Common | 05 |
| Helper text that narrates the interface: what each control does, how the feature works inside, what it is not | Common | 05 |
| One word of a heading in another color, italic, or gradient | Anthropic frontend-design | 05 |
| An arrow (→) appended to button and link text | Anthropic frontend-design | 05 |
| Numbered markers (01 / 02 / 03) on content that is not a sequence | Anthropic frontend-design | 05 |
| Metadata joined with middle dots everywhere ("A · B · C") | Anthropic frontend-design | 05 |
| Vague verbs ("Submit", "Continue") and one action with several names (delete, remove, trash) | Junaid-PK frontend-design | 05 |
| Errors that apologize or say "Something went wrong" with no way to recover | Anthropic frontend-design | 05 |

## Data display

| Tell | Seen in | Pass |
|------|---------|------|
| Chart with no axis values or units | Source | 06 |
| Chart whose colors do not relate to anything else on the screen | Source | 06 |
| Clip-art illustration (emoji credit card) in a stat card | Source | 06 |
| Scrolling table whose header row scrolls out of view | Source (Kowalski clip) | 06 |
| A row of equal cards with big numbers and no comparison, target, or trend | wshobson kpi-dashboard-design | 06 |
| More than seven headline KPIs, vanity metrics such as total page views | wshobson kpi-dashboard-design | 06 |
| A dashboard titled "Dashboard" or "Overview" with no period and no question | wshobson kpi-dashboard-design | 06 |
| 3D charts, a gauge for every KPI, or a pie with more than five slices | ui-ux-pro-max, kpi-dashboard-design | 06 |
| A chart type picked for variety (a donut for a trend, a line for categories) | ui-ux-pro-max | 06 |
| Red and green as the only cue for good and bad | ui-ux-pro-max, kpi-dashboard-design | 06 |
| No date range, no last update time, and no way to see how a number is calculated | wshobson kpi-dashboard-design | 06 |
| A big number with a small label and a gradient accent as the default hero | Anthropic frontend-design | 06 |
| Records people compare (invoices, users) shown as a grid of cards instead of a table | Junaid-PK frontend-design | 06 |

## Actions and structure

| Tell | Seen in | Pass |
|------|---------|------|
| A full form (fields and buttons) inside every card of a list | Common | 07 |
| A large filled primary button on every card, many primaries on one screen | Common | 07 |
| A second form for an advanced option (auto-bid next to bid) instead of a toggle inside the first | Common | 07 |
| Actions shown in states where they cannot apply ("Cancel auto-bid" with no auto-bid on) | Common | 07 |
| Limits and values buried in a sentence ("Minimum bid: R$ 50,00 Maximum: R$ 1.000,00.") | Common | 07 |
| The same notice in every card ("This auction is for attendees only... Get a ticket") instead of once above the list | Common | 07 |
| Every card repeating the facts its section heading already shows ("Attendees only", "Online or local") | Common | 07 |
| A boxed panel of filter chips or links (more options than the list has items) instead of one row of selects | Common | 07 |
| The same filter in two groups ("Online" and "Pagamento online"), or a filter that repeats the page's sections | Common | 07 |
| Tags in every card that link to the filter options | Common | 07 |
| A filter panel restyled (new grid, bigger chips) instead of turned into one row of selects | Common | 07 |
| A "New <item>" form always open under the list, and no "+" button in the page header | Admin panels | 07 |
| A table with only its header row when there is no data, and no empty state | Admin panels | 07 |
| Labels beside their fields, so every field starts at a different edge | Admin panels | 07 |
| Free text boxes for fixed choices (driver, channel, status) | Admin panels | 07 |
| A raw JSON text box for settings | Admin panels | 07 |
| An unlabeled select next to the page title ("Even7"), or a select with one option | Admin panels | 07 |
| A "Refresh" button on a page that reloads after each change | Admin panels | 07 |
| Eyebrow, page title, and card title that repeat one word ("MENSAGENS", "Mensagens SMS", "Mensagens") | Admin panels | 07 |
| Every block cut into identical rounded cards with the same soft shadow | Anthropic frontend-design | 07 |
| A short form in a mostly empty side panel | Junaid-PK frontend-design | 07 |
| An endless scroll on a page people work in, with no count and no stopping point | Junaid-PK frontend-design | 07 |
| Status, refresh, and actions in a row under the title, with the title row empty on the right | Admin panels | 07 |
| "Complete" and "Cancel" as two big buttons instead of one "Actions" menu | Admin panels | 07 |
| A line at the bottom explaining how the page refreshes | Admin panels | 07 |
| Result, updates, and log as stacked cards, each empty, instead of tabs | Admin panels | 07 |
| The same value (agent, runner) in two or three cards, and the status said three ways | Admin panels | 07 |
| Values cut with an ellipsis and no tooltip, empty fields shown as a dash placeholder | Admin panels | 07 |
| A "New ..." row styled as one more item at the end of the list it adds to | Admin panels | 07 |
| The user as a text name and a text "Sign out" row, with no avatar | Admin panels | 07 |

## States and feel

| Tell | Seen in | Pass |
|------|---------|------|
| A spinner in an empty box where the content shape is known | Common | 08 |
| Images that load into an empty gray box, or with no size so the page jumps | Common | 08 |
| A like, save, or toggle that waits for the server before it changes | Common | 08 |
| An "Are you sure?" popup for a delete the user could undo | Common | 08 |
| A hard cut from a tapped card to its screen | Common | 08 |
| A sheet or drawer that closes only with an X | Common | 08 |
| A verification code typed digit by digit into separate boxes with no `one-time-code` autofill | Common | 08 |
| `transition: all`, or motion that ignores `prefers-reduced-motion` | Common | 08 |
| Controls with no hover or `:focus-visible` state, or `outline: none` with no replacement | Common | 08 |
| Fade-and-slide-up entrances on every section, hover lifts on every card | Anthropic frontend-design | 08 |
| A refresh button with no busy state while it loads | Admin panels | 08 |

