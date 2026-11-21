---
name: unslop-interface
description: >-
  Removes the "AI slop" look from vibecoded interfaces (dashboards, admin
  panels, SaaS screens, landing sections) in eight ordered passes: spacing,
  corner radius, color, icons and alignment, typography and copy, data
  display, actions and structure, and states and feel. Edits the UI code (HTML, CSS, Tailwind, React, Vue, Svelte) or
  describes exact changes for a screenshot. Use when the user says unslop,
  de-slop, "looks AI generated", "looks vibecoded", "too much gradient",
  "make it look professional", or asks for design polish of a generated UI.
  Do not use for conversion or UX psychology reviews, full design reviews,
  accessibility audits, or building a new screen from nothing (use
  frontend-design-review for those).
metadata:
  display-name: Unslop Interface
---

# Unslop Interface

## Core Rule

Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## Autonomous Mode

When the user says to work on your own, for example "do it yourself", "faz você mesmo", "you don't need to ask me", "não precisa me chamar", or "just do it", or when the request runs unattended:

- **Do not stop for input.** Skip questions, confirmations, and pauses that wait for the user. At each decision, take the option this skill recommends, or the safest default, and note the decision and the reason.
- **Do not open anything for the user.** No browser tabs, viewers, editors, or servers started for the user to look at. Still write every file the skill produces and give the paths at the end.
- **Never take a gated irreversible or outward action** unless the request already allows it: deleting the user's data, tests, or files; publishing, posting, pushing, or sending; paying; typing credentials. List each one as pending instead.
- **Finish with one report:** the decisions you took and why, what you did, what is pending, and what you could not verify.

In this skill:

- Run every pass in order without pausing between passes. Take the before and after screenshots and measurements for the report only.
- Turn filter panels into one compact row of selects, and remove duplicate filters, filter links inside items, and repeated notices without asking; list each change in the report.
- Move an open create form behind a "+ New" button, add the empty state, and relayout the form without asking. When a select's purpose is unclear ("Even7"), read the code to name it, label it, and list it in the report.

## Output Location

Everything this skill generates (reports, notes, logs, downloads, renders, measurements, and run state) goes to `~/.gti/unslop-interface/<project>/`, where `<project>` is the repository folder name and `GTI_HOME` replaces `~/.gti`. Create the folder when needed. Never write generated files into the user's repository: only the changes the user asked for (their code, tests, or docs) go there, and a generated file goes there only when the user names that place. The unslop report and lintapple and probe output go to `~/.gti/unslop-interface/<project>/` (lintapple's own reports and snapshots default to `~/.gti/lintapple/<project>/`). Taste files live in `~/.gti/unslop-interface/taste.md` and `~/.gti/unslop-interface/<project>/taste.md`. The interface edits go into the repository.

## When to use

- The user shares a screen built by an AI tool (or in a hurry) and says it looks generic, "AI generated", "vibecoded", cheap, or noisy.
- The user asks to unslop, de-slop, clean up, polish, refine, or make a UI look professional or production-ready.
- The user points at the typical tells: purple gradients, glow, emoji icons, gradient text, pill badges everywhere, "Welcome back!" headers, exclamation marks.

Do not use this skill to change what a screen asks the user to do (use `ux-psychology-review`), for full design reviews, accessibility audits, or designing a screen from nothing (use `frontend-design-review`, which calls this skill for its slop inventory). Keep the product's structure; this skill changes how it looks and reads.

## Prerequisites

- The interface: its source code (preferred), a screenshot, or both.
- Optional: the product's brand color, font, or design tokens. When they exist, reuse them instead of inventing new ones.

No tools need to be installed for a screenshot. When the app runs, take a screenshot before and after each pass, and measure it before and after with **lintapple**, a UI linter bundled with this skill (Node.js 22+ and Chromium for Playwright). See [references/lintapple/lintapple.md](references/lintapple/lintapple.md).

## Instructions

Work through the passes in this order. Each pass fixes the ground the next one stands on: spacing before shape, shape before color, color before details. Read a pass file only when you reach it, and skip a pass when the screen has none of its tells.

