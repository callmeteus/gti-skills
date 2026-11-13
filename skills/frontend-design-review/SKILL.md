---
name: frontend-design-review
description: >-
  Reviews UI implementations against a design system and three quality
  pillars (Frictionless, Quality Craft, Trustworthy), with accessibility
  grades and blocking, major, and minor issues, or creates distinctive,
  production-grade frontend interfaces from a committed aesthetic direction.
  Calls the unslop-interface skill to inventory and remove generic "AI slop"
  in both modes. Use when the user asks for a design review, UI or PR review
  of frontend code, a check against Figma or the design system, a design QA
  pass, or asks to build a new page, screen, or component that should look
  distinctive. Do not use for conversion or behavioral reviews of a single
  screen (use ux-psychology-review), for polishing an existing generated UI
  with no review or new build (use unslop-interface), or for backend code.
metadata:
  display-name: Frontend Design Review
---

# Frontend Design Review

## Core Rule

Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## Autonomous Mode

When the user says to work on your own, for example "do it yourself", "faz você mesmo", "you don't need to ask me", "não precisa me chamar", or "just do it", or when the request runs unattended:

- **Do not stop for input.** Skip questions, confirmations, and pauses that wait for the user. At each decision, take the option this skill recommends, or the safest default, and note the decision and the reason.
- **Do not open anything for the user.** No browser tabs, viewers, editors, or servers started for the user to look at. Still write every file the skill produces and give the paths at the end.
- **Never take a gated irreversible or outward action** unless the request already allows it: deleting the user's data, tests, or files; publishing, posting, pushing, or sending; paying; typing credentials. List each one as pending instead.
- **Finish with one report:** the decisions you took and why, what you did, what is pending, and what you could not verify.

In this skill:

- When the request mixes review and fix, run the review, then fix the blocking and major issues without asking.
- In create mode, commit to the direction you would recommend and state it in the report. Write the review report as a file and do not open it.

## When to use

- The user asks to review a UI, a frontend pull request, or a feature against the design system, Figma, or general design quality.
- The user asks for a design QA pass, an accessibility grade, or a list of design issues ranked by severity.
- The user asks to build a new page, screen, landing section, or component and wants it to look intentional, not generic.

Do not use this skill to optimize what a screen asks the user to do (use `ux-psychology-review`), or to only clean up the look of an existing generated UI (use `unslop-interface` directly).

## Prerequisites

- **Review mode:** the UI as code, a running app, screenshots, or a PR diff. Optional: the Figma file or Dev Mode specs, the Storybook or component library, and the design tokens.
- **Create mode:** the purpose of the interface, its users, and the stack. Optional: brand assets and an existing design system.
- **The `unslop-interface` skill.** `node packages/cli install` installs it next to this one. See step "Calling Unslop Interface" below.

No tools need to be installed for a review from code or screenshots. When the app runs, take screenshots to check states, reflow, and focus, and measure it with **lintapple**, a UI linter bundled with this skill (Node.js 22+ and Chromium for Playwright). See [references/lintapple/lintapple.md](references/lintapple/lintapple.md).

## Pick the mode

| The user wants | Mode |
|----------------|------|
| A verdict, a list of issues, a PR or design QA review | Mode 1: Design review |
| A new interface built, or an existing one rebuilt with a new direction | Mode 2: Create |

When the request mixes both ("review this and then fix it"), run Mode 1 first, then fix the blocking and major issues: design system issues with the system's components, generic look with `unslop-interface`.

## Mode 1: Design review

1. **Identify the user task and the scope.** Name the task the UI serves ("export last month's invoices") and the scope: one component, a feature, or a whole flow. Read the review type modifier that fits (PR, Creative, Design, Accessibility) in [references/review/type-modifiers.md](references/review/type-modifiers.md).
2. **Measure the rendered UI** when the app runs (a dev server or preview URL). Adapt the lintapple policy to the design system's fonts, type scale, spacing steps, breakpoints, and themes, then run `node <skill-dir>/scripts/lintapple/run.mjs <url> --config <policy>`. Each confirmed finding is evidence for a finding in the review, with its selector, measured value, and expected value; unresolved checks are "to verify". Severity still comes from the pillars file: accessibility and contrast failures feed the accessibility grade. See [references/lintapple/lintapple.md](references/lintapple/lintapple.md).
3. **Check the design system.** Find the matching components and patterns, compare against Figma, and verify tokens, variants, and states. See [references/review/design-system.md](references/review/design-system.md).
4. **Inventory generic AI aesthetics with Unslop Interface.** Run its inventory step only (the slop tells list) and record each tell as a finding. Do not run its passes in a review unless the user asked for fixes.
5. **Evaluate the three pillars.** Frictionless insight to action, Quality is craft (including the accessibility grade), and Trustworthy building. See [references/review/pillars.md](references/review/pillars.md).
6. **Score and prioritize.** Mark every issue blocking, major, or minor with the rules in the pillars file.
7. **Recommend.** Give each issue a concrete fix that uses the design system's own component or token, and name the Unslop Interface pass that fixes each slop tell.
8. **Run the quick checklist** in [references/quality/quick-checklist.md](references/quality/quick-checklist.md), then write the report with [assets/templates/review-report.md](assets/templates/review-report.md).

