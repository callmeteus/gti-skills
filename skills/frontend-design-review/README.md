<div align="center">

# Frontend Design Review

> Design reviews with severity, and new UIs with a real direction

**Reviews frontend work against the design system and three quality pillars, or builds distinctive interfaces, and calls Unslop Interface to remove the generic AI look.**

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

Agents review UI with vague remarks ("the colors could be better") and build new screens that all look the same: a default font, a purple gradient, three rounded cards. Neither helps a team ship. A useful review names the evidence, the severity, and the fix in the design system's own terms; a useful build commits to a direction before the first line of code.

Frontend Design Review gives an agent two modes. Mode 1 reviews code, a PR, Figma frames, or screenshots against the design system and three pillars (Frictionless, Quality Craft, Trustworthy), grades accessibility, and ranks every issue as blocking, major, or minor. Mode 2 writes down an aesthetic direction, builds the interface, and reviews its own result. Both modes call the [Unslop Interface](../unslop-interface/README.md) skill to find and remove the generic generated look.

```text
  request
     │
     ├── review ──> task and scope ──> design system ──> Unslop inventory
     │                                                       │
     │                                                       v
     │                                   three pillars, accessibility grade
     │                                                       │
     │                                                       v
     │                                   blocking / major / minor with fixes
     │
     └── create ──> commit to a direction ──> build ──> Unslop inventory
                                                          and passes
                                                             │
                                                             v
                                                   review own build (pillars)
     │
     v
  review report
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Review code, PRs, Figma frames, or screenshots against the design system | Optimize conversion or behavior on one screen (use UX Psychology Review) |
| Grade accessibility against WCAG 2.1 A and AA and name each criterion | Replace a full audit with assistive technology |
| Rank issues as blocking, major, or minor with a concrete fix | Change code in review mode unless asked |
| Build new interfaces from a committed aesthetic direction | Override an existing design system with its own style |
| Call Unslop Interface to find and remove generic AI aesthetics | Polish a generated UI with no review or build (use Unslop Interface) |

## Features

- **Two modes:** design review and creative build, chosen from the request, and run in sequence when the user asks to review and fix.
- **Three pillars:** Frictionless insight to action, Quality is craft, and Trustworthy building, each with checks and red flags.
- **Severity rules:** a table that says when an issue is blocking, major, or minor.
- **Accessibility grade:** C for WCAG 2.1 A, B for AA, below C is blocking; each finding names its success criterion.
- **Design system first:** Storybook and Figma Dev Mode workflow, token checks, every state, and documented exceptions.
- **Review type modifiers:** PR, Creative, Design, and Accessibility reviews, each with its own focus.
- **Unslop Interface integration:** its inventory runs in both modes, and a conflict table says when a bold direction may keep an effect Unslop would remove.
- **Report template:** verdict, counts, findings with evidence, design system, slop tells, pillars, and what was not checked.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| None | - | The skill is instructions and reference files only | - |
| Unslop Interface skill | Same repository | Slop inventory and passes | No, install it with the same command |
| Figma Dev Mode or Storybook | Any | Design system comparison in reviews | No |

Without Figma or Storybook, the review skips the spec comparison and says so in the report.

## Installation

From the repository root, install the skill and Unslop Interface into any supported agent:

```bash
node packages/cli install --harness claude --skill frontend-design-review
node packages/cli install --harness claude --skill unslop-interface
```

The same commands work in PowerShell. Use a comma separated list or `all` for several agents, `--scope user` to install for every project, and `--dry-run` to preview.

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

To copy both skills by hand, put them side by side in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/frontend-design-review skills/unslop-interface .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\frontend-design-review, skills\unslop-interface .claude\skills\
```

Each agent has a short guide in `skills/frontend-design-review/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

## Quick Start

```text
Do a design review of the billing settings page in src/pages/Billing.tsx.
```

The agent names the user task, checks tokens and states against the design system, runs the Unslop Interface inventory, evaluates the three pillars, grades accessibility, and returns a report with every issue ranked and a fix for each.

## Usage

### Input

| Input | Required | Example |
|-------|:--------:|---------|
| Target | Yes | Code paths, a PR, Figma frames, screenshots, or a brief for a new interface |
| Mode | No | Review or create; inferred from the request |
| Review type | No | PR, Creative, Design, or Accessibility; inferred from the input |
| Design system | No | Storybook URL, Figma file, token files |
| Direction hints | No | "Editorial", "brutalist", "keep our brand font" |

### Examples

```text
Review PR #412 against our design system. The Figma file is linked in the PR.
```

```text
Accessibility review of the signup flow. Grade it and list what blocks release.
```

```text
Build a landing page for a letterpress print studio. Make it feel editorial, not like a SaaS template.
```

```text
Review this dashboard and fix the blocking and major issues.
```

## How It Works

```text
  Review                                  Create
  1. Task and scope, review type          1. Purpose, tone, constraints,
          │                                  differentiation
  2. Design system: Figma, tokens,                │
     states, exceptions                   2. Respect the design system
          │                                       │
  3. Unslop Interface inventory           3. Build to the direction
          │                                       │
  4. Three pillars, accessibility grade   4. Unslop inventory, remove
          │                                  unchosen tells
  5. Severity                                     │
          │                               5. Review own build (steps 4-7)
  6. Recommendations                              │
          │                                       │
  7. Quick checklist, report  <───────────────────┘