1. **Inventory the slop.** List every tell you see with [references/quality/slop-tells.md](references/quality/slop-tells.md). Read the user's taste files if they exist (`~/.gti/unslop-interface/taste.md` and `~/.gti/unslop-interface/<project>/taste.md`): every Ban is an extra tell, and every Keep is never changed; see [references/quality/taste.md](references/quality/taste.md). Note the tokens the code already has (spacing scale, radius, colors, font). When the app runs, also take a measured baseline: adapt the lintapple policy to those tokens and run `node <skill-dir>/scripts/lintapple/run.mjs <url> --config <policy>` and `node <skill-dir>/scripts/lintapple/probe.mjs <url>`, run `node <skill-dir>/scripts/lintapple/tokens.mjs <source folder>` on the code, and capture the starting state with `node <skill-dir>/scripts/lintapple/snapshot.mjs <url> --name before`; add each confirmed finding to the inventory under the pass that fixes it (table below). Do not change layout, navigation items, or data yet.
2. **Spacing pass.** Replace arbitrary gaps with one scale, line up content edges across panels, put every block on the page's column lanes, fix wrapped rows that end short, give large blocks the same space above and below, and give instances of one component the same size and the same inner rows. See [references/passes/01-spacing.md](references/passes/01-spacing.md).
3. **Corner radius pass.** Reduce radii to a small set, stop using pills for inputs and nav items, straighten accent borders that curve around rounded corners, and smooth large corners where the browser supports it. See [references/passes/02-radius.md](references/passes/02-radius.md).
4. **Color pass.** Remove decorative gradients, glow, and tinted glass; move to a neutral base, keep color for meaning, and make every color come from a semantic token (primary, secondary, info, warning, danger, success, muted). See [references/passes/03-color.md](references/passes/03-color.md).
5. **Icons and alignment pass.** Replace emoji with one line icon set, put icons and labels on two guide lines with section headers on the icon line, put toolbars on one center line, fix the container instead of one item, and turn decorative category icons into data such as color dots. See [references/passes/04-icons.md](references/passes/04-icons.md).
6. **Typography and copy pass.** Calm the type, drop all-caps labels and exclamation marks, give numbers context, set tabular figures on numbers that change, replace filler headers with information, drop taglines that only restate the page title, say each thing once (no second heading or tag that repeats the heading), cut text that narrates the interface, balance line breaks, and write copy in short, plain sentences. See [references/passes/05-typography-and-copy.md](references/passes/05-typography-and-copy.md).
7. **Data display pass.** Make charts carry real information: axes, units, a legend that matches the rest of the screen, and one focus. See [references/passes/06-data-display.md](references/passes/06-data-display.md).
8. **Actions and structure pass.** Keep one filled primary per view, take forms out of list items into a modal or the detail page, fold advanced options into the main form, show state actions only in their state, say facts and notices shared by every item once above the list, turn filters into one compact row of selects and remove the ones that repeat another filter or the sections, take filter links out of list items, start creation from a "+ New" button in the page header instead of an open form, give every list an empty state, put form labels above their fields with selects for fixed choices and no raw JSON, label every control, and name the page once. Every action stays reachable. See [references/passes/07-actions-and-structure.md](references/passes/07-actions-and-structure.md).
9. **States and feel pass.** Replace spinners with skeletons and empty image boxes with placeholders, update frequent actions on tap, offer undo instead of confirm for reversible deletes, animate only transform and opacity, add the gestures and autofill people expect, and give every control hover and focus states. See [references/passes/08-states-and-feel.md](references/passes/08-states-and-feel.md).
10. **Verify and report.** Re-check the inventory: every tell is fixed or listed as intentionally kept. Run lintapple and the probe again with the same policy and report the before and after counts by rule, and run `node <skill-dir>/scripts/lintapple/snapshot.mjs <url> --compare <before.json>` to list what changed per element ("button \"Save\": radius 6 -> 14") for the report; a finding that appeared during the passes is a regression to fix. The actions and structure findings (`repeated-form`, `competing-primaries`, `repeated-item-text`, `filters-outweigh-items`, `duplicate-filter`, `filter-link-in-item`, `empty-list-without-message`, `open-create-form`, `ragged-form-labels`, `raw-json-field`, `unexplained-control`) and `underlined-control` must reach zero; explaining one away is allowed only when the probe matched words that mean different things ("Aberto" as open for bids and "aberto a todos" as open to everyone), and the report says so. Name each fix with its precise term from [references/quality/vocabulary.md](references/quality/vocabulary.md). Report with [assets/templates/unslop-report.md](assets/templates/unslop-report.md). When you edited code, list the files changed and the tokens you introduced.

### Which pass fixes a lintapple finding

| lintapple rules | Pass |
|-----------------|------|
| `control-gap`, `layout-gap`, `control-inset`, `content-inset`, `layout-alignment`, and the probe's `near-miss-edge`, `off-lane`, `ragged-wrap`, `uneven-gap`, `uneven-siblings`, `misaligned-parts` | Spacing |
| `nested-radius`, and the probe's `curved-accent`, `nested-accent` | Corner radius |
| `text-contrast`, `root-background`, the probe's `off-token-color`, and every `tokens.mjs` finding | Color |
| `icon-size`, `icon-button-tooltip`, and the probe's `icon-column`, `toolbar-center` | Icons and alignment |
| `font-family`, `font-size`, `font-loading`, `tabular-numbers`, `numeric-alignment`, `copy`, and the probe's `repeated-heading` | Typography and copy |
| The probe's `repeated-form`, `competing-primaries`, `repeated-item-text`, `filters-outweigh-items`, `duplicate-filter`, `filter-link-in-item`, `empty-list-without-message`, `open-create-form`, `ragged-form-labels`, `raw-json-field`, `unexplained-control` | Actions and structure |
| The probe's `underlined-control`, `lonely-word` | Typography and copy |
| The probe's `transition-all` | States and feel |
| `horizontal-overflow`, `viewport-bounds`, `content-clipping`, `content-overflow`, `control-size`, `target-size`, and the accessibility rules | Not a slop pass: report them as bugs, and fix them only when they are in the area you are already editing |

