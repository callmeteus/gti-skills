<div align="center">

# Maestro

> One strong model plans and judges; cheap workers do the work

**Turns a request into delegated tasks: Maestro plans on the strongest model, remembers the user's model preferences, routes each task across providers by capability, context, speed, cost, and health, spawns cheaper workers for every step, reviews each result in the chat that produced it, and never does the work itself.**

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
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Overview

Most agent work mixes two jobs that want different models: deciding what to do, and doing it. Maestro separates them. It runs on the strongest model available, turns the request into a plan and a set of self-contained task briefs, and spawns cheaper worker agents to execute each step. The workers write the code and run the commands; Maestro reviews the evidence, decides the verdict, and sends fixes back to the chat that produced the work.

The skill also remembers how the user likes to work. It stores an orchestrator preference, an executor preference, fallbacks, routes, and an avoid list in `~/.maestro/preferences.json`, with per-project overrides in `.maestro/preferences.json`. It discovers the providers and models the harness can actually run, keeps their context, quality, speed, cost, limits, and health in a catalog, and routes every task to a model that fits. When a provider hits a rate limit, Maestro cools it down and moves to the next candidate instead of retrying the same model. It works with any harness that can spawn subagents or run a resumable worker CLI, detects Paseo, Claude Code, Cursor, Codex, OpenCode, Kilo, and other hosts, records every worker chat id, and reuses those chats for review and fix rounds. A run is simple (one worker, one review) or complex (waves of parallel tasks with a review gate after each wave). In both cases, Maestro never does the task itself.

```text
  request
     |
     v
  intake: goal, done criteria, class, risk, budget, harness
          preferences + provider catalog + router
     |
     +-- simple --> one worker chat --> review --> report
     |
     +-- complex -> plan --> wave 1 --> review gate
                              --> wave 2 --> review gate
                              --> verify --> report
     |
     v
  delegate: primary model -> rate limit? -> cooldown -> fallback model
     |
     v
  .maestro/ run ledger: workers, chats, routes, attempts, decisions, audit, report
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Classify work, write plans, and define done criteria | Write the deliverable or edit the code itself |
| Spawn cheap workers and choose their model tier | Run the implementation commands for a task |
| Review evidence and send fixes to the same chat | Accept a worker summary without verification |
| Keep a run ledger that survives compaction | Push, publish, deploy, or delete without permission |
| Detect the host harness and reuse worker chats | Replace a missing worker runtime with its own hands |
| Remember model preferences and route across providers | Change the main model the harness already runs |
| Cool down a rate-limited provider and fall back | Retry the same limited model before its cooldown |

## Features

- **Orchestrator, not worker:** Maestro plans, delegates, reviews, and reports; workers produce every deliverable.
- **Strong planner, cheap workers:** a tier table maps read-only work to the cheapest model, focused edits to a mid tier, and hard work to a strong model used sparingly.
- **Persistent preferences:** user and project files store the orchestrator, executor, fallbacks, routes, and avoid list, and survive across runs.
- **Provider catalog:** discovers the models the harness can run through Paseo, OpenCode, Kilo, Codex, and other surfaces, and accepts user-declared entries for Cline, Cursor, and hosts without a model list.
- **Task-aware routing:** chooses a model by context, quality, speed, cost, tools, reasoning, and health, with a recorded reason for every task.
- **Visible routing:** says each non-obvious choice in one short line, for example a rate-limit fallback or a context trade-off.
- **Rate-limit fallback:** cools down a limited model and moves to the next candidate; it never retries the same model before the cooldown.
- **Explicit learning:** persists only durable user choices ("prefer X", "always use Y", "from now on"); health data stays separate and a single result never becomes a preference.
- **Suggestions, not assumptions:** repeated choices can prompt a preference suggestion, but only the user makes it durable.
- **Chat reuse:** every worker chat id is recorded at spawn, and the first review plus every fix round go back to that same chat.
- **Harness detection:** native agent tools first, then a resumable worker CLI, then a clear stop with no silent fallback.
- **Harness adapters:** exact spawn, resume, and model flags for Paseo, Claude Code, Codex, OpenCode, Kilo, Cursor, Command Code, and a generic fallback.
- **Simple and complex runs:** one worker for small work, waves with dependencies and review gates for larger work.
- **Plans on demand:** `/maestro plan` writes the execution plan without spawning workers.
- **Evidence-first review:** a six-gate rubric, explicit commands and diffs, and four verdicts: PASS, FIX, REASSIGN, ESCALATE.
- **Fix loop in place:** numbered findings go to the same chat, with a default limit of two rounds before a reassignment.
- **Persistent ledger:** `run.json`, `workers.jsonl`, decisions, audit, task briefs, and a final report survive context resets.
- **Anti-pattern library:** twenty-one failure modes, including doing the work yourself, context dumping, review theater, orphan chats, preference amnesia, hardcoded model IDs, and retrying a rate limit.
- **Budget caps:** worker, wave, and fix-round limits, with token and cost recorded when the harness reports them.
- **Language rule:** the skill always answers in the user's language, regardless of the language of the skill.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| Coding agent with subagents or a resumable session | Any supported agent | Spawns workers and re-enters their chats | No |
| Configured provider and model | Current | The worker runtime and the routing catalog | No |
| Worker CLI, when the host has no resumable subagent | Current | Paseo, Claude Code, Codex, OpenCode, Kilo, or Cursor CLI | No |
| Git | Any recent | Diffs, branches, and worktrees for parallel work | No |
| Project checks | - | Tests, typecheck, lint, and build used as review evidence | No |

No scripts, Python packages, or network services are bundled. Maestro works with the tools the agent already has.

| Platform | Status |
|----------|--------|
| macOS | Supported. Any harness in the registry. |
| Linux | Supported. Any harness in the registry. |
| Windows | Supported. Use PowerShell for the paths and commands that differ. |

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill maestro
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

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/maestro` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/maestro .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\maestro .claude\skills\
```

Each agent has a short guide in `skills/maestro/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