## Mode 2: Create

1. **Commit to a direction before coding.** Write down the purpose, the users, the tone, the constraints, and what makes this interface distinctive. See [references/create/aesthetic-direction.md](references/create/aesthetic-direction.md).
2. **Respect the existing system.** When the product has a design system, build with its components and tokens, and express the direction inside it (layout, composition, motion, copy). Never fork a parallel system.
3. **Build.** Match the code's complexity to the direction: a maximalist direction earns elaborate code, a minimalist one earns restraint and precision. Keep it production-grade: real states, responsive layout, keyboard access, and WCAG 2.1 AA contrast.
4. **Check against slop with Unslop Interface.** Run its inventory on the result. Remove every tell the direction did not choose on purpose, using its passes. List the effects the direction keeps on purpose (for example a grain overlay in a retro direction) as intentional.
5. **Measure the build** with lintapple (Mode 1 step 2) and fix every confirmed finding, unless the direction chose it on purpose; say which.
6. **Review your own build** with Mode 1 steps 5 to 8, then report the direction, the files, the lintapple result, and the review.

## Calling Unslop Interface

Load the `unslop-interface` skill by name: invoke `/unslop-interface` in agents with slash commands, or ask the agent to use the skill. When it is installed in the same skills folder but did not load, read `<skill-dir>/../unslop-interface/SKILL.md` and follow it from there. When it is not installed, tell the user and give the command, then continue with the slop tells you can see:

```bash
node packages/cli install --harness <agent-id> --skill unslop-interface
```

The two skills disagree on purpose in one place. Unslop Interface moves a UI toward neutral and never adds new effects; Mode 2 here may choose a bold direction with display type, textures, or rich backgrounds. Read [references/create/unslop-handoff.md](references/create/unslop-handoff.md) to resolve each conflict.

## Rules

- The design system wins. Tokens, components, and approved Figma specs override the aesthetic guidelines in this skill; a deviation is a finding that needs design approval, not a fix to make silently.
- Every finding names its evidence: the file and line, the screenshot region, or the Figma frame.
- Never mark a finding blocking without saying what the user cannot do because of it.
- Never narrate the interface in copy you write or approve. Create flows open in a modal, and actions limited to some roles stay out of reach for the others.
- Keep the information and the flow. A review recommends; it changes code only when the user asked for fixes.
- Do not invent a design system rule. When there is no system, say so and review against the pillars and the aesthetic direction only.
- AI-generated content in the UI needs a visible disclaimer. Its absence is always a finding.

## Examples

```text
User: Review PR #412, it adds the billing settings page.
Agent: Names the task (change plan, update card), scopes the review to the feature,
and applies the PR modifier. Finds hardcoded #6366F1 and 14px gaps instead of
tokens, a missing disabled state on the Save button, two competing primary
buttons, an error toast that says "Something went wrong", and missing focus
rings (WCAG 2.1 AA 2.4.7, Grade C). Unslop inventory adds a purple gradient
header and emoji in section labels (passes 03 and 04). Ranks: two blocking,
three major, two minor, each with the token or component to use.
```

```text
User: Build a landing page for our letterpress print studio.
Agent: Commits to an editorial direction: a serif display face paired with a
quiet body face, ink-black and paper tones with one vermilion accent, a
grain overlay, and an asymmetric grid. Builds it, runs the Unslop inventory,
removes the default card glow and the "Supercharge your prints" copy, keeps
the grain as intentional. Reviews the build against the pillars and reports.
```

## Resources

| Path | Purpose |
|------|---------|
| `references/review/` | Design system workflow, the three pillars with severity rules, and review type modifiers |
| `references/create/` | Aesthetic direction and how Mode 2 resolves conflicts with Unslop Interface |
| `references/quality/` | Quick pre-approval checklist and good and bad review examples |
| `assets/templates/` | The review report structure |
| `references/lintapple/` | Running lintapple, adapting its policy, and reading its findings (shared with Unslop Interface) |
| `scripts/lintapple/run.mjs` | Runs lintapple against a URL and prints a summary (shared with Unslop Interface) |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.

## Notes

- The creative principles are adapted from Anthropic's `frontend-design` skill (Apache 2.0). The quality pillar framework and the design review workflow come from a skill by [@Quirinevwm](https://github.com/Quirinevwm).
- Good and bad examples of both modes are in [references/quality/pattern-examples.md](references/quality/pattern-examples.md).