```

## Reference

### Reference files

The agent reads a file only when a step needs it.

| File | Purpose | Used in |
|------|---------|---------|
| `references/review/design-system.md` | Storybook and Figma workflow, token and state checks, exceptions | Review step 2, Create step 2 |
| `references/review/pillars.md` | The three pillars, accessibility grades, severity rules | Review steps 4 and 5 |
| `references/review/type-modifiers.md` | Focus per review type: PR, Creative, Design, Accessibility | Review step 1 |
| `references/create/aesthetic-direction.md` | Committing to a direction, typography, color, motion, composition | Create step 1 |
| `references/create/unslop-handoff.md` | What each mode takes from Unslop Interface and which rule wins | Both modes |
| `references/quality/quick-checklist.md` | Pre-approval checklist by pillar | Review step 7 |
| `references/quality/pattern-examples.md` | Good and bad findings, hierarchy, exceptions, directions | Both modes |

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
# Design review: billing settings

## Summary

- **Mode:** design review
- **Review type:** PR
- **User task:** change plan, update the payment card
- **Verdict:** changes required
- **Counts:** 2 blocking, 3 major, 2 minor
- **Accessibility grade:** below C

## Findings

| # | Severity | Pillar | Evidence | Issue | Recommendation |
|---|----------|--------|----------|-------|----------------|
| 1 | Blocking | Quality craft | `CardRow.tsx:22` | Icon button has no name (WCAG 2.1 4.1.2) | Add `aria-label="Remove card"` |
````

| Section | Contents |
|---------|----------|
| Summary | Mode, review type, task, scope, sources, verdict, counts, accessibility grade |
| Aesthetic direction | Purpose, tone, constraints, differentiation (create mode and Creative reviews) |
| Findings | Each issue with severity, pillar, evidence, and fix |
| Design system | Tokens, missing states, Figma deviations, exceptions |
| Slop tells | Each Unslop Interface tell with its pass and status |
| Pillars | One line of evidence per pillar |
| Files changed | Only when fixes or a build were delivered |
| Not checked | What the review could not cover |

The template is `assets/templates/review-report.md`.

## Troubleshooting

<details>
<summary><strong>The agent does not see the skill</strong></summary>

Restart the agent session after installing, and confirm the folder is in the path your agent reads (see the table in [Installation](#installation)).

</details>

<details>
<summary><strong>The report says Unslop Interface is not installed</strong></summary>

The skill calls Unslop Interface for the slop inventory. Install it into the same agent and rerun the request:

```bash
node packages/cli install --harness claude --skill unslop-interface
```

</details>

<details>
<summary><strong>The review skips the Figma comparison</strong></summary>

The agent could not open the Figma file or Dev Mode. Paste the frame specs or export the frames as images, or accept a review against tokens and the pillars only.

</details>

<details>
<summary><strong>The new build ignores our brand font</strong></summary>

The design system should win over the aesthetic guidelines. Point the agent to the token or theme file that sets the font, and it keeps the font and expresses the direction through layout, color, and motion.

</details>

## Limitations

- Reviews from screenshots cannot grade keyboard access, focus order, or screen reader output; the grade is marked partial.
- The accessibility grade covers WCAG 2.1 A and AA criteria the agent can check; it does not replace testing with assistive technology.
- Figma comparison needs access to the file or exported frames.
- Severity is a judgment with written rules, not a measurement; the report says why when a level is uncertain.
- Create mode produces one direction per run; ask again for alternatives.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [Anthropic: frontend-design skill](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Apache 2.0 | Creative frontend principles in create mode |
| [@Quirinevwm](https://github.com/Quirinevwm) | Not declared | Quality pillar framework and design review workflow |

## License

No license has been declared for this skill yet. See the [root README](../../README.md#license).
