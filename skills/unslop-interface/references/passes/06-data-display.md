# Pass 6: Data display and dashboards

## Goal

Charts, tables, and illustrations that carry information and tie into the rest of the screen, and dashboards that answer one question: the reader sees the few numbers that matter, what each is compared to, and where to look next.

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
8. In a table that scrolls inside its container, make the header row sticky (`position: sticky; top: 0` with a background) so the column names stay visible. The Emil Kowalski clip shows an invoice table (Invoice, Customer, Amount) whose header scrolls away without it.
9. Do not show an empty value as a number. An auction with no bids shows its starting bid (`Starting bid R$ 50,00`) or `No bids yet`, not `Current bid R$ 0,00` above `No bids yet`. A zero is data only when zero is a real measured value.
10. Use a table for records people compare (invoices, users, orders, messages), not a grid of cards. Cards fit items people browse one at a time; a table fits values read across rows and sorted by column. Right-align numbers, keep one row height, and move rare row actions into an overflow menu.

## Dashboards

A generated dashboard is a row of equal cards with big numbers, a decorative chart, and no question behind it. Rebuild it from what the reader decides.

### Steps

11. Name the dashboard's one question and its reader (an executive checking the month, a team watching live service health, a product manager reading retention). The title says the scope and period ("Revenue, November"), not "Dashboard" or "Overview".
12. Keep four to six headline KPIs, chosen for that question. A KPI is specific, measurable, and tied to a decision; drop vanity numbers (total page views, total sign-ups since launch) and move the rest to a detail view, a tab, or a table below. More than seven equal cards has no headline.
13. Give every KPI context. Each number carries its period and at least one comparison: a delta against the previous period ("+8% vs October"), a target ("72 of 100"), or a small trend line. Color the delta by what is good for that metric (churn going up is bad, cost going down is good), and add a sign or arrow so color is never the only cue. Use one precision per row, compact units (`$2.4M`, `12.4k`), and tabular figures.
14. Lay the page out from summary to detail: the headline KPIs, then the trend that explains them, then breakdowns (by product, region, channel), then the detail table. Each KPI links to the view that explains it, and filters on the page apply to every chart.
15. Pick the chart for the data, not for variety:

| Data | Chart | Not when |
|------|-------|----------|
| Trend over time | Line (area for one series) | Fewer than 4 points (use the number), more than 6 series |
| Compare categories | Bar, sorted by value | More than 15 categories (use a table), a time axis (use a line) |
| Part of a whole | Stacked bar, or a donut with 5 slices or fewer | Slices differ by under 5%, readers need exact values |
| Value against a target | Bullet chart, or a progress bar | No target exists; 3 or more KPIs (use a row of bullet charts, not gauges) |
| Stages with drop-off | Funnel | Fewer than 3 stages, or stages that are not sequential |
| Spread and outliers | Box plot or histogram | Fewer than 20 points per group |
| Activity by hour and day | Heat map | Readers need exact values, or color is the only cue |

    Never use 3D charts, gauges for every KPI, or a pie with more than five slices.
16. Make every chart readable on its own: value and time labels with units, a legend or direct labels for more than one series, a tooltip with the exact value, and patterns, labels, or shapes in addition to color. Keep one accent for the series that matters and gray for context.
17. Show where the numbers come from. Put the date range control in the page header with the active range visible, add "Updated 10:42" (and "Live" with a pause control for real-time data), and give each KPI a short "How it is calculated" note in a tooltip or the detail view. Two cards that disagree (MRR on the dashboard against MRR in finance) are a bug in the definition, not a design issue: name the formula.
18. Design the dashboard's states: a skeleton in the shape of each chart while it loads, "No data for this period" with a way to change the range instead of empty axes, and an error per chart with "Retry" instead of a blank page.
19. Keep alerts actionable. A short alert list says what crossed which threshold and when ("Churn 5.4%, above the 5% limit, 10:40"), with a link to the cause. Do not show an alert for every metric that moved.
20. Do not decorate the numbers. No gradient accent behind a big number, no icon in a colored circle on every card, no identical cards with the same shadow for every kind of content. Let the headline numbers be the largest text on the page and keep everything around them quiet.
21. When the app runs, measure it: `node <skill-dir>/scripts/lintapple/probe.mjs <url>` reports `kpi-without-context` (KPI cards with a number and no comparison, target, or trend), `too-many-kpis` (more than seven KPI cards in the first viewport), and `chart-without-labels` (an SVG chart with no axis values or labels). These findings are fixed, not explained. Charts drawn on a canvas are not measured; check them in the screenshot.

## Check

- Every chart has labeled axes and units.
- Every color in a chart maps to a key the user can see.
- No illustration uses emoji or a style that clashes with the palette.
- Every scrolling table keeps its header row in view.
- No empty value is shown as a zero (`R$ 0,00` for an item with no bids).
- Records people compare are in a table, not a grid of cards.
- The dashboard names its question and period, and shows four to six headline KPIs; the probe reports no `too-many-kpis`.
- Every KPI has a period and a comparison, target, or trend, with a sign as well as color; the probe reports no `kpi-without-context`.
- Every chart type fits its data, and no chart is 3D, a gauge grid, or a pie with more than five slices.
- Every chart has labels, units, and a key; the probe reports no `chart-without-labels`.
- The date range, the last update, and how each KPI is calculated are visible.
- Loading, no data, and error states exist for every chart.
