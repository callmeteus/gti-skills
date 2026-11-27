<div align="center">

# Maestro Council

> Several agents debate a question, Maestro chairs

**Convenes a council of 3 to 7 agents on different models that write blind opening positions, debate each other directly on a shared floor for up to 3 rounds, and cast a blind final vote, while Maestro chairs, watches for herding and collusion, and writes the verdict with the dissent.**

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

Maestro Council is a short entry point into [Maestro](../maestro/README.md). It gives one Maestro activity its own slash command, `/maestro-council`, so the user does not need to know Maestro's subcommands. Maestro has no command for it, so the procedure lives in this skill's [`references/council.md`](references/council.md). It loads Maestro from the same skills folder for spawning, routing, the team mailbox, and the ledger. Maestro is unchanged and still works on its own.

```text
/maestro-council ... -> loads ../maestro/SKILL.md -> Maestro runs it -> ~/.gti/maestro/<project>/
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Seats 3 to 7 agents on different models | Review a diff (reviewers there must stay independent) |
| Lets them debate each other directly for up to 3 rounds | Change files or take actions |
| Writes a verdict with the vote, the dissent, and what would change it | Decide for the user |

## Features

- **Blind openings:** every member writes its first position before seeing anyone else's, so the first speaker does not anchor the rest.
- **Real debate:** members argue with each other directly on a shared floor (board posts and direct messages), not only through Maestro.
- **Diverse seats:** different model families when available, a lens per seat, and one devil's advocate.
- **Blind final vote:** each member votes alone in its own chat, with its confidence and the best argument against its own choice.
- **Herding and collusion checks:** Maestro flags position changes without a new argument, copied wording, and votes that ignore the debate.
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
node packages/cli install --harness claude --skill maestro-council
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

To copy it by hand, put both `skills/maestro-council` and `skills/maestro` in the same agent folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/maestro-council skills/maestro .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\maestro-council, skills\maestro .claude\skills\
```

Each agent has a short guide in `skills/maestro-council/harnesses/<id>/GUIDE.md`.

## Quick Start

```text
/maestro-council should the new service use Postgres or DynamoDB, given our team and traffic?
```

Maestro frames the question, seats 5 members on different models, collects blind openings, runs the debate on a shared floor, takes a blind vote, and reports the verdict with the dissent.

## Usage

### Input

| Input | Required | Description |
|-------|----------|-------------|
| Question | Yes | The question or decision, with the options when there are any |
| Context | No | Files, links, or facts every member must read |
| Members | No | 3 to 7, default 5 |
| Rounds | No | Debate rounds, 1 to 3, default up to 3 |

### Examples

```text
/maestro-council monorepo or separate repositories for the mobile and web apps?
/maestro-council is the root cause in docs/incident-42.md plausible? --members 7
/maestro-council which of these three onboarding flows should we ship first? --rounds 2
```

## How It Works

```text
question -> frame + seat members (3 to 7, lenses, devil's advocate)
              |
              +-> blind opening positions (parallel, isolated)
              |
              +-> floor: members debate each other, up to 3 rounds
              |
              +-> blind final vote -> Maestro: verdict, dissent, herding check
```

## Reference

### /maestro-council

```text
/maestro-council <question or decision> [--members <3-7>] [--rounds <1-3>]
```

No Maestro command; the procedure is in [`references/council.md`](references/council.md). The steps the skill follows:

1. **Frame the question.** Read [`references/council.md`](references/council.md). Turn the request into one question with its options, the context each member needs (files to read, facts, constraints), and what a good answer must weigh. Follow Maestro's intake ([`01-intake.md`](../maestro/references/workflow/01-intake.md)) for the harness, preferences, and catalog, record `entry: "maestro-council"` in `run.json`, and create `councils/<id>/` in Maestro's ledger.
2. **Seat the members.** 3 to 7 members, 5 by default, odd so a vote breaks ties. Route each with Maestro's router ([`03-router.md`](../maestro/references/routing/03-router.md)) on a different model family when the catalog has them, give each a lens from [`council.md`](references/council.md#seats-and-lenses), and make one member the devil's advocate.
3. **Opening positions, blind.** Spawn every member in a fresh, quiet chat in parallel with the member brief. Each returns its opening position without seeing anyone else's. Save them as `open/<seat>.md`.
4. **Open the floor.** Open a team folder for the council with Maestro's mailbox (`<skill-dir>/../maestro/scripts/team/mailbox.py --team <ledger>/councils/<id>/floor open --members <seats> --goal "<question>"`). Post every opening position to the floor under its seat name, then tell each member in its own chat to read the floor and answer the others.
5. **Debate, up to 3 rounds.** In each round, every member reads the floor, answers the arguments it disagrees with (board posts, or direct `question` and `answer` messages to another seat), and posts its current position. Maestro moderates between rounds and ends the debate early when a round brings no new argument.
6. **Blind final vote.** Each member, in its own chat and without seeing the others' votes, casts its vote: the option, its confidence, the strongest argument for it, and the strongest argument against it.
7. **Verdict.** Maestro writes `verdict.md`: the question, the vote, the outcome (consensus, majority with dissent, or no decision), the arguments that won, the dissent in its own words, what evidence would change the answer, and any sign of herding or collusion. The verdict is advice; the decision stays with the user.

| Argument | Default | Description |
|----------|---------|-------------|
| Question | Required | The question or decision, with the options when there are any |
| Context | Optional | Files, links, or facts every member must read |
| Members | Optional | 3 to 7, default 5 |
| Rounds | Optional | Debate rounds, 1 to 3, default up to 3 |

## Output

Everything goes to Maestro's ledger:

```text
~/.gti/maestro/<project>/
├── run.json          # entry: "maestro-council", phase, checklist
├── workers.jsonl     # one record per worker chat
├── decisions.jsonl   # decisions and reasons
├── councils/<id>/    # question.md, open/, floor/, votes/, verdict.md
├── audit.jsonl       # every spawn, prompt, review, and fix
└── report.md         # the final report
```

| Section | Contents |
|---------|----------|
| `run.json` | The run, with `entry` set to `maestro-council` |
| `report.md` | What was done, the evidence, and what is pending |

See the [Maestro README](../maestro/README.md#output) for the full ledger.

## Troubleshooting

<details>
<summary><strong>The agent says the Maestro skill is missing</strong></summary>

This skill loads Maestro from the same skills folder. Install both with the CLI, which adds Maestro automatically:

```bash
node packages/cli install --harness claude --skill maestro-council
```

</details>

<details>
<summary><strong>/maestro-council does not appear in the agent</strong></summary>

The agent loaded its skills before the install. Restart the agent session, then check the guide in `harnesses/<agent>/GUIDE.md` for how that agent lists skills.

</details>

<details>
<summary><strong>Every member agreed in the first round</strong></summary>

The question may be too easy, or the seats too alike. Maestro reports it as a weak consensus; ask again with more members, sharper lenses, or a stated counter-position for the devil's advocate.

</details>

<details>
<summary><strong>The members only repeat themselves</strong></summary>

The debate ends early when a round brings no new argument. Give more context or evidence in the request, so the members have something to argue about.

</details>

## Limitations

- Needs the Maestro skill in the same skills folder for spawning, routing, and the mailbox.
- Needs a worker runtime, like Maestro: an agent with subagents or a worker CLI.
- A council costs one worker per member, for several turns each.
- A vote between models is advice, not truth. Models can share a blind spot, so the verdict lists what evidence would change it.
- The floor uses Maestro's team mailbox, which needs Python 3.8 or newer.

## License

No license has been declared for this skill yet. See the [root license section](../../README.md#license).