### Optional dependency pre-install

If your host cannot spawn a resumable subagent, install and sign in to one worker CLI before the first run. Maestro detects it on `PATH`:

```bash
paseo --version
claude --version
codex --version
opencode --version
kilo --version
agent --version
```

You need only one. Maestro checks `--help` before using a flag and records the exact command it chose.

Discover the models the installed tools expose:

```bash
paseo provider ls
opencode models
kilo models --verbose
codex debug models --bundled
```

Cline, Cursor, Claude Code, and Command Code may not enumerate models from the CLI in every version. Declare those IDs in `~/.maestro/providers.json`, then reference them from `~/.maestro/preferences.json`; Maestro marks unknown capabilities as `unknown` instead of guessing.

## Quick Start

```text
/maestro preferences set orchestrator claude/claude-opus-5.5
/maestro preferences set executor opencode/deepseek-v4.1-flash
/maestro add CSV export to the reports page, with tests and no PDF changes
```

The first two commands persist the roles; the third starts a run. The model names are examples; use the IDs from discovery. Maestro classifies the work, plans the waves, spawns the workers, reviews their evidence in the same chats, and finishes with a report that names every chat id, model, route, check, and pending item.

## Usage

### Input

| Input | Required | Default | Description |
|-------|:--------:|---------|-------------|
| Task | Yes | - | What the run must deliver. Plain language is enough. |
| Class override | No | Maestro decides | Force `simple` or `complex`. |
| Budget | No | 12 workers, 2 fix rounds, 6 waves | Hard caps for the run. |
| Adapter | No | Detected | Force a harness adapter, for example `paseo-mcp` or `claude-cli`. |
| Model or provider | No | Preferences and router | Force a provider/model for this run, or restrict the candidates. |
| Preference | No | None | "prefer X", "always use Y", or "from now on" writes a durable role, route, fallback, or avoid entry. |
| Plan only | No | Off | Use `/maestro plan <task>` to write the plan without workers. |
| Review target | No | None | Use `/maestro review <task-id>` to review one recorded task. |

### Examples

