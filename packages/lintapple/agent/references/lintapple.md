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
| `--out FILE` | Where to save the full JSON report (default: the OS temp folder) |
| `--top N` | How many problem groups to print (default 15) |
| `--write-policy FILE` | Write the default policy to FILE so you can adapt it |
| `--where` | Show which lintapple will run |

The script prints a summary (problems by rule, then the top groups with selector, actual, expected, fix, and where they were seen) and the path of the full report. Exit codes: `0` passed, `1` findings or unresolved checks, `2` the check did not finish.

It uses, in order, the project's own `lintapple`, the copy installed with gti-skills, or `npx lintapple@<version>` from npm. It needs Node.js 22 or later and Chromium for Playwright; if Chromium is missing, the script prints the one command that installs it. Nothing is written into the project.

## Adapt the policy first

The default policy expects Apple system fonts and a fixed type scale, so on most projects it reports every font as wrong. Before trusting font, size, gap, or inset findings:

1. If the project has a `ui-policy.json`, use it (the script does this automatically).
2. Otherwise write the default to a temp file and adapt it to the project's design system, never to the project folder unless the user wants lintapple adopted:

   ```bash
   node <skill-dir>/scripts/lintapple/run.mjs --write-policy <tmp>/ui-policy.json
   ```

   - `fonts`: the font stacks the design system uses.
   - `fontSizes` and `typeRules`: the type scale, and per-role sizes (`h1`, `h2`, buttons).
   - `minControlGap`, `minControlInset`, `minLayoutGap`: the spacing scale's smallest steps.
   - `viewports` and `colorSchemes`: the breakpoints and themes the product supports (add `"dark"` when it has a dark theme).
   - `bannedCopy`: phrases to flag; add the generic marketing phrases the review cares about.
3. Pass it with `--config <tmp>/ui-policy.json`, and say in the review which values you chose and why.

## Read the findings

- **Confirmed failures** are measurements: treat them as facts about the page, then decide severity with the skill's own rules.
- **Unresolved checks** (they also exit `1`) need a human look; report them as "to verify", not as failures.
- **Coverage notes** matter: child frames are not checked, and some control content (native selects, CSS images, pseudo-elements) is listed as unmeasured. Unmeasured is not a pass.
- **Layout checks need markers.** Gaps inside stacks and button groups, alignment, nested radius, and tabular numbers are measured only on elements marked with `data-ui-stack`, `data-ui-actions`, `data-ui-container`, `data-ui-align`, `data-ui-radius`, `data-ui-number`, or matched by policy selectors. An unmarked page passing those rules proves nothing about them.
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
