# Design system compliance

Use this file in Mode 1 step 2, and in Mode 2 whenever the product already has a design system.

## Before implementing

1. Look up the component in the Storybook or component library: its API, variants, and documented usage.
2. Get the exact specs from Figma Dev Mode: spacing, tokens, and component properties.
3. Build with the design system's components and tokens. Do not restyle a component from the outside to make it look like the design.

## During review

1. Compare the implementation with the Figma design, frame by frame.
2. Verify that tokens are used, not hardcoded values. Search the diff for raw hex colors, pixel values, font sizes, radii, and shadows that have a token.
3. Check every variant and state the component defines: default, hover, focus, active, disabled, loading, empty, error, and selected where they apply.
4. Flag every deviation from Figma or the system. A deviation needs design approval; record it as a finding, even when it looks better.

## When the component does not exist

1. Check whether an existing component can be adapted through its props or composition.
2. If not, ask design for a new component instead of inventing one in the feature.
3. If the feature cannot wait, document the exception and its rationale in a code comment next to the custom component, and list it in the report.

## Without Figma or Storybook

When you cannot open Figma or the component library, say so in the report. Review token usage from the code (theme files, CSS variables, Tailwind config) and skip the Figma comparison. Never describe a Figma spec you did not see.

## Severity

| Finding | Default severity |
|---------|------------------|
| A state the user can reach is missing (no error, no loading, no disabled) | Major |
| Hardcoded value where a token exists | Minor, Major when it breaks theming or dark mode |
| Custom component that duplicates an existing one | Major |
| Visual deviation from Figma with no approval | Minor, Major when it changes hierarchy or meaning |
| Undocumented exception | Minor |