```text
/maestro rename the billing flag and update its call sites
```

A simple run: one worker, one review round, and a report that lists the changed files and the passing tests.

```text
/maestro plan migrate the settings page from REST to the new client, in waves
```

Plan only. Maestro writes `.maestro/plan.md` with tasks, tiers, dependencies, and review gates, and spawns no workers.

```text
/maestro fix the flaky auth tests. Use Paseo if available; otherwise Claude Code. Keep the chat ids.
```

Forces a preference in the adapter order and makes the chat ids explicit in the report.

```text
/maestro status
```

Reads `.maestro/run.json` and `workers.jsonl` and prints the current run header, wave table, and open verdicts.

```text
/maestro resume
```

Continues the first unfinished task in its recorded chat after an interruption.

```text
/maestro preferences set orchestrator claude/claude-opus-5.5
/maestro preferences set executor opencode/deepseek-v4.1-flash
```

Persists the roles in `~/.maestro/preferences.json` so the next run starts with them.

```text
Prefiro o Opus 5.5 como orquestrador e o DeepSeek Flash como executor. Daqui pra frente, use o free para tarefas rápidas.
```

A natural-language preference statement. Maestro writes the roles and the fast-task route, then reports the change.

```text
/maestro providers --refresh
```

Discovers providers and models, refreshes context, cost, limits, and health, and prints the catalog.

```text
/maestro map the repository with the long-context model; if the executor hits a limit, use the free variant
```

Shows context-first routing and a rate-limit fallback. The preference is not changed; the run uses the free variant only when the primary is cooling.

## How It Works

```text
  1 intake
     goal -> done criteria -> simple or complex -> risk -> budget -> harness
     preferences + provider catalog + router
     create .maestro/run.json, workers.jsonl, decisions.jsonl, audit.jsonl
          |
          v
  2 plan
     simple: one task
     complex: waves -> tasks -> tiers -> dependencies -> gate per wave
     route each task -> provider/model + reason + fallback
          |
          v
  3 delegate
     brief.md -> primary model -> rate limit? -> cooldown -> fallback
     record chat id, provider, model, reason -> workers.jsonl
     parallel only for independent tasks; one writer per file
          |
          v
  4 review
     self-review in the SAME chat -> Maestro verifies evidence
     PASS -> next task
     FIX -> numbered findings to the SAME chat (max 2 rounds)
     REASSIGN -> tighter brief or a higher tier
     ESCALATE -> ask the user or mark pending
          |
          v
  5 finish
     integration worker -> independent verifier -> full checks
     report.md -> short interface in chat -> chats kept for follow-up
```

## Reference

### /maestro

```text
/maestro <task>
```

Starts a full run. Maestro creates the ledger, prints the run header, and executes the workflow.

| Argument | Default | Description |
|----------|---------|-------------|
| `<task>` | Required | The natural-language request |
| `--simple` | Detected | Force a single-worker run |
| `--complex` | Detected | Force a planned run with waves |
| `--budget <n>` | `12` workers | Cap the number of workers |
| `--rounds <n>` | `2` | Cap fix rounds per task |
| `--adapter <name>` | Detected | Force a harness adapter from `references/harness/adapters.md` |
| `--model <provider>/<model>` | Preferences and router | Force one model for this run |
| `--provider <id>` | All discovered | Restrict the candidate list to one provider |

### /maestro plan

```text
/maestro plan <task>
```

Writes or refreshes `.maestro/plan.md` and `run.json` without spawning a worker. Use it when the user wants the task breakdown first.

| Argument | Default | Description |
|----------|---------|-------------|
| `<task>` | Required | The request to plan |
| `--waves <n>` | `6` | Cap the number of waves |
| `--tier <T1\|T2\|T3>` | Per task | Force a worker tier |

### /maestro status

```text
/maestro status
```

Reads `run.json` and `workers.jsonl` and prints the current phase, wave table, verdicts, budget use, and pending items.

