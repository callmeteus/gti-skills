# lintapple: Measured UI Checks

lintapple opens the rendered page in Chromium (through Playwright) and measures it against a fixed policy: fonts and type sizes, control size, gaps and insets, layout gaps and alignment, nested radii, tabular numbers, viewport bounds, clipping and overflow, text contrast, and accessibility (names, labels, focus, keyboard, dialogs, tooltips, target size). Every finding has the element, the measured value, the expected value, and a fix.

This file is shared by the Frontend Design Review and Unslop Interface skills; it is synced from `packages/lintapple/agent` in gti-skills.

## When to run it

- **A rendered page exists:** a dev server, a preview URL, or a static HTML file. lintapple checks rendered pixels, not source code, so it cannot run on a screenshot or on code that does not run.
- **Before and after:** run it before changing anything to get a baseline, and again after the changes to show what was fixed and that nothing new broke.
- **Never against production you do not own.** Use the local dev server or a preview the user points to.

## Run it

```bash
node <skill-dir>/scripts/lintapple/run.mjs http://localhost:3000 --project .
```

| Option | Use |
|--------|-----|
| `--project DIR` | The app's folder (default: current folder); its `ui-policy.json` and `node_modules/lintapple` are used when present |
| `--config FILE` | A policy file to use instead |
| `--ready SELECTOR` | Wait for this selector before checking a page that loads asynchronously |
| `--interactions FILE` | A lintapple interaction plan, to check open menus, dialogs, and other states |
| `--out FILE` | Where to save the full JSON report (default: `~/.gti/lintapple/<project>/`) |
| `--top N` | How many problem groups to print (default 15) |
| `--write-policy FILE` | Write the default policy to FILE so you can adapt it |
| `--where` | Show which lintapple will run |

The script prints a summary (problems by rule, then the top groups with selector, actual, expected, fix, and where they were seen) and the path of the full report. Exit codes: `0` passed, `1` findings or unresolved checks, `2` the check did not finish.

It uses, in order, the project's own `lintapple`, the copy installed with gti-skills, or `npx lintapple@<version>` from npm. It needs Node.js 22 or later and Chromium for Playwright; if Chromium is missing, the script prints the one command that installs it. Nothing is written into the project.

## Probe unmarked layouts

lintapple measures alignment, layout gaps, and nested radii only on elements with `data-ui-*` markers, and a generated interface has none. Run the probe on every page as well. It needs no markers and no policy:

```bash
node <skill-dir>/scripts/lintapple/probe.mjs http://localhost:3000 --project .
```

