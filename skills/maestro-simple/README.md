<div align="center">

# Maestro Simple

> One task, one cheap worker, one review

**Runs a request through Maestro as a simple run: one task, one worker chat on the cheapest model that fits, Maestro's review in that same chat, and a short report, with no waves, no team, and no panel.**

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

Maestro Simple is a short entry point into [Maestro](../maestro/README.md). It gives one Maestro activity its own slash command, `/maestro-simple`, so the user does not need to know Maestro's subcommands. It is the same as `/maestro <task>, forced to a simple run`. The skill holds no logic of its own: it loads Maestro from the same skills folder and follows Maestro's workflow, rules, and ledger. Maestro is unchanged and still works on its own.

```text
/maestro-simple ... -> loads ../maestro/SKILL.md -> Maestro runs it -> ~/.gti/maestro/<project>/
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Delegates one task to one worker chat | Split work into waves or parallel tasks |
| Reviews the result with evidence in the same chat | Run team mode, a review panel, or the central |
| Routes to the cheapest model that fits | Edit the code itself |

## Features

- **One worker, one chat:** the whole run is one brief, one worker chat, and one review in that chat.
- **Cheapest model that fits:** Maestro's router picks by context, speed, quality, cost, and health, with one fallback on a rate limit.
- **Evidence review:** Maestro checks the diff and runs the project's checks before it accepts the result.
- **Same ledger:** the run is a normal Maestro run, so `/maestro status` and `/maestro resume` see it.
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
node packages/cli install --harness claude --skill maestro-simple
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

To copy it by hand, put both `skills/maestro-simple` and `skills/maestro` in the same agent folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/maestro-simple skills/maestro .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\maestro-simple, skills\maestro .claude\skills\
```

Each agent has a short guide in `skills/maestro-simple/harnesses/<id>/GUIDE.md`.

## Quick Start

```text
/maestro-simple add a --json flag to the export command and a test for it
```

Maestro writes one brief, spawns one worker on a cheap model, checks its diff and test run in the same chat, and reports.

## Usage

### Input

| Input | Required | Description |
|-------|----------|-------------|
| Task | Yes | What to do, with the done criteria when you have them |
| Model | No | A model or provider to use for the worker; otherwise the saved preferences decide |

### Examples

```text
/maestro-simple fix the failing date test in tests/report.test.ts
/maestro-simple rename the config key timeoutMs to timeout everywhere
/maestro-simple write the missing TSDoc in src/export/
```

## How It Works

```text
request -> intake (class: simple) -> one brief -> one worker chat
                                                   |
            report <- PASS <- review in the same chat <-+
                          \-> FIX (same chat, max 2) -> review
```

## Reference

### /maestro-simple

```text
/maestro-simple <task>
```

Equivalent Maestro command: `/maestro <task>, forced to a simple run`. The steps the skill follows:

1. **Intake.** Follow Maestro's intake ([`01-intake.md`](../maestro/references/workflow/01-intake.md)) with the class fixed to `simple`. Load the preferences, detect the harness and the worker runtime, and record `entry: "maestro-simple"` in `run.json`.
2. **Check the size.** If the request clearly needs several independent tasks, more than one area of the codebase, or a migration, say so in one line and offer the full `/maestro` run instead. Do not split it into waves here.
3. **One task.** Write one brief with Maestro's brief contract ([`03-delegate.md`](../maestro/references/workflow/03-delegate.md)). Route it to the cheapest model that fits the task's context and quality needs, with one fallback.
4. **Delegate.** Spawn one worker chat, record its chat id before the first prompt, and wait for its notification. Do not poll.
5. **Review.** Review in the same chat with Maestro's review ([`04-review.md`](../maestro/references/workflow/04-review.md)): evidence first, then PASS, FIX, REASSIGN, or ESCALATE. At most 2 fix rounds before a reassign.
6. **Report.** A short report: what changed, the checks and their results, the worker and model, and anything pending. Keep the chat open for follow-up.

| Argument | Default | Description |
|----------|---------|-------------|
| Task | Required | What to do, with the done criteria when you have them |
| Model | Optional | A model or provider to use for the worker; otherwise the saved preferences decide |

## Output

Everything goes to Maestro's ledger:

```text
~/.gti/maestro/<project>/
├── run.json          # entry: "maestro-simple", phase, checklist
├── workers.jsonl     # one record per worker chat
├── decisions.jsonl   # decisions and reasons
├── audit.jsonl       # every spawn, prompt, review, and fix
└── report.md         # the final report
```

| Section | Contents |
|---------|----------|
| `run.json` | The run, with `entry` set to `maestro-simple` |
| `report.md` | What was done, the evidence, and what is pending |

See the [Maestro README](../maestro/README.md#output) for the full ledger.

## Troubleshooting

<details>
<summary><strong>The agent says the Maestro skill is missing</strong></summary>

This skill loads Maestro from the same skills folder. Install both with the CLI, which adds Maestro automatically:

```bash
node packages/cli install --harness claude --skill maestro-simple
```

</details>

<details>
<summary><strong>/maestro-simple does not appear in the agent</strong></summary>

The agent loaded its skills before the install. Restart the agent session, then check the guide in `harnesses/<agent>/GUIDE.md` for how that agent lists skills.

</details>

<details>
<summary><strong>It says the task is too big</strong></summary>

The request needs several tasks. Run `/maestro <task>` for a full run with waves, or split the request yourself.

</details>

## Limitations

- Needs the Maestro skill in the same skills folder; it has no logic of its own.
- Needs a worker runtime, like Maestro: an agent with subagents or a worker CLI.
- One task only. Anything that needs parallel workers or waves belongs to the full Maestro run.

## License

No license has been declared for this skill yet. See the [root license section](../../README.md#license).