```text
MAESTRO  run-2026-11-14-001  complex  review
goal    Add CSV export to the reports page
budget  3/12 workers  1/6 waves  1/2 fix rounds
routes  1 rate-limit fallback, 0 blocked

WAVE 1  discover                 2/2 PASS
  w1.1  scout  T1  agent_101     PASS
  w1.2  scout  T1  agent_102     PASS
WAVE 2  build                    1/2 active
  w2.1  build  T2  agent_123     FIX 1/2
  w2.2  build  T2  agent_104     running
WAVE 3  verify                   waiting
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--json` | Off | Print the ledger summary as JSON |

### /maestro resume

```text
/maestro resume [task-id]
```

Continues a run after an interruption, a compaction, or a new session. It reads the ledger and sends the next review or fix to the recorded chat. Without `task-id`, it picks the first task whose verdict is not PASS.

| Argument | Default | Description |
|----------|---------|-------------|
| `[task-id]` | First unfinished | Task to resume |
| `--reassign` | Off | Start a new chat instead of reusing the recorded one |

### /maestro review

```text
/maestro review <task-id>
```

Runs the self-review and Maestro's verification for one recorded task, then updates its verdict in `workers.jsonl` and `review.md`.

| Argument | Default | Description |
|----------|---------|-------------|
| `<task-id>` | Required | Recorded task, for example `w2.1` |
| `--second-opinion` | Off | Also spawn a fresh reviewer from another model family |
| `--rounds <n>` | `2` | Cap fix rounds for this review |

### /maestro report

```text
/maestro report
```

Writes `.maestro/report.md` from the ledger and prints the short run interface. It does not change the run.

| Argument | Default | Description |
|----------|---------|-------------|
| `--open` | Off | Also print the full report in chat |

### /maestro preferences

```text
/maestro preferences [show|set|avoid|forget] ...
```

Reads or writes the durable model choices. User scope is `~/.maestro/preferences.json`; project scope is `.maestro/preferences.json`. Project wins, and an explicit request wins over both.

| Subcommand | Action |
|------------|--------|
| `show` | Print the effective roles, fallbacks, routes, and avoid list with their sources |
| `set orchestrator <provider>/<model>` | Persist the planning and review model |
| `set executor <provider>/<model>` | Persist the default worker model |
| `set fallback <when> <provider>/<model>` | Add or replace a fallback, for example `rate_limit` |
| `set route <when> <provider>/<model>` | Add or replace a task route, for example `task=scout` |
| `avoid <provider>/<model>` | Never route to this model |
| `forget <key>` | Remove one entry |

Add `--project` to write to the project scope. Maestro persists a preference only when the user states a durable choice.

### /maestro providers

```text
/maestro providers [--refresh] [--json]
```

Lists the providers and models this machine can run, with context, quality, speed, cost, limits, health, and cooldowns. Reads `~/.maestro/providers.json` and refreshes it with the harness's own discovery command.

| Argument | Default | Description |
|----------|---------|-------------|
| `--refresh` | Off | Re-run discovery instead of using the cache |
| `--provider <id>` | All | Show one provider |
| `--json` | Off | Print the catalog as JSON |

### Preference and catalog files

| Path | Contents |
|------|----------|
| `~/.maestro/preferences.json` | User roles, fallbacks, routes, and avoid list |
| `.maestro/preferences.json` | Project overrides |
| `~/.maestro/providers.json` | User model catalog, limits, health, and cooldowns |
| `.maestro/providers.json` | Project catalog overrides and user-declared models |

`MAESTRO_HOME` replaces `~/.maestro` when set. These files hold provider and model IDs plus health, never credentials.

### Run directory

| Path | Contents |
|------|----------|
| `.maestro/run.json` | Goal, class, phase, done criteria, budget, harness, pending items |
| `.maestro/workers.jsonl` | One record per worker: task, tier, model, adapter, chat id, status, verdict, rounds |
| `.maestro/plan.md` | Complex-run waves, tasks, dependencies, and gates |
| `.maestro/decisions.jsonl` | Append-only decisions and reasons |
| `.maestro/audit.jsonl` | Append-only spawn, review, fix, verify, and report actions |
| `.maestro/tasks/<id>/brief.md` | The exact brief sent to the worker |
| `.maestro/tasks/<id>/result.md` | The worker output contract and diff, kept when the chat is not resumable |
| `.maestro/tasks/<id>/review.md` | Self-review, independent verification, verdict, and fix rounds |
| `.maestro/report.md` | The final report |

