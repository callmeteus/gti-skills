# Phase 4: Accessibility snapshot

## Goal

Flag high-level accessibility gaps seen while auditing. This is a quick pass, not a full accessibility audit.

## Steps

1. `take_snapshot(pageId, verbose: true)` for the accessibility tree.
2. Optionally `lighthouse_audit(pageId, device: "mobile", mode: "snapshot")` for the accessibility score and the nodes it flags.

## Flag

- Interactive elements (buttons, links, inputs) without an accessible name.
- Images that carry information without alternative text.
- Missing or duplicate IDs referenced by ARIA attributes.
- Text below WCAG AA contrast: 4.5:1 for normal text, 3:1 for large text.
- Missing focus indicators or focus traps, when you can check them with `press_key("Tab")`.
- A heading structure that skips levels or has no `h1`.

## Report

List each gap with the element and the fix. When the page has many gaps, recommend a dedicated accessibility audit instead of listing them all.
