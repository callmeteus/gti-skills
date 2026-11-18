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
- [ ] Creating an item opens a modal from one primary button; no create form sits open on the page
- [ ] Actions limited to some roles are hidden or disabled for the others, and the server enforces the rule
- [ ] No text narrates the interface; copy says what the user gains
- [ ] No heading, subtitle, or tag repeats the heading above it (no `repeated-heading`)
- [ ] List items show facts and one action; no form inside list items, and the probe reports no `repeated-form` or `competing-primaries`
- [ ] Actions appear only in the state where they apply

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
