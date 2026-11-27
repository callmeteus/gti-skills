<div align="center">

# Maestro Plan

> Maestro's plan, with no workers started

**Writes a Maestro plan for a request (tasks, waves, dependencies, model routes, done criteria, and review gates) and stops before any worker starts, so the user can read it and run it later.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Runtime](https://img.shields.io/badge/runtime-agent%20with%20subagents-blue.svg)](#requirements)
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
- [License](#license)

## Overview

Maestro Plan is a short entry point into [Maestro](../maestro/README.md). It gives one Maestro activity its own slash command, `/maestro-plan`, so the user does not need to know Maestro's subcommands. It is the same as `/maestro plan <task>`. The skill holds no logic of its own: it loads Maestro from the same skills folder and follows Maestro's workflow, rules, and ledger. Maestro is unchanged and still works on its own.

```text
/maestro-plan ... -> loads ../maestro/SKILL.md -> Maestro runs it -> ~/.gti/maestro/<project>/
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Writes the tasks, waves, routes, and done criteria | Start workers or send briefs |
| Estimates the budget and names the models | Change the user's repository |
| Leaves a plan that /maestro resume can run | Review or verify anything |

## Features

- **Plan only:** Maestro's intake and plan, then a stop before the first spawn.
- **Routing shown:** each task names its model, fallback, and the reason, so the cost is visible before anything runs.
- **Runnable later:** the plan is a normal Maestro ledger, so `/maestro resume` runs it.
- **Same ledger as Maestro:** runs land in `~/.gti/maestro/<project>/`, so `/maestro status`, `/maestro resume`, and the central see them.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| [Maestro](../maestro/README.md) skill | Same commit | Does the work; this skill only calls it | Yes, by the CLI installer |
| Coding agent with subagents or a resumable session | Any supported agent | Spawns workers and re-enters their chats | No |
| Worker CLI, when the host has no resumable subagent | Current | See Maestro's worker runtimes | No |

| Platform | Status |
|----------|--------|
| macOS | Supported. |
| Linux | Supported. |
| Windows | Supported. Use PowerShell for the paths and commands that differ. |

## Installation

From the repository root, install the skill into any supported agent. The installer adds Maestro too, because this skill requires it:

```bash
node packages/cli install --harness claude --skill maestro-plan
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--scope user` to install for every project, and `--dry-run` to preview. The skill is in the `coding` and `personal` packs (`--pack coding` or `--pack personal`).

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

To copy it by hand, put both `skills/maestro-plan` and `skills/maestro` in the same agent folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/maestro-plan skills/maestro .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\maestro-plan, skills\maestro .claude\skills\
```

Each agent has a short guide in `skills/maestro-plan/harnesses/<id>/GUIDE.md`.

## Quick Start

```text
/maestro-plan migrate the reports module from REST to the new GraphQL schema
```

Maestro classifies the work, writes the waves and routes to its ledger, prints the plan, and starts nothing.

## Usage

### Input

| Input | Required | Description |
|-------|----------|-------------|
| Task | Yes | What the plan is for |
| Budget | No | A spend or time limit the plan must fit |

### Examples

```text
/maestro-plan rebuild the settings page with the new design system
/maestro-plan how would you split the payment refactor, and what would it cost?
```

## How It Works

```text
request -> intake -> classify -> plan.md (tasks, waves, routes, gates)
                                      |
                                      +-> print the plan -> stop
                                          (later: /maestro resume)
```

## Reference

### /maestro-plan

```text
/maestro-plan <task>
```

Equivalent Maestro command: `/maestro plan <task>`. The steps the skill follows:

1. **Intake.** Follow Maestro's intake ([`01-intake.md`](../maestro/references/workflow/01-intake.md)): goal, done criteria, simple or complex, risk, budget, harness, preferences, and catalog. Record `entry: "maestro-plan"` and `phase: "planned"` in `run.json`.
2. **Plan.** Follow Maestro's plan step ([`02-plan.md`](../maestro/references/workflow/02-plan.md)): one task for simple work, waves for complex work, each task with its routing target, fallback, reason, and done criteria. Write it to `plan.md` in the ledger.
3. **Print it.** Show the run header, the wave table, the model per task with the reason, the budget estimate, and the open questions. Say how to run it: `/maestro resume` continues this plan, and `/maestro <task>` starts a new run.
4. **Stop.** Start no worker, spawn nothing, and send no brief.

| Argument | Default | Description |
|----------|---------|-------------|
| Task | Required | What the plan is for |
| Budget | Optional | A spend or time limit the plan must fit |

## Output

Everything goes to Maestro's ledger:

```text
~/.gti/maestro/<project>/
├── run.json          # entry: "maestro-plan", phase, checklist
├── workers.jsonl     # one record per worker chat
├── decisions.jsonl   # decisions and reasons
├── audit.jsonl       # every spawn, prompt, review, and fix
└── report.md         # the final report
```

| Section | Contents |
|---------|----------|
| `run.json` | The run, with `entry` set to `maestro-plan` |
| `report.md` | What was done, the evidence, and what is pending |

See the [Maestro README](../maestro/README.md#output) for the full ledger.

## Troubleshooting

<details>
<summary><strong>The agent says the Maestro skill is missing</strong></summary>

This skill loads Maestro from the same skills folder. Install both with the CLI, which adds Maestro automatically:

```bash
node packages/cli install --harness claude --skill maestro-plan
```

</details>

<details>
<summary><strong>/maestro-plan does not appear in the agent</strong></summary>

The agent loaded its skills before the install. Restart the agent session, then check the guide in `harnesses/<agent>/GUIDE.md` for how that agent lists skills.

</details>

<details>
<summary><strong>/maestro resume starts a different task</strong></summary>

Resume continues the latest run in the project's ledger. Run it in the same repository folder, and before starting another Maestro run there.

</details>

## Limitations

- Needs the Maestro skill in the same skills folder; it has no logic of its own.
- Needs a worker runtime, like Maestro: an agent with subagents or a worker CLI.
- The plan is an estimate. Routes and costs can change at run time when a provider is rate-limited or a model is unavailable.

## License

No license has been declared for this skill yet. See the [root license section](../../README.md#license).