| Rule | What it measures |
|------|------------------|
| `near-miss-edge` | Two blocks stacked in one column, or side by side in one row, whose left, right, or top edges are 2 to 12px apart. Text blocks are measured at the first glyph, not the box |
| `off-lane` | A wide surface whose left or right edge sits 13 to 64px from a column edge that other blocks in the same container share. It leaves dead space next to it, as a header card that does not line up with the column below |
| `ragged-wrap` | A wrapping flex row (chips, tags, filters) whose first line ends short of the container edge |
| `curved-accent` | A one-side accent border (for example `border-left: 4px`) on a box with rounded corners on that side. The stroke bends around the corners into a crescent |
| `nested-accent` | An accent border inside a box that already has one |
| `uneven-gap` | A large block (map, chart, image, big panel) with different space above and below it, as 56px between the intro and a map but 12px between the map and the search field. Maps and other ignored widgets count as blocks |
| `uneven-siblings` | Two or more instances of one component (same tag and classes) in one row with different widths or heights |
| `misaligned-parts` | Matching parts of instances in one row at different heights, as a price that sits lower in one card because the tag row above it wrapped. The finding names the earlier part whose height differs, which is usually the cause |
| `repeated-form` | Form fields inside every item of one list or grid |
| `competing-primaries` | More than two filled, saturated buttons in the first viewport |
| `repeated-item-text` | Text every item of a list repeats: a notice of 30 characters or more ("This auction is for attendees only"), or a fact the list's heading area already states ("Attendees only" on the section and on every card). Button labels do not count |
| `underlined-control` | Chips, tags, or buttons (a border or fill) that also underline their text, or eight or more short underlined links outside running text, header, and footer (metadata shown as links) |
| `duplicate-filter` | Filter options in different groups that share a key word ("Online" and "Pagamento online"), or a filter option that repeats a split two or more section headings already make |
| `filter-link-in-item` | Links inside list items that repeat the filter options, by link target or by label |
| `filters-outweigh-items` | More filter chips or links than items to filter, as 11 filter chips over 4 auction items. A compact row of selects does not count, and select options are still checked by `duplicate-filter` |
| `lonely-word` | A heading or short text that wraps and leaves one word alone on its last line, without `text-wrap: balance` or `pretty` |
| `transition-all` | Elements that animate with `transition: all` |
| `repeated-heading` | Two headings with the same text, a heading that restates the heading above it ("Auctions" over "Auction for attendees"), short text under a heading that only repeats its words (an "Attendees only" tag), or an eyebrow right above a heading that only repeats it ("MENSAGENS" over "Mensagens SMS"). Card titles in a grid of items are not compared with the page heading |
| `icon-column` | In one list of three or more rows with an icon and a label (sidebar, menu, tab list), icons that start off the common icon line, labels that start off the common label line, or section headers that do not start on the icon line |
| `toolbar-center` | Two or more controls in one flex row whose vertical centers differ by more than 1.5px |
| `kpi-without-context` | KPI cards (a number of 24px or more in one of three or more sibling cards) with no comparison, target, trend line, or progress bar |
| `too-many-kpis` | More than seven KPI cards in the first viewport |
| `chart-without-labels` | An SVG chart of 240 by 120px or more, with three or more marks, no text inside it, and no number next to it where axis labels would be. Canvas charts are not measured |
| `arrow-suffix` | Two or more links or buttons whose text ends with an arrow (→, ->) |
| `accent-word` | An h1 or h2 with one word or phrase in another color, italic, or gradient text |
| `status-actions-apart` | Two or more buttons near the page title that change the item's status (complete, cancel, archive, approve, reject, delete) |
| `header-controls-below-title` | Two or more status or action controls in a row under the page title while 240px or more to the right of the title is empty |
| `behavior-footnote` | Page text that explains how the page refreshes ("a cada 5 segundos", "updates automatically") instead of a tooltip |
| `repeated-value` | The same value of 8 to 60 characters in two or more cards. A value in the same kind of block in cards of one repeated component (a list) does not count |
| `stacked-output-panels` | Two or more stacked panels with headings that are empty or waiting ("Aguardando", "Nenhuma", "No ... yet") |
| `truncated-without-tooltip` | Text cut with `text-overflow: ellipsis` and no `title`, `aria-label`, or tooltip on it or its parents |
| `empty-list-without-message` | A table with column headers and no data rows, and nothing after it that says it is empty |
| `open-create-form` | A form with two or more fields and a create button ("Criar", "Create", "Add", "New") that is always open, outside a dialog or closed disclosure, on a page that shows a table or a list of three or more items |
| `ragged-form-labels` | Labels placed beside their fields, so fields in one column start at different x positions |
| `raw-json-field` | A text box or text area whose value or placeholder is JSON |
| `unexplained-control` | A select with one option, a select with no label whose shown option does not name its facet ("All channels"), or an input with no label and no placeholder |
| `off-token-color` | A rendered text, background, or border color that equals none of the color custom properties the page defines. Colors are compared by value with opacity ignored, so a raw color that happens to equal a token passes; the source scan below catches it. With no color tokens on the page, the rule is skipped with a note |

| Option | Use |
|--------|-----|
| `--viewport WxH` | Repeat to probe several sizes (default `1440x900` and `390x844`) |
| `--ready SELECTOR` | Wait for this selector before measuring |
| `--ignore SELECTOR` | Skip a region; maps, charts in SVG, and `[role=application]` are skipped already |
| `--near PX`, `--lane PX` | Change the 12px near-miss and 64px lane distances |
| `--json` | Print every finding as JSON |

Each finding lists the elements with their position, the measured value, and a fix. The probe measures geometry; it does not know intent. Treat a finding as a defect unless the offset is a deliberate step on the spacing scale or the design system defines it, and say which. The edge checks compare only boxes in one page region (header, nav, main, footer, aside) and within 400px of each other, and they skip items of wrapping rows, so a header link and a footer logo never count as a near miss. Exit codes: `0` no findings, `1` findings, `2` the probe did not finish. A page that answers HTTP 400 or higher is not measured and exits `2`: an error page is not the interface, so fix the error first.

## Map every page

For a full review, map the app first: `node <skill-dir>/scripts/lintapple/crawl.mjs <url>` follows the links each rendered page shows, groups URLs into route patterns (`/tasks/:id`), visits one sample per pattern, and writes `pages.md` and `pages.json` to `~/.gti/lintapple/<project>/`. It stays on the start origin, never follows sign-out or delete links, and never submits a form. Options: `--max N` (default 200 patterns), `--depth N` (default 6), `--storage-state FILE` (a Playwright storage state for pages behind a login), `--include REGEX`, `--exclude REGEX`, `--keep-query` (treat query strings as different pages), `--out DIR`, `--json`. Each row lists the states to review on that page: tabs, dialogs, menus, forms, and tables. Combine it with the routes read from the source, because a crawl misses pages no link points to.

## Compare before and after

`snapshot.mjs` captures every labeled element and painted surface of a page (position, size, radius, colors, border, font size and weight, shadow, text) and a full-page screenshot. Run it before the changes and again after them to list what changed per element, the way a reviewer would read a UI pull request:

```bash
node <skill-dir>/scripts/lintapple/snapshot.mjs <url> --name before
node <skill-dir>/scripts/lintapple/snapshot.mjs <url> --compare ~/.gti/lintapple/<project>/snapshots/before.json
```

