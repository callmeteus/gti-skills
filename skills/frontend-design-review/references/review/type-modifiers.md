# Review type modifiers

Use this file in Mode 1 step 1. Every review runs all three pillars; the modifier sets where to look hardest and what to leave out. When the user names no type, infer it from the input: a diff is a PR review, a Figma link with no code is a design review.

| Type | Input | Focus | Leave out |
|------|-------|-------|-----------|
| PR | A diff or pull request | Tokens instead of hardcoded values, every state implemented, design system components reused, regressions in focus and reflow, error copy in the changed code | Redesign ideas outside the diff; list them once under follow-ups |
| Creative | A new or rebuilt interface built in Mode 2, or a concept the user wants critiqued | The committed aesthetic direction and how consistently it is executed, slop tells the direction did not choose, distinctiveness for the context | Design system nitpicks when no system exists |
| Design | Figma frames, mockups, or screenshots before code | Action hierarchy, task length, onboarding and navigation, consistency with the design system's patterns, contrast that can be measured from the frames | Code quality and token usage |
| Accessibility | Any of the above, with an explicit accessibility request | The accessibility grade with a WCAG 2.1 criterion per finding, keyboard flow, focus order and visibility, labels, reflow, color-only information | Aesthetic direction, except where it hurts contrast or legibility |

## PR review specifics

- Review only what the diff changes or makes reachable. Name the file and line for each finding.
- Check that new components have stories or examples when the project keeps them.
- When the PR adds a custom component, check whether the design system already has one (see [design-system.md](design-system.md)).

## Accessibility review specifics

- Grade from code and a running app when possible. From screenshots alone, grade only what pixels can show (contrast, text size, visible labels) and say the grade is partial.
- Automated checkers find only part of the issues. Name the tool you ran, if any, and what you checked by hand.
