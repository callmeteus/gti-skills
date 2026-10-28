# Pass 5: Typography and copy

## Goal

Text that informs instead of shouting: calm weights, sentence case, numbers with context, and headers that say something.

## Before and after in the source

| Element | Before | After |
|---------|--------|-------|
| Product name | `EmberAI` with a `PRO` tag | `Ember` |
| Page title | `Welcome back, Damir!` with a waving hand, bold | `October 2026`, regular weight, year in a muted color |
| Search placeholder | `Search anything...` | `Search` |
| Section labels | `NAVIGATION`, `PLANS` in tracked caps, with an emoji | `Navigation`, `Plans` in a small muted monospace |
| Card titles | `PAID THIS MONTH`, `REVENUE` in tracked caps, with an emoji | `Paid this month`, `Revenue` in sentence case |
| Big numbers | Heavy bold | Regular or medium weight, larger size |
| Trend line | `+12%!!` with a fire emoji | `+12% vs last month`, number in green, comparison muted, monospace |
| Trend line | `+4.2% this month!!` with a rocket emoji | `4.2% ↑ vs September` |
| Overdue trend | `3 less` with an emoji | `3 fewer` (grammar fixed) |
| Nav counts | Red pill badge `12` | Plain muted `12` |
| Plan counts | Violet pills with a person icon (`18`, `1.2k`) | Plain muted monospace numbers |
| Nav extras | `New` badge with a sparkle | Removed |

### Numbers that change

A second source, a clip by Nexvyn, shows a running timer `00:01.23` side by side. With the font's default proportional digits, each digit has its own width, so the timer box changes width as it counts and the text shifts (the clip measures it at 173.7px wide, moved 29.9px). With `font-variant-numeric: tabular-nums`, every digit has the same width: the box is 186.7px wide and moved 0.0px.

```css
.timer {
  font-variant-numeric: tabular-nums;
}
```

In Tailwind, the same rule is the `tabular-nums` class.

## Steps

1. Use at most two families: the existing UI font, plus a monospace for numbers, metadata, and section labels if it suits the product. Do not introduce a display font.
2. Limit weights to regular and medium (or semibold for one level). Make large numbers large, not heavy.
3. Convert all-caps labels to sentence case. Keep caps only for real abbreviations.
4. Remove exclamation marks and emoji from labels, numbers, and status lines.
5. Give every change value a reference: `vs last month`, `vs September`, `since Monday`. Color only the value, not the sentence.
6. Replace greeting or filler headers with the most useful fact for the page, such as the period the data covers.
7. Turn decorative badges into plain text when they only show a count. Keep a badge only when it signals state the user must act on.
8. Remove hype words, "AI" suffixes, and tags that are not features. Fix grammar ("fewer", not "less", for countable items).
9. Use tabular figures (`font-variant-numeric: tabular-nums`, Tailwind `tabular-nums`) for numbers that change in place (timers, counters, prices, live stats, progress percentages, animated count-ups) and for numbers that line up in columns. Proportional digits make a changing number wobble and a column of numbers misalign. Apply it to the number element, not to the whole page, so running text keeps its proportional figures. A monospace number font already has equal digit widths.

## Check

- No exclamation marks, emoji, or tracked caps remain in the UI copy.
- Every trend value says what it is compared to.
- The page title tells the user something they did not already know.
- No number that updates in place shifts sideways while it changes.
