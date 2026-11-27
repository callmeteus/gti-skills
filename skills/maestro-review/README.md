<div align="center">

# Maestro Review

> Independent reviewers, one consensus on evidence

**Reviews a pull request or the local diff with Maestro's review panel: 1 to 5 independent, read-only reviewers sized by the change, and a consensus Maestro builds on evidence, with a mediated debate for disputed findings.**

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

Maestro Review is a short entry point into [Maestro](../maestro/README.md). It gives one Maestro activity its own slash command, `/maestro-review`, so the user does not need to know Maestro's subcommands. It is the same as `/maestro review pr <url or number>`. The skill holds no logic of its own: it loads Maestro from the same skills folder and follows Maestro's workflow, rules, and ledger. Maestro is unchanged and still works on its own.

```text
/maestro-review ... -> loads ../maestro/SKILL.md -> Maestro runs it -> ~/.gti/maestro/<project>/
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Sizes a panel of 1 to 5 reviewers by the change | Fix the findings |
| Keeps the reviewers independent | Post without permission |
| Builds the consensus on evidence, with a mediated debate | Approve or merge |

## Features

- **Sized panel:** 1 reviewer up to 50 changed lines, 2 up to 300, 3 up to 1,000, 4 up to 3,000, and 5 above, plus 1 for security, money, data, concurrency, or public-interface risk.
- **Independent reviewers:** fresh read-only chats with no shared channel, ideally on different model families.
- **Consensus by evidence:** Maestro matches findings by defect, and a single reviewer with a failing test outweighs a majority that saw nothing.
- **Local diffs too:** with no pull request, the panel reviews the working tree.
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
node packages/cli install --harness claude --skill maestro-review
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

To copy it by hand, put both `skills/maestro-review` and `skills/maestro` in the same agent folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/maestro-review skills/maestro .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\maestro-review, skills\maestro .claude\skills\
```

Each agent has a short guide in `skills/maestro-review/harnesses/<id>/GUIDE.md`.

## Quick Start

```text
/maestro-review 482
```

Maestro reads pull request 482, sizes the panel, spawns independent reviewers, and reports the findings that hold up, with the evidence.

## Usage

### Input

| Input | Required | Description |
|-------|----------|-------------|
| Change | No | Pull request URL or number, or a branch; empty means the local diff |
| Reviewers | No | Panel size, 1 to 5 |
| Post | No | Say "post it" to post the consolidated review; needs the `reviewComments` permission |

### Examples

```text
/maestro-review https://github.com/owner/repo/pull/482
/maestro-review feature/export-csv
/maestro-review
/maestro-review 482 with 4 reviewers and post the result
```

## How It Works

```text
change -> size the panel (1 to 5)
            |
            +-> reviewer 1 ---+
            +-> reviewer 2 ---+--> Maestro: match, classify, debate disputed (max 2 rounds)
            +-> reviewer k ---+                 |
                                        verdict + findings -> report (post only with permission)
```

## Reference

### /maestro-review

```text
/maestro-review <pull request, branch, or nothing for the local diff>
```

Equivalent Maestro command: `/maestro review pr <url or number>`. The steps the skill follows:

1. **Find the change.** A pull request URL or number, a branch against its base, or, with nothing given, the local diff (`git diff` plus staged changes). Read it with the forge's CLI or MCP server; record `entry: "maestro-review"` in `run.json`.
2. **Size the panel.** Use the panel table in [`review-panel.md`](../maestro/references/modes/review-panel.md): 1 to 5 reviewers by changed lines, plus 1 for risk. A size the user gave, or `defaults.reviewPanel`, wins within 1 to 5.
3. **Spawn the reviewers.** Fresh, read-only, quiet chats in parallel, on different model families when the catalog has them, each with the reviewer brief and output contract from `review-panel.md`. No mailbox, no shared writable folder.
4. **Build the consensus.** Match findings by defect, classify them, run the mediated debate for disputed ones, and decide on evidence. Write `reviews/<id>/` in the ledger.
5. **Report.** The verdict (PASS, PASS with notes, or FIX), the confirmed findings with file, line, scenario, and evidence, the unresolved ones with both sides, and what no reviewer checked.
6. **Post only with permission.** With the `reviewComments` permission (see [`github.md`](../maestro/references/harness/github.md)), post one consolidated review. Without it, give the review text so the user can post it.

| Argument | Default | Description |
|----------|---------|-------------|
| Change | Optional | Pull request URL or number, or a branch; empty means the local diff |
| Reviewers | Optional | Panel size, 1 to 5 |
| Post | Optional | Say "post it" to post the consolidated review; needs the `reviewComments` permission |

## Output

Everything goes to Maestro's ledger:

```text
~/.gti/maestro/<project>/
├── run.json          # entry: "maestro-review", phase, checklist
├── workers.jsonl     # one record per worker chat
├── decisions.jsonl   # decisions and reasons
├── audit.jsonl       # every spawn, prompt, review, and fix
└── report.md         # the final report
```

| Section | Contents |
|---------|----------|
| `run.json` | The run, with `entry` set to `maestro-review` |
| `report.md` | What was done, the evidence, and what is pending |

See the [Maestro README](../maestro/README.md#output) for the full ledger.

## Troubleshooting

<details>
<summary><strong>The agent says the Maestro skill is missing</strong></summary>

This skill loads Maestro from the same skills folder. Install both with the CLI, which adds Maestro automatically:

```bash
node packages/cli install --harness claude --skill maestro-review
```

</details>

<details>
<summary><strong>/maestro-review does not appear in the agent</strong></summary>

The agent loaded its skills before the install. Restart the agent session, then check the guide in `harnesses/<agent>/GUIDE.md` for how that agent lists skills.

</details>

<details>
<summary><strong>It cannot read the pull request</strong></summary>

The forge CLI or MCP server is not signed in. Run `gh auth status` (GitHub) or check the Forgejo MCP server, sign in yourself, and run the review again. Maestro never handles a token.

</details>

<details>
<summary><strong>It did not post the review</strong></summary>

Posting needs the `reviewComments` permission. Say so in the request, or save it in `defaults.forge`.

</details>

## Limitations

- Needs the Maestro skill in the same skills folder; it has no logic of its own.
- Needs a worker runtime, like Maestro: an agent with subagents or a worker CLI.
- Reviewer independence is enforced by what Maestro shares, not by the operating system.
- A panel costs one worker per reviewer; large changes use up to 5.

## License

No license has been declared for this skill yet. See the [root license section](../../README.md#license).