The second run prints lines such as `button "Save": width 72 -> 120; radius 6 -> 14` plus the elements added and removed, and the paths of both screenshots. Elements are matched by tag, label, and order, not by class names, so a refactor that renames classes still lines up. Output goes to `~/.gti/lintapple/<project>/snapshots/` (`--out` changes it), never into the project. Options: `--viewport WxH` (default `1440x900`), `--ready SELECTOR`, `--project DIR`, `--json`. A page that answers HTTP 400 or higher is not captured.

## Scan the source for colors outside tokens

The probe sees rendered values; the scan reads the code. It finds every color that does not come from a token: hex and `rgb()`, `hsl()`, `oklch()` literals, Tailwind palette classes (`bg-red-500`, `text-white`), and arbitrary values (`bg-[#7c3aed]`). It also lists the color tokens the project defines and the semantic roles that have none.

```bash
node <skill-dir>/scripts/lintapple/tokens.mjs src
```

| Option | Use |
|--------|-----|
| `--allow TEXT` | Also skip files whose path contains TEXT, for a token file with another name. The Tailwind config and files with `token` or `theme` in the path are skipped already |
| `--json` | Print the full report as JSON |

Token definitions (`--primary: #2563eb;`) are allowed anywhere; comments, `url()`, tests, stories, and build output are skipped. The roles checked are primary, secondary, info, warning, danger, success, muted, surface, text, and border, under their common names (`destructive` and `error` count as danger, `foreground` as text, `background` and `card` as surface). Exit codes: `0` clean, `1` colors outside tokens or missing roles.

## Adapt the policy first

The default policy expects Apple system fonts and a fixed type scale, so on most projects it reports every font as wrong. Before trusting font, size, gap, or inset findings:

1. If the project has a `ui-policy.json`, use it (the script does this automatically).
2. Otherwise write the default into `~/.gti/lintapple/<project>/` and adapt it to the project's design system, never to the project folder unless the user wants lintapple adopted:

   ```bash
   node <skill-dir>/scripts/lintapple/run.mjs --write-policy ~/.gti/lintapple/<project>/ui-policy.json
   ```

   - `fonts`: the font stacks the design system uses.
   - `fontSizes` and `typeRules`: the type scale, and per-role sizes (`h1`, `h2`, buttons).
   - `minControlGap`, `minControlInset`, `minLayoutGap`: the spacing scale's smallest steps.
   - `viewports` and `colorSchemes`: the breakpoints and themes the product supports (add `"dark"` when it has a dark theme).
   - `bannedCopy`: phrases to flag; add the generic marketing phrases the review cares about.
3. Pass it with `--config ~/.gti/lintapple/<project>/ui-policy.json`, and say in the review which values you chose and why.

## Read the findings

- **Confirmed failures** are measurements: treat them as facts about the page, then decide severity with the skill's own rules.
- **Unresolved checks** (they also exit `1`) need a human look; report them as "to verify", not as failures.
- **Coverage notes** matter: child frames are not checked, and some control content (native selects, CSS images, pseudo-elements) is listed as unmeasured. Unmeasured is not a pass.
- **Layout checks need markers.** Gaps inside stacks and button groups, alignment, nested radius, and tabular numbers are measured only on elements marked with `data-ui-stack`, `data-ui-actions`, `data-ui-container`, `data-ui-align`, `data-ui-radius`, `data-ui-number`, or matched by policy selectors. An unmarked page passing those rules proves nothing about them; the probe above covers alignment and accents without markers.
- **Not everything is measurable.** Visual hierarchy, taste, copy quality beyond banned phrases, and whether the design fits the product still need the skill's review.

## Rules by area

| Area | Rules |
|------|-------|
| Typography | `font-family`, `font-size`, `font-loading`, `tabular-numbers`, `numeric-alignment` |
| Copy | `copy` (banned phrases) |
| Controls | `control-size`, `control-gap`, `control-inset`, `target-size`, `icon-size`, `icon-button-tooltip` |
| Spacing and layout | `content-inset`, `layout-gap`, `layout-alignment`, `nested-radius` |
| Page bounds | `root-background`, `horizontal-overflow`, `viewport-bounds`, `content-clipping`, `content-overflow` |
| Color | `text-contrast` |
| Accessibility | `accessible-name`, `form-label`, `aria-reference`, `label-consistency`, `control-state`, `keyboard-operation`, `focus-visible`, `focus-obscured`, `dialog-focus` |

## Adopting it in the project

When the user wants these checks to keep running, offer to adopt lintapple in the project. It changes the project, so ask first:

```bash
npm install -D lintapple && npx lintapple init
```

This adds `ui-policy.json` and a `lint:ui` script. In Playwright tests, `import { expectUI } from 'lintapple/playwright'` and `await expectUI(page, testInfo)` after the page is ready fail the test on findings. Add the `data-ui-*` markers to the components whose spacing and alignment should be enforced.
