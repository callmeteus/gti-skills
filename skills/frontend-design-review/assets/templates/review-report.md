# Design review: <feature or screen>

## Summary

- **Mode:** design review | create
- **Review type:** PR | Creative | Design | Accessibility
- **User task:** <the task the UI serves>
- **Scope:** component | feature | flow
- **Sources:** <code paths, PR, Figma frames, screenshots, Storybook>
- **Verdict:** approve | approve with changes | changes required
- **Counts:** <n> blocking, <n> major, <n> minor
- **Accessibility grade:** B | C | below C (partial when graded from screenshots)

## Aesthetic direction

Mode 2, or a Creative review only.

- **Purpose:**
- **Tone:**
- **Constraints:**
- **Differentiation:**

## Findings

Ordered by severity, then by pillar.

| # | Severity | Pillar | Evidence | Issue | Recommendation |
|---|----------|--------|----------|-------|----------------|
| 1 | Blocking | Quality craft | `File.tsx:22` | | |

## Measured checks (lintapple)

Skip when the app could not run; say why.

- **URL and policy:** <url>, <policy file, and the fonts, scale, and breakpoints it uses>
- **Result:** <n> problems, <n> unresolved, by rule
- **Not covered:** <child frames, unmeasured controls, unmarked layout groups>

## Design system

- **Tokens:** <hardcoded values found, and the token for each>
- **States:** <missing variants or states>
- **Figma deviations:** <each deviation, needs design approval>
- **Exceptions:** <custom components and their documented rationale>

## Slop tells (Unslop Interface)

| Tell | Unslop pass | Status |
|------|-------------|--------|
| | | fixed, to fix, or intentional (with the part of the direction it serves) |

## Pillars

- **Frictionless insight to action:** <interaction count for the task, primary action, dead ends>
- **Quality is craft:** <design system, aesthetic direction, accessibility>
- **Trustworthy building:** <AI disclaimers, error messages>

## Files changed

Only when fixes were made or a build was delivered.

## Not checked

What this review could not cover and why, for example keyboard flow from screenshots or Figma without access.