## Output

A run prints a short interface at intake, after each wave, and at the end:

```text
MAESTRO  run-2026-11-14-001  done
goal    Add CSV export to the reports page
waves   3/3 passed
workers 5 spawned, 5 passed, 0 reassigned
routes  5 primary, 1 rate-limit fallback, 0 blocked
checks  test pass, typecheck pass, lint pass, build pass
chats   w1.1 agent_101, w1.2 agent_102, w2.1 agent_123, w2.2 agent_104, w3.1 agent_105
open    none
```

The full report is written to `.maestro/report.md`:

| Section | Contents |
|---------|----------|
| Summary | Run id, class, status, waves, workers, routes, checks, Maestro model |
| Done criteria | Each criterion, MET or NOT MET, and the evidence |
| Workers | Task, type, tier, provider/model, adapter, chat id, rounds, verdict |
| Routing | Task, provider/model, reason, and every attempt |
| Preferences | Every role, route, fallback, or avoid change, with the old and new value |
| Changes | File, change, and the task that made it |
| Checks | Command, result, and output summary |
| Reviews | Gate failures and how each one was resolved |
| Pending | Gated actions, product decisions, missing access, provider cooldowns, over-budget tasks |
| Not verified | Checks that could not run, platforms not tested, UI states not rendered, unknown model capabilities |
| Chats | Chat ids kept for follow-up |
| Reproduce | Commands needed to reproduce the verification |

## Development

| Command | Action |
|---------|--------|
| `node packages/cli validate --skill maestro` | Check the skill against the repository rules |
| `node packages/cli build` | Regenerate the per-agent guides |
| `node packages/cli check` | Fail when the generated files are stale |
| `node packages/cli list` | Confirm the skill and its packs are registered |

## Troubleshooting

<details>
<summary><strong>Maestro says it needs a worker runtime</strong></summary>

The host has no subagent tool that returns a resumable id, and no supported worker CLI is on `PATH`. Install and sign in to one of `paseo`, `claude`, `codex`, `opencode`, `kilo`, or `agent`, then run `/maestro resume`. Maestro does not do the work itself as a fallback.

</details>

<details>
<summary><strong>The worker chat cannot be resumed</strong></summary>

Some hosts return no id or cannot prompt an existing chat. Maestro records `resumable: false`, asks the worker for the full output contract and diff in `.maestro/tasks/<id>/result.md`, and uses a fresh reviewer for the next round. Reassign only when the written evidence is not enough.

</details>

<details>
<summary><strong>The run lost track after a context reset</strong></summary>

Ask for `/maestro status`, or read `.maestro/run.json` and `.maestro/workers.jsonl`, then run `/maestro resume`. The ledger is the source of truth, not the chat history. Do not start a new run while the old one has an unfinished task.

</details>

<details>
<summary><strong>A worker keeps failing the same check</strong></summary>

Do not send the same prompt again. Maestro sends one numbered FIX to the same chat, then reassigns to a higher tier or another model family. If the task still fails, it escalates with the evidence and records the task as pending.

</details>

<details>
<summary><strong>Two workers changed the same file</strong></summary>

The wave was not parallel-safe. Maestro stops the affected tasks, records the collision in `decisions.jsonl`, and serializes the work into the next wave. For future runs, use separate worktrees or one writer per file.

</details>

<details>
<summary><strong>A worker performed a gated action</strong></summary>

The brief did not list the action as forbidden, or the worker ignored it. Maestro records the action in `audit.jsonl`, reports it, and adds the explicit forbidden list to every subsequent brief. It does not attempt to undo an outward action without permission.

</details>

<details>
<summary><strong>My preferred model is rate-limited</strong></summary>

