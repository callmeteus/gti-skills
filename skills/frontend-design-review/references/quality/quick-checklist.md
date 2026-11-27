# Quick checklist

Run this before approving a review or delivering a build. Every unchecked box is either a finding in the report or a line under "Not checked" with the reason.

## Design system compliance

- [ ] Components come from the design system, or the exception is documented in code
- [ ] Spacing, color, type, radius, and shadow use tokens, not hardcoded values (the token scan reports no color outside tokens)
- [ ] Semantic tokens exist for primary, secondary, info, warning, danger, success, and muted, and each is used only for its meaning
- [ ] The implementation matches the Figma frames, or each deviation is listed for design approval
- [ ] Every variant and reachable state exists: hover, focus, active, disabled, loading, empty, error

## Aesthetic quality

- [ ] The direction is written down (purpose, tone, constraints, differentiation) for a new build
- [ ] The Unslop Interface inventory ran, and every tell is fixed or listed as intentional
- [ ] Typography, color, and motion follow one direction, consistently across the screen
- [ ] Motion respects `prefers-reduced-motion`

## Frictionless

- [ ] The user task completes in three interactions or fewer, or the extra steps are justified
- [ ] One or two primary actions per view; secondary actions are disclosed progressively
- [ ] Every screen answers "What can I do?" and "What happens next?"
- [ ] Back or cancel is always available; deep flows have breadcrumbs
- [ ] Creating an item opens a modal from one "+ New" primary button in the page header; no create form sits open on the page (no `open-create-form`)
- [ ] Every list has an empty state with the create button, not a bare header row (no `empty-list-without-message`)
- [ ] Form labels sit above their fields, fixed choices are selects, settings are fields and not raw JSON, and no text field lists its allowed values under it (no `ragged-form-labels`, `raw-json-field`, or `enum-as-text`)
- [ ] Every control has a label, and no select has a single option (no `unexplained-control`)
- [ ] A settings page is one grid: every section the same width, labels on the left and controls on the right edge, the language as a select, and each choice with the setup of its chosen option under it, as a wizard when it takes steps (no `ragged-stack`, `language-as-buttons`, or `option-apart-from-settings`)
- [ ] Every empty state on a page follows one pattern, such as "Nenhum resultado" and "Nenhuma atualização" (no `inconsistent-empty-copy`)
- [ ] Form-level results are toasts (errors with `role="alert"`), and field errors sit under their field (no `loose-form-error`)
- [ ] On desktop, every clickable element changes on hover and shows the pointer cursor (no `no-hover-state` or `no-pointer-cursor`)
- [ ] Lists add items from a "+" button in their header, and the user is an avatar with an icon sign-out (no `create-as-item` or `user-as-text`)
- [ ] Hand-drawn icons get a suggestion for one icon library in the report, not a silent swap (`icon-source`)
- [ ] A detail page has one header row (title left; status, refresh, and an Actions menu right), behavior notes in tooltips, views of one output in tabs, each fact once, and readable long values (no `status-actions-apart`, `header-controls-below-title`, `behavior-footnote`, `repeated-value`, `stacked-output-panels`, `truncated-without-tooltip`)
- [ ] A dashboard names its question and period, shows four to six KPIs each with a comparison, target, or trend, and uses labeled charts that fit the data (no `kpi-without-context`, `too-many-kpis`, or `chart-without-labels`)
- [ ] No heading accents one word and no button or link ends with an arrow (no `accent-word` or `arrow-suffix`)
- [ ] Icons and labels in a list sit on two guide lines, section headers on the icon line, and toolbar controls on one center line (no `icon-column` or `toolbar-center`)
- [ ] Actions limited to some roles are hidden or disabled for the others, and the server enforces the rule
- [ ] No text narrates the interface; copy says what the user gains
- [ ] No heading, subtitle, or tag repeats the heading above it (no `repeated-heading`)
- [ ] List items show facts and one action; no form inside list items, and the probe reports no `repeated-form` or `competing-primaries`
- [ ] Actions appear only in the state where they apply
- [ ] Notices and facts shared by every item appear once above the list; filters are one compact row of selects, no duplicate filters, and no filter links inside items (no `repeated-item-text`, `filters-outweigh-items`, `duplicate-filter`, or `filter-link-in-item`)
- [ ] Only links inside running text are underlined (no `underlined-control`)

## Quality craft

- [ ] Accessibility grade is C or better, with the WCAG 2.1 criterion named for each failure
- [ ] Focus indicators are visible on every interactive element
- [ ] Instances of one component share size and inner rows (no `uneven-siblings` or `misaligned-parts`)
- [ ] Large blocks (maps, charts, big panels) have the same space above and below on desktop and phone (no `uneven-gap`)
- [ ] Blocks share column edges, no near-miss edges or ragged wrapped rows, no curved or nested accent borders (the probe reports none, or each is explained)
- [ ] The layout reflows at 320px width without horizontal scroll
- [ ] Text contrast meets 4.5:1 (3:1 for large text and UI parts)

## Trustworthy

- [ ] AI-generated content has a visible disclaimer
- [ ] Every error message says what happened and what to do next
- [ ] No action fails silently