## Rules

- Change one pass at a time and keep the screen working after each pass. Never rewrite the whole component in one step.
- Prefer tokens (CSS variables, Tailwind theme values) over one-off values. If the project has a design system, use it and do not add a parallel one.
- Keep the information, not the noise. Every unique number, item, and action stays unless the user agrees to remove it; the actions and structure pass may move an action into a modal, menu, or detail page, but it stays reachable. Repetition and noise are not information, so remove them without asking and list them in the report: a filter that offers what another filter or the page's sections already offer, a panel of filter chips or links where one row of selects would do (replace it with that row), links inside list items that repeat the filter options, and a notice or fact repeated in every item (said once above the list instead). Remove a structure that should not exist; never restyle it instead.
- Do not swap one trend for another. Neutral and quiet is the target; do not add new glassmorphism, neon, or gradient effects.
- When a value comes from the source example (16px inset, 10px icon gap), treat it as a starting point and fit it to the project's scale.

## Examples

```text
User: This dashboard Claude built for me looks so AI. Fix it. [Dashboard.tsx]
Agent: Lists the tells: purple background gradient, gradient heading text, emoji in
every nav item, glowing pill badges, a gradient active state, "Welcome back, Damir!",
"+12%!!". Spacing pass: replaces gaps of 13, 26, 30, 38, 44, and 46px with a 4px-based
scale. Radius pass: search field and nav items go from pill to the card radius family.
Color pass: neutral dark grays, gray chart bars, no glow. Icons pass: one line icon set
at a fixed 16px inset and 10px label gap; plan emoji become color dots. Copy pass:
"October 2026" as the header, "+12% vs last month", sentence case labels, plain counts
instead of badges. Data pass: the placeholder bar chart becomes a labeled series chart
whose colors match the plan dots. Reports each pass and the changed files.
```

```text
User: Can you de-slop this settings page? Screenshot attached, no code.
Agent: Inventories the tells from the image, runs the passes that apply, and returns
an ordered list of exact changes (values, colors, labels) per pass, using the report
template, so a developer can apply them.
```

## Resources

| Path | Purpose |
|------|---------|
| `references/lintapple/` | Running lintapple, adapting its policy, and reading its findings (shared with Frontend Design Review) |
| `scripts/lintapple/run.mjs` | Runs lintapple against a URL and prints a summary (shared with Frontend Design Review) |
| `scripts/lintapple/probe.mjs` | Measures edge alignment, column lanes, wrapped rows, accent borders, and colors that match no token, without markers (shared with Frontend Design Review) |
| `scripts/lintapple/snapshot.mjs` | Captures a page before the passes and lists, after them, what changed per element, with both screenshots (shared with Frontend Design Review) |
| `scripts/lintapple/tokens.mjs` | Scans source code for colors outside tokens and missing semantic roles (shared with Frontend Design Review) |
| `references/passes/` | One file per pass, in order: tells, fixes, and the before and after from the source |
| `references/quality/` | The full list of slop tells used for the inventory and the final check, the vocabulary of precise UI terms, and the taste file format |
| `assets/templates/` | The report structure and an empty taste file |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.

## Notes

- The source is a 10 second silent clip by Damir Sokolovsky ("Unslopping a vibecoded dashboard") that shows the passes as successive states of one dashboard, with spacing and inset measurements on screen. The pass order, the measured values, and every before and after come from those frames. The reasons and general rules in the pass files are written for this skill and are not stated in the video.
- The tabular figures rule for changing numbers comes from a second, 7 second clip by Nexvyn that measures a timer with and without `tabular-nums`.
- The affordance, leading, ligature, and sticky header rules, and the vocabulary file, come from a third, 45 second silent clip by Emil Kowalski that demos terms from the [AI for UI](https://aiforui.dev/) vocabulary, each with a toggle between the wrong and the right version.
- The states and feel pass comes from four posts: Jaimin's ten rules for apps that feel like the phone people already know (skeletons, optimistic updates, tabular numbers, smooth corners, swipe to dismiss, shared element transitions, code autofill, undo instead of confirm, balanced line breaks, image placeholders), and the Vercel Web Interface Guidelines (MIT) for forms, focus, motion, and copy rules. The before and after snapshot follows Murat Alpay's ui-diff idea. The taste file follows Felipe Basurto's unslop-ui taste lists and the false tells they report.
- The guide line steps in the icons and alignment pass (one icon line and one label line, headers on the icon edge, toolbars on one center line, fix the container and not one item) come from Pritam Paul's /gridlines skill, which in turn credits Karri Saarinen's explanation of the Linear sidebar alignment.
- The plain sentence rules in the copy pass come from the paper "Why is AI-generated language so hard to understand?" (arXiv 2610.29162): AI text uses more stacked nouns, inanimate subjects with human verbs, long distances between subject and verb, and rare phrasing than people do.
- The Damir Sokolovsky clip ends on a dark theme, but the target is "neutral", not "dark". Keep the product's theme unless the user asks to change it.
