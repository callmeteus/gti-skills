<div align="center">

# Maestro Team

> Workers that share findings on long, hard runs

**Runs a long, hard request through Maestro with team mode on: parallel workers coordinate through mailboxes, a findings board, and task locks, while Maestro still plans, watches the traffic, and reviews every result.**

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

Maestro Team is a short entry point into [Maestro](../maestro/README.md). It gives one Maestro activity its own slash command, `/maestro-team`, so the user does not need to know Maestro's subcommands. It is the same as `/maestro <task> with team mode on`. The skill holds no logic of its own: it loads Maestro from the same skills folder and follows Maestro's workflow, rules, and ledger. Maestro is unchanged and still works on its own.

```text
/maestro-team ... -> loads ../maestro/SKILL.md -> Maestro runs it -> ~/.gti/maestro/<project>/
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Opens mailboxes, a findings board, and task locks for the workers | Fit everyday tasks or sequential work |
| Lets parallel workers share findings and ruled-out paths | Let peers give orders or verdicts |
| Keeps Maestro's plan and per-chat reviews | Replace Maestro's review |

## Features

- **Mailboxes:** one inbox per worker for direct messages, read at checkpoints instead of polled.
- **Findings board:** confirmed findings and ruled-out paths every member sees, so nobody tries a dead end twice.
- **Task locks:** members claim board tasks with an exclusive lock file, one owner per task.
- **Message budget:** each worker has a cap on messages, so the team does not drown in chatter.
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
node packages/cli install --harness claude --skill maestro-team
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

To copy it by hand, put both `skills/maestro-team` and `skills/maestro` in the same agent folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/maestro-team skills/maestro .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\maestro-team, skills\maestro .claude\skills\
```

Each agent has a short guide in `skills/maestro-team/harnesses/<id>/GUIDE.md`.

## Quick Start

```text
/maestro-team find why the sync job corrupts orders under load; nobody knows the cause
```

Maestro checks the gate, plans a team wave of parallel hypotheses, opens the mailboxes, and reviews each worker's result while they share findings.

## Usage

### Input

| Input | Required | Description |
|-------|----------|-------------|
| Task | Yes | A long, hard goal with its done criteria |
| Members | No | How many parallel workers, at least 3 |
| Budget | No | Spend or time limit |

### Examples

```text
/maestro-team rebuild the admin app on the new framework, module by module
/maestro-team hunt the memory leak in the worker service across all queues
```

## How It Works

```text
request -> intake (complex) -> gate check -> plan the team wave
                                                  |
        mailbox.py open -> spawn members <-> mailboxes + board + locks
                                  |
               Maestro reviews each result in its own chat -> close -> report
```

## Reference

### /maestro-team

```text
/maestro-team <long, hard task>
```

Equivalent Maestro command: `/maestro <task> with team mode on`. The steps the skill follows:

1. **Intake.** Follow Maestro's intake ([`01-intake.md`](../maestro/references/workflow/01-intake.md)) with the class fixed to `complex`, and record `entry: "maestro-team"` and `team` in `run.json`.
2. **Check the gate.** Calling this skill is the user asking for team mode. Still read the gate in [`team.md`](../maestro/references/modes/team.md#the-gate): when the task is everyday work or has fewer than 3 workers that need each other's news, say in one line that the mailboxes add cost without benefit, and ask whether to run it as a normal run.
3. **Plan the team wave.** Follow [`02-plan.md`](../maestro/references/workflow/02-plan.md): the team goal, the members, the board tasks, each worker's scope, and the message budget.
4. **Open the team and delegate.** Follow the Team runs section of [`03-delegate.md`](../maestro/references/workflow/03-delegate.md): `mailbox.py open`, the Team section in every brief with the absolute team path, then spawn the members.
5. **Watch and review.** Between turns read `status` and Maestro's inbox; wake a worker only for an urgent message. Review each result in its own chat with [`04-review.md`](../maestro/references/workflow/04-review.md).
6. **Close and report.** `mailbox.py close` at the end of the wave, then Maestro's finish step and report, including the board's confirmed findings and ruled-out paths.

| Argument | Default | Description |
|----------|---------|-------------|
| Task | Required | A long, hard goal with its done criteria |
| Members | Optional | How many parallel workers, at least 3 |
| Budget | Optional | Spend or time limit |

## Output

Everything goes to Maestro's ledger:

```text
~/.gti/maestro/<project>/
├── run.json          # entry: "maestro-team", phase, checklist
├── workers.jsonl     # one record per worker chat
├── decisions.jsonl   # decisions and reasons
├── audit.jsonl       # every spawn, prompt, review, and fix
└── report.md         # the final report
```

| Section | Contents |
|---------|----------|
| `run.json` | The run, with `entry` set to `maestro-team` |
| `report.md` | What was done, the evidence, and what is pending |

See the [Maestro README](../maestro/README.md#output) for the full ledger.

## Troubleshooting

<details>
<summary><strong>The agent says the Maestro skill is missing</strong></summary>

This skill loads Maestro from the same skills folder. Install both with the CLI, which adds Maestro automatically:

```bash
node packages/cli install --harness claude --skill maestro-team
```

</details>

<details>
<summary><strong>/maestro-team does not appear in the agent</strong></summary>

The agent loaded its skills before the install. Restart the agent session, then check the guide in `harnesses/<agent>/GUIDE.md` for how that agent lists skills.

</details>

<details>
<summary><strong>It ran a normal run instead</strong></summary>

The task did not pass the team gate in autonomous mode. Check `decisions.jsonl` in the ledger for the reason, or ask again without autonomous mode to confirm team mode yourself.

</details>

<details>
<summary><strong>Workers in other worktrees cannot find the team</strong></summary>

The brief must carry the absolute team path. Maestro writes it; check the Team section of the worker's brief.

</details>

## Limitations

- Needs the Maestro skill in the same skills folder; it has no logic of its own.
- Needs a worker runtime, like Maestro: an agent with subagents or a worker CLI.
- Team mode costs more than a normal run: every member reads and writes messages.
- The mailbox needs Python 3.8 or newer on the machine that runs the workers.

## License

No license has been declared for this skill yet. See the [root license section](../../README.md#license).
