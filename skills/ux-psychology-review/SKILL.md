---
name: ux-psychology-review
description: >-
  Reviews and redesigns conversion screens (forms, onboarding, signup,
  upgrade prompts, paywalls, pricing, checkout) with six behavioral
  principles: smart defaults, goal gradient, reciprocity, the IKEA effect,
  loss aversion, and contrast. Produces before and after recommendations
  with an ethics check on each one. Use when the user asks to review, audit,
  critique, or improve the UX, conversion, activation, or retention of a
  screen, mockup, screenshot, or UI code. Do not use for visual styling,
  accessibility audits, or copywriting with no screen involved.
metadata:
  display-name: UX Psychology Review
---

# UX Psychology Review

## Core Rule

Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## When to use

- The user shares a screenshot, mockup, Figma export, or UI code of a form, onboarding step, signup page, upgrade prompt, paywall, pricing page, or checkout and asks for a review or improvements.
- The user asks why users drop off, skip a step, ignore an upgrade, or abandon a signup.
- The user asks to design one of those screens and wants it to convert well.

Do not use this skill for pure visual polish (color, spacing, typography), accessibility audits, or performance work. Mention those issues only when they block the decision the screen asks for.

## Prerequisites

- At least one screen to review: an image, a description, or the component code (for example a React, Vue, SwiftUI, or HTML file).
- The goal of the screen: the single action the product wants the user to take. If it is not obvious, ask once.

No tools need to be installed.

## Instructions

1. **Identify the decision.** Name the screen type and the one action it asks for (search, continue onboarding, create account, upgrade, add an add-on). List every choice, field, and price the user sees before that action.
2. **Diagnose with the principles.** Check the screen against each row below and read the linked reference for every principle that applies. Skip principles that do not fit; do not force all six.

   | Principle | Look for | Reference |
   |-----------|----------|-----------|
   | Smart defaults | Empty fields and unselected options where the common answer is known | [references/principles/01-smart-defaults.md](references/principles/01-smart-defaults.md) |
   | Goal gradient | Progress shown at 0%, or a flow with no visible progress | [references/principles/02-goal-gradient.md](references/principles/02-goal-gradient.md) |
   | Reciprocity | A signup, email, or payment wall before the user receives any value | [references/principles/03-reciprocity.md](references/principles/03-reciprocity.md) |
   | IKEA effect | A signup form where the user has built or chosen nothing yet | [references/principles/04-ikea-effect.md](references/principles/04-ikea-effect.md) |
   | Loss aversion | Upgrade prompts that list generic gains and change nothing if dismissed | [references/principles/05-loss-aversion.md](references/principles/05-loss-aversion.md) |
   | Contrast | A price or cost shown alone, with no reference point | [references/principles/06-contrast.md](references/principles/06-contrast.md) |

3. **Write the after.** For each problem, describe the concrete change: the new default value, the new label, the new order of elements, the new button text. When you have the code, edit the code; otherwise describe the screen precisely enough for a designer to rebuild it.
4. **Run the ethics check.** Test every recommendation against [references/quality/ethics-guardrails.md](references/quality/ethics-guardrails.md). Drop or rewrite any change that relies on false urgency, false scarcity, fake progress, confirmshaming, pre-checked paid items or consent, or a misleading price comparison. Say which ones you changed and why.
5. **Report.** Use the structure in [assets/templates/review-report.md](assets/templates/review-report.md): the decision, findings ordered by expected impact, before and after for each, the ethics notes, and what to measure.
6. **Suggest a test.** For each change, name one metric that would confirm it works (completion rate of the step, conversion to signup, upgrade rate, add-on attach rate). Do not promise specific uplift numbers.

## Examples

```text
User: Here is our table booking screen [screenshot]. People open it but few search. Why?
Agent: Names the decision (search for a table). Sees five empty fields: date, time,
guests, seating, and a generic Search button. Applies smart defaults: date set to
tomorrow, time chips with the most popular slot selected, guests set to 2, indoor
seating selected, and a button that states the result ("Search 12 available tables").
Ethics check passes because every default is editable and costs nothing. Suggests
measuring search rate per screen view.
```

```text
User: Improve this upgrade modal in StorageUpgrade.tsx. It says "Upgrade now" and "Maybe later".
Agent: Reads the component. Applies loss aversion: when storage is actually full, the
modal names the user's real files at risk and the real date of the consequence.
Rejects the "I'll risk it" dismiss label as confirmshaming and keeps a neutral
"Not now". Adds a guard so the modal only shows the loss framing when the condition
is true. Edits the code and lists the metric: upgrade rate from the modal.
```

## Resources

| Path | Purpose |
|------|---------|
| `references/principles/` | One file per principle: the mechanism, a bad and a good screen, rules, and limits |
| `references/quality/` | Ethics guardrails every recommendation must pass |
| `assets/templates/` | The review report structure |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.

## Notes

- The source video presents some techniques in forms that cross into dark patterns ("progress, even a fake one", a dismiss button labeled "I'll Risk It", and a monthly fee shown as a percentage of a one-time price). The references keep the principle and replace those variants with honest ones.
- Research figures quoted in the video (choice overload, car wash loyalty cards, default adoption rates, free sample uplift) are not verified here. Do not cite them as numbers to the user; describe the effect instead.
- These principles change how a decision feels, not whether the product is worth it. If the offer is weak, say so instead of adding persuasion.