Maestro reads `Retry-After` or uses a default cooldown, marks the model `cooling` in `~/.maestro/providers.json`, and routes the task to the next candidate. It does not retry the same model before the cooldown, and it does not rewrite your preference. Run `/maestro providers` to see the cooldown and the fallback order.

</details>

<details>
<summary><strong>My preferred model is not found</strong></summary>

The model ID may differ from the marketing name, or the provider may not expose it on this machine. Run `/maestro providers --refresh`, check the IDs with `opencode models`, `kilo models --verbose`, Paseo `list_models`, or `codex debug models`, then update the preference with the real ID. For Cline, Cursor, Claude Code, or Command Code, declare the ID in `~/.maestro/preferences.json` or `~/.maestro/providers.json`.

</details>

<details>
<summary><strong>A preference is not applied</strong></summary>

Check the source and the precedence with `/maestro preferences`: an explicit request beats the project file, which beats the user file. Then check health; a cooling or unavailable model is skipped even when it is preferred. Finally, check that the provider can be launched from this harness.

</details>

<details>
<summary><strong>The orchestrator preference did not change the running model</strong></summary>

Maestro cannot change the model the harness is already running. The preference is used for spawned planner and reviewer agents. If you want the main session on the preferred model, relaunch it with the harness flag, for example `claude --model <model>` or `paseo run --provider <provider>/<model>`. Maestro says this once at intake when it detects a mismatch.

</details>

<details>
<summary><strong>A free-tier model hit its limit</strong></summary>

Free and paid variants are separate models in the catalog, with separate limits. Maestro cools the free model down and falls back to the paid variant or another candidate. If the free model is your preferred executor, the preference stays; only its health changes. Raise the weight of cost in the route if you want the router to wait for the free tier instead.

</details>

<details>
<summary><strong>The report says something was not verified</strong></summary>

That is intentional. A check that could not run, a platform that was not tested, or a UI state that was not rendered is listed instead of being treated as a pass. Reproduce the check with the commands in the report, or accept the gap explicitly.

</details>

## Limitations

- Maestro is only as good as the model that runs it. Planning and review quality drop sharply on a weak main model.
- The harness owns the main model. The orchestrator preference is advisory for the running session and applies to spawned planner and reviewer agents.
- Chat reuse depends on the harness. Hosts without a resumable session fall back to a written result plus a fresh reviewer.
- Model selection is not universal. When the host cannot choose a model, the worker runs on the default and the ledger records it.
- Model discovery is provider-specific. Cline, Cursor, Claude Code, and Command Code may need user-declared IDs, and unknown capabilities stay `unknown`.
- The catalog is a cache, not a guarantee. Free tiers, quotas, prices, and model IDs change; refresh before relying on them.
- Routing is a heuristic, not a benchmark. The review still decides whether the work is good.
- Token and cost reporting is partial. Maestro records them when the harness reports them and uses worker and round caps otherwise.
- Parallel edits need worktrees. A shared checkout with two writers creates collisions that no review can fix.
- Review evidence is produced by the worker. Maestro mitigates this by running the verification checks and reading the diff, but a check that cannot run stays unverified.
- A run can stop on a product decision or a gated action. In autonomous mode those become pending items, not silent choices.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [Maestro Skills](https://maestroskills.dev/) | MIT | The command-first interface, persistent memory layer, wave execution, and curated anti-pattern library that inspired this skill |
| [Paseo](https://paseo.sh/docs/orchestration-workflows) | Apache-2.0 | The orchestration model and the MCP and CLI tools used by the Paseo adapter |
| [Paseo providers](https://paseo.sh/docs/providers), [OpenCode](https://opencode.ai/docs/), [Kilo](https://kilo.ai/docs/) | Respective | The provider discovery and model-limit commands in the catalog reference |
| [Claude Code](https://code.claude.com/docs/en/cli-reference), [Codex](https://developers.openai.com/codex/developer-commands), [OpenCode](https://opencode.ai/docs/), [Cursor CLI](https://cursor.com/docs/cli/overview) | Respective | The session, resume, and model flags documented in the adapters |

## License

No license has been declared for this skill yet. See the [root license section](../../README.md#license).
