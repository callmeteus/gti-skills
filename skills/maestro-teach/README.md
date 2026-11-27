<div align="center">

# Maestro Teach

> A teacher writes the lesson, students prove it

**Runs Maestro's teacher and student mode: a teacher worker writes a lesson, students in fresh chats follow only that lesson, the teacher revises it from their mistakes and wasted effort, and Maestro confirms mastery with the checks.**

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

Maestro Teach is a short entry point into [Maestro](../maestro/README.md). It gives one Maestro activity its own slash command, `/maestro-teach`, so the user does not need to know Maestro's subcommands. It is the same as `/maestro teach <goal>`. The skill holds no logic of its own: it loads Maestro from the same skills folder and follows Maestro's workflow, rules, and ledger. Maestro is unchanged and still works on its own.

```text
/maestro-teach ... -> loads ../maestro/SKILL.md -> Maestro runs it -> ~/.gti/maestro/<project>/
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Has a teacher write and revise a lesson | Start without being asked |
| Tests it on at least 3 isolated students per iteration | Teach to the test |
| Measures errors and wasted effort, and stops at mastery | Write the lesson in Maestro's own chat |

## Features

- **Lessons proven by students:** a lesson is done when students who see only the lesson do the task right.
- **Experiment designs:** lesson variants on the same task, the same lesson on different and held-out tasks, repeats, or different student models.
- **Smarter output:** each trial records length, turns, tool calls, tokens, time, and rework, so the lesson also cuts overthinking.
- **Stop rule:** mastery, 6 iterations, or 2 iterations with no better best score.
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
node packages/cli install --harness claude --skill maestro-teach
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

To copy it by hand, put both `skills/maestro-teach` and `skills/maestro` in the same agent folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/maestro-teach skills/maestro .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\maestro-teach, skills\maestro .claude\skills\
```

Each agent has a short guide in `skills/maestro-teach/harnesses/<id>/GUIDE.md`.

## Quick Start

```text
/maestro-teach teach deepseek-v4.1-flash to write our migration files the way the senior team does
```

A teacher writes the lesson and the checks, students run it in fresh chats, and the lesson is revised until every student passes, shorter and faster.

## Usage

### Input

| Input | Required | Description |
|-------|----------|-------------|
| Goal | Yes | What the lesson must teach |
| Student model | No | The model the lesson is for; otherwise a cheaper model from the catalog |
| Design | No | Repeat, A/B, generalization, or student comparison |
| Destination | No | Where the finished lesson goes, for example a skill folder |

### Examples

```text
/maestro-teach test which of these two prompts makes the cheap model follow our commit rules
/maestro-teach make the student's bug reports shorter without losing the repro steps
/maestro-teach teach a free model to add an API route with tests, on 3 different routes
```

## How It Works

```text
goal -> teacher: acceptance, checks, tasks, lesson v1
          |
          +-> students (>= 3, isolated) -> Maestro runs the checks
          |                                    |
          +<- teacher revises <- judge: divergence + waste
          |
     mastered? -> deliver the lesson + report
```

## Reference

### /maestro-teach

```text
/maestro-teach <what to teach, and to which model>
```

Equivalent Maestro command: `/maestro teach <goal>`. The steps the skill follows:

1. **Intake.** Calling this skill is the explicit request teacher and student mode needs. Follow Maestro's intake ([`01-intake.md`](../maestro/references/workflow/01-intake.md)) and record `entry: "maestro-teach"` and `teaching` in `run.json`.
2. **Set the goal.** What the lesson teaches, the student model (the one the user named, or the cheaper model it is for), and the design: repeat, instruction A/B, generalization, or student comparison. Read the designs in [`teacher-student.md`](../maestro/references/modes/teacher-student.md#experiment-designs).
3. **Run the loop.** Follow [The loop](../maestro/references/modes/teacher-student.md#the-loop): the teacher sets the acceptance list and checks, writes the lesson, Maestro freezes it and spawns at least 3 isolated students, runs the checks, and the teacher judges and revises.
4. **Stop.** When every student of an iteration masters the task inside the efficiency budget (and the held-out tasks in a generalization design), after 6 iterations, or after 2 iterations with no better best score.
5. **Deliver.** The mastered lesson where the user asked, or in `lessons/<lesson-id>/lesson/`, with the report of scores and metrics per iteration and a "Tested with" line. Check the lesson for secrets before it leaves the ledger.

| Argument | Default | Description |
|----------|---------|-------------|
| Goal | Required | What the lesson must teach |
| Student model | Optional | The model the lesson is for; otherwise a cheaper model from the catalog |
| Design | Optional | Repeat, A/B, generalization, or student comparison |
| Destination | Optional | Where the finished lesson goes, for example a skill folder |

## Output

Everything goes to Maestro's ledger:

```text
~/.gti/maestro/<project>/
├── run.json          # entry: "maestro-teach", phase, checklist
├── workers.jsonl     # one record per worker chat
├── decisions.jsonl   # decisions and reasons
├── audit.jsonl       # every spawn, prompt, review, and fix
└── report.md         # the final report
```

| Section | Contents |
|---------|----------|
| `run.json` | The run, with `entry` set to `maestro-teach` |
| `report.md` | What was done, the evidence, and what is pending |

See the [Maestro README](../maestro/README.md#output) for the full ledger.

## Troubleshooting

<details>
<summary><strong>The agent says the Maestro skill is missing</strong></summary>

This skill loads Maestro from the same skills folder. Install both with the CLI, which adds Maestro automatically:

```bash
node packages/cli install --harness claude --skill maestro-teach
```

</details>

<details>
<summary><strong>/maestro-teach does not appear in the agent</strong></summary>

The agent loaded its skills before the install. Restart the agent session, then check the guide in `harnesses/<agent>/GUIDE.md` for how that agent lists skills.

</details>

<details>
<summary><strong>It stopped after 6 iterations without mastery</strong></summary>

The stop rule ended the loop. The report says what the students still get wrong; narrow the goal, give the teacher more context, or pick a stronger student model.

</details>

## Limitations

- Needs the Maestro skill in the same skills folder; it has no logic of its own.
- Needs a worker runtime, like Maestro: an agent with subagents or a worker CLI.
- Teacher and student mode is costly: every iteration runs at least 3 students plus the teacher.
- Mastery holds for the student model and harness it was tested with.

## License

No license has been declared for this skill yet. See the [root license section](../../README.md#license).
