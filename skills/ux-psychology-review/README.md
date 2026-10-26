<div align="center">

# UX Psychology Review

> Find why users stall on a screen, and fix it honestly

**Reviews forms, onboarding, signup, upgrade, and pricing screens against six behavioral principles and returns before and after changes that pass an ethics check.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Runtime](https://img.shields.io/badge/runtime-none-blue.svg)](#requirements)
[![Agents](https://img.shields.io/badge/agents-10%20supported-8A63D2.svg)](#installation)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](#requirements)
[![License](https://img.shields.io/badge/license-not%20declared-lightgrey.svg)](#license)

[Quick Start](#quick-start) • [Usage](#usage) • [Reference](#reference) • [Troubleshooting](#troubleshooting)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Reference](#reference)
- [Output](#output)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Overview

Many screens lose users not because they look bad but because they ignore how people decide: empty forms that demand every choice up front, progress bars that start at zero, signup walls before any value, and prices shown with no reference point.

UX Psychology Review gives an agent six principles, each with a bad and a good screen to compare against, and a set of ethics guardrails. The agent names the decision the screen asks for, diagnoses which principles apply, writes concrete changes (or edits the UI code), rejects any change that turns into a dark pattern, and suggests a metric for each change. The principles and examples were distilled from the uxpeak video "The UX Psychology Behind Apps People Can't Stop Using" with the Video to Skill skill.

```text
  screenshot, mockup, or UI code + target action
          │
          v
  identify the decision and every choice before it
          │
          v
  check six principles ──> references/principles/0N-*.md
          │
          v
  write the after (values, labels, order, button text, or code edits)
          │
          v
  ethics check ──> references/quality/ethics-guardrails.md
          │
          v
  review report (findings by impact, before and after, metrics)
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Diagnose conversion screens against six named principles | Audit accessibility, performance, or visual style |
| Propose exact defaults, labels, order, and button text | Generate images or mockup files |
| Edit UI code when the agent has it | Promise specific conversion uplift numbers |
| Reject false urgency, fake progress, confirmshaming, and misleading prices | Recommend dark patterns, even on request |

## Features

- **Six principles:** smart defaults, goal gradient, reciprocity, the IKEA effect, loss aversion, and contrast, each in its own reference file.
- **Bad and good screens:** every principle describes a concrete before and after screen with its real labels and values.
- **Ethics guardrails:** a table of rejected patterns with an honest alternative for each.
- **Corrected examples:** where the source video's "good" screen crosses into a dark pattern, the reference keeps the principle and fixes the variant.
- **Report template:** a fixed structure with findings ordered by impact and one metric per change.
- **No dependencies:** works from a screenshot, a description, or source code.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| None | - | The skill is instructions and reference files only | - |

The agent needs to read images to review screenshots. Without image input, describe the screen or share its code.

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill ux-psychology-review
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--scope user` to install for every project, and `--dry-run` to preview.

| Agent | Id | Project folder | User folder |
|-------|----|----------------|-------------|
| Cursor / Cursor CLI | `cursor` | `.cursor/skills` | `~/.cursor/skills` |
| Claude / Claude Code | `claude` | `.claude/skills` | `~/.claude/skills` |
| Antigravity | `antigravity` | `.agents/skills` | `~/.gemini/antigravity/skills` |
| OpenCode | `opencode` | `.opencode/skills` | `~/.config/opencode/skills` |
| Cline | `cline` | `.cline/skills` | `~/.cline/skills` |
| Kilo Code | `kilo` | `.kilocode/skills` | `~/.kilocode/skills` |
| Kiro | `kiro` | `.kiro/skills` | `~/.kiro/skills` |
| Codex | `codex` | `.agents/skills` | `~/.agents/skills` |
| GitHub Copilot | `copilot` | `.github/skills` | `~/.copilot/skills` |
| Muse Code | `muse` | `.agents/skills` | `~/.agents/skills` |

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/ux-psychology-review` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/ux-psychology-review .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\ux-psychology-review .claude\skills\
```

Each agent has a short guide in `skills/ux-psychology-review/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

## Quick Start

```text
Review this signup screen [screenshot]. Most visitors leave without creating an account.
```

The agent names the target action, checks the screen against the six principles, and returns a report with before and after changes, ethics notes, and a metric for each change.

## Usage

### Input

| Input | Required | Example |
|-------|:--------:|---------|
| Screen | Yes | A screenshot, a mockup, a description, or a component file such as `Checkout.tsx` |
| Target action | Yes | "Create an account", "Upgrade to Pro", "Add protection plan"; the agent asks once if it is unclear |
| Context | No | Current drop-off data, the audience, the most common user choices |
| Scope | No | One principle only, or report without editing code |

### Examples

```text
Our table booking form has a low search rate. Here is the screenshot.
```

```text
Improve the upgrade modal in src/components/StorageUpgrade.tsx. Keep it honest.
```

```text
Design an onboarding flow for a habit tracker that people actually finish.
```

## How It Works

```text
  1. Identify the decision   screen type, target action, choices before it
          │
  2. Diagnose                match the screen to the principles that apply
          │
  3. Write the after         concrete values, labels, order, button text, or code edits
          │
  4. Ethics check            rewrite or drop anything that fails the guardrails
          │
  5. Report                  findings by impact, before and after, ethics notes
          │
  6. Suggest a test          one metric per change, no promised numbers
```

## Reference

### Principle files

Each file holds the mechanism, a bad screen, a good screen, rules, and limits. The agent reads only the files for principles that apply.

| File | Principle | Typical screen |
|------|-----------|----------------|
| `references/principles/01-smart-defaults.md` | Smart defaults | Booking and search forms |
| `references/principles/02-goal-gradient.md` | Goal gradient | Onboarding and profile completion |
| `references/principles/03-reciprocity.md` | Reciprocity | Free tools, reports, and trials behind signup |
| `references/principles/04-ikea-effect.md` | IKEA effect | Signup and workspace creation |
| `references/principles/05-loss-aversion.md` | Loss aversion | Upgrade prompts and paywalls |
| `references/principles/06-contrast.md` | Contrast | Pricing, add-ons, and checkout |

### Repository commands

Validate the skill and regenerate its agent guides after editing it:

```bash
node packages/cli validate
node packages/cli build
```

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `node packages/cli validate` | Checks every skill against the standard | None |
| `node packages/cli build` | Regenerates `harnesses/<id>/GUIDE.md` and validates | None |
| `node packages/cli install` | Installs the skill into agents | `--harness`, `--skill`, `--scope`, `--dest`, `--dry-run` |

## Output

````markdown
# UX psychology review: Book a Table

## Decision

- **Screen type:** form
- **Target action:** search for a table

## Findings

### 1. Smart defaults: five empty fields before any result

- **Before:** date, time, guests, and seating are empty; the button says "Search".
- **After:** date "Tomorrow", time chips with 7:00 selected, guests 2, indoor selected,
  button "Search 12 Available Tables".
- **Measure:** search rate per screen view.

## Ethics notes

- None
````

| Section | Contents |
|---------|----------|
| Decision | Screen type, target action, and what the user sees before acting |
| Findings | One block per problem, ordered by expected impact: before, why it hurts, after, measure |
| Ethics notes | Changes that were rewritten or rejected, and why |
| Not covered | Issues outside the scope, such as accessibility or visual polish |

The template is `assets/templates/review-report.md`.

## Troubleshooting

<details>
<summary><strong>The agent does not see the skill</strong></summary>

Restart the agent session after installing, and confirm the folder is in the path your agent reads (see the table in [Installation](#installation)).

</details>

<details>
<summary><strong>The review applies all six principles to every screen</strong></summary>

The skill tells the agent to skip principles that do not fit. Name the target action explicitly, and ask for the top two or three findings if the report is too long.

</details>

<details>
<summary><strong>The agent refuses a change I asked for</strong></summary>

The change matches a pattern in `references/quality/ethics-guardrails.md`, such as a fake countdown or a pre-checked paid add-on. The agent offers an honest alternative instead; use that, or adjust the request so the claim on screen is true.

</details>

<details>
<summary><strong>The agent cannot read my screenshot</strong></summary>

Some agents or models do not accept images. Describe the screen in text, or share the component code, and the agent reviews that instead.

</details>

## Limitations

- The principles are qualitative. The skill suggests what to measure but cannot predict the size of any effect.
- Research figures quoted in the source video are not verified and are deliberately left out of the references.
- Reviews from a screenshot cannot see behavior such as validation, loading states, or what happens on dismiss.
- The skill covers decision and conversion moments, not full product strategy, visual design, or accessibility.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [uxpeak: The UX Psychology Behind Apps People Can't Stop Using](https://www.youtube.com/watch?v=2TlIg3VokY8) | Standard YouTube license | Source of the six principles and the before and after screens |

## License

No license has been declared for this skill yet. See the [root README](../../README.md#license).
