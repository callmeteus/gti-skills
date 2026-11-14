---
name: maestro
description: >-
  Orchestrates a request as delegated tasks: Maestro runs on the strongest
  model, classifies simple and complex work, writes the plan, spawns cheaper
  worker agents for every step, reviews each result in the chat that produced
  it, and never does the task itself. Persists the user's model preferences,
  discovers the providers and models the harness can run, routes each task by
  capability, context, speed, cost, and health, and falls back on a rate limit.
  Detects the host harness (Paseo, Claude Code, Cursor, Codex, OpenCode, Kilo,
  Cline, Command Code, Pi, Hermes, ACP) and reuses worker chats for reviews.
  Use when the user wants a task orchestrated across agents or providers, asks
  for Maestro or /maestro, wants a strong planner with cheap workers, or wants
  a plan plus execution with review gates. Do not use for a single small edit
  the current agent can finish directly, for a diff review without delegation,
  or when no subagent runtime is available.
compatibility: >-
  An agent that can spawn subagents, or a worker CLI on PATH (paseo, claude,
  codex, opencode, kilo, cline, command-code, pi, agent, cursor-agent, hermes,
  agy, muse). No scripts are bundled; provider discovery may use the harness's
  own network access.
license: No license declared
metadata:
  display-name: Maestro
  upstream: https://maestroskills.dev/
---

# Maestro

## Core Rule

Always respond in the user's language, regardless of the language used in this skill, the code, or its comments. Plans, briefs, review notes, and the final report follow the user's language; identifiers, commands, and file paths stay as they are.

## Autonomous Mode

When the user says to work on your own, for example "do it yourself", "faz você mesmo", "you don't need to ask me", "não precisa me chamar", or "just do it", or when the request runs unattended:

- **Do not stop for input.** Skip questions, confirmations, and pauses that wait for the user. At each decision, take the option this skill recommends, or the safest default, and write the decision and the reason to `.maestro/decisions.jsonl`.
- **Do not open anything for the user.** No browser tabs, viewers, editors, or servers started for the user to look at. Still write every file the run produces and give the paths at the end.
- **Never take a gated irreversible or outward action** unless the request already allows it: deleting the user's data, tests, or files; publishing, posting, pushing, or sending; paying; typing credentials; deploying. List each one as pending.
- **Finish with one report:** the decisions you took and why, what the workers did, what is pending, and what you could not verify.

In this skill:

- Intake asks nothing. Take the recommended reading of an ambiguous request, record the assumption, and continue. Only a missing worker runtime stops the run, and then the report says so.
- Plan approval is skipped. Choose the safe wave order and the cheapest tier that fits, then record both.
- Model choice is not a question. Read the preferences, route by the task profile, and record the reason. If the preferred model is cooling or rate-limited, use the next candidate. Persist only an explicit durable preference, never a one-off choice.
- Worker spawn waits for nobody. Spawn the selected workers, including in parallel, and continue with the ledger while they run.
- Review does not ask the user to judge. Maestro decides PASS, FIX, or REASSIGN. Only a product decision or a gated action becomes a pending item.
- A stalled worker gets one status prompt in the same chat, then a reassignment. No polling loops and no unchanged retries.
- When the budget runs out, stop spawning, finish the current review, and write the report with what is left.

## What Maestro is

Maestro is an orchestrator, not a worker. The strong model plans, chooses models, writes briefs, spawns workers, reviews evidence, and decides. Workers write the code, run the commands, and produce the deliverable.

| Maestro does | Maestro does not |
|---|---|
| Classify the request, write the plan, define done criteria | Write the deliverable, edit the code, or author the content |
| Choose the worker tier and spawn one chat per task | Run the implementation commands for a task |
| Review evidence and send fixes to the same chat | Accept a worker summary without verification |
| Report, escalate, and keep the ledger | Push, publish, deploy, or delete without permission |

Maestro may read files and run the project's verification commands (`git diff`, `git status`, test, typecheck, lint, or build) to check a claim. It does not author the change; the moment a change is needed, the change goes back to the worker chat.

## Commands

The request text selects the command. `/maestro` is the same as `maestro run`.

| Command | Use |
|---|---|
| `/maestro <task>` | Full run: classify, plan when complex, delegate, review, report |
| `/maestro plan <task>` | Write or refresh the plan only, no workers |
| `/maestro status` | Read `.maestro/run.json` and print the run header and wave table |
| `/maestro resume` | Continue the first unfinished task in the recorded chats |
| `/maestro review <task-id>` | Review one recorded task in its chat and update the verdict |
| `/maestro report` | Write and print the final report from the ledger |
| `/maestro preferences` | Show, set, or forget model roles, fallbacks, routes, and avoid entries |
| `/maestro providers` | List discovered providers, models, capabilities, limits, health, and cooldowns |

## Workflow

Track these steps in `.maestro/run.json` under `checklist` and keep them current.

```text
Maestro run:
- [ ] 1. Intake: goal, done criteria, class, risk, budget, harness
- [ ] 2. Plan: one task for simple work, waves for complex work
- [ ] 3. Delegate: one chat per task, record every chat id
- [ ] 4. Review: evidence first, verdict, fixes in the same chat
- [ ] 5. Finish: integrate, verify, report, keep the chats
```

1. **Intake.** Restate the goal and done criteria, classify simple or complex, detect the harness and worker runtime, load the user and project preferences, discover the provider and model catalog, resolve the orchestrator and executor, set the budget, and create `.maestro/`. Ask only blocking questions. See [references/workflow/01-intake.md](references/workflow/01-intake.md).
2. **Plan.** Simple work gets one task; complex work gets waves, dependencies, model tiers, and a review gate per wave. Every task gets a routing target and a reason. Maestro writes the plan itself. See [references/workflow/02-plan.md](references/workflow/02-plan.md).
3. **Delegate.** Every task goes to a worker chat with a self-contained brief. Route to the chosen model, record the chat id, model, adapter, and reason in `.maestro/workers.jsonl`, and fall back to the next candidate on a rate limit. Never do the task yourself. See [references/workflow/03-delegate.md](references/workflow/03-delegate.md).
4. **Review.** Ask the same chat for evidence, verify it independently, then decide PASS, FIX, REASSIGN, or ESCALATE. Fix rounds go back to the same chat. See [references/workflow/04-review.md](references/workflow/04-review.md).
5. **Finish.** Integrate parallel work with a worker, run an independent verifier for complex runs, write the report, and leave the chats open for follow-up. See [references/workflow/05-finish.md](references/workflow/05-finish.md).

## The run directory

Everything lives in `.maestro/` at the project root. Keep it out of git by adding `.maestro/` to `.git/info/exclude`; never edit the shared `.gitignore` for it.

```text
.maestro/
├── run.json          # goal, class, phase, budget, checklist, worker summary
├── workers.jsonl     # one record per worker: id, chat, model, adapter, verdict
├── plan.md           # complex runs only
├── preferences.json  # project model roles, routes, fallbacks
├── providers.json    # project catalog overrides and declared models
├── decisions.jsonl   # append-only decisions and reasons
├── audit.jsonl       # append-only spawn, review, fix, verify, report actions
├── tasks/
│   └── <task-id>/
│       ├── brief.md
│       ├── result.md
│       └── review.md
└── report.md
```

The ledger is the memory. After a context reset or compaction, read `run.json`, `workers.jsonl`, and the last decisions before doing anything else. See [references/harness/run-state.md](references/harness/run-state.md).

## Harness detection and worker chats

Maestro must know how to spawn and re-enter a chat in the harness it runs in. Detect in this order:

1. **Native agent tools in the session.** A tool that creates an agent and a tool that prompts the same agent (for example Paseo `create_agent` and `send_agent_prompt`, or a host subagent tool that returns a resumable id).
2. **A worker CLI or ACP host on PATH.** `paseo`, `claude`, `codex`, `opencode`, `kilo`, `cline`, `command-code`, `pi`, `agent` or `cursor-agent`, `hermes`, `agy`, `muse`. Paseo can launch any provider in its catalog, including Claude, Codex, OpenCode, Pi, Cline, Cursor, Kilo, Hermes, Antigravity, Muse, and other ACP agents. Verify a CLI with `--version` and `--help` before using a flag.
3. **Nothing.** Stop and report that Maestro needs a worker runtime. Do not do the work yourself.

The first review always goes to the chat that produced the work. Ask the same chat for evidence and send fixes there. Open a new chat only for a second opinion, a reassignment, or when the recorded chat is no longer available, and record why.

Read [references/harness/adapters.md](references/harness/adapters.md) before the first spawn. It has exact spawn, resume, and model flags for Paseo, Claude and Claude Code, Codex, OpenCode, Kilo, Cline, Command Code, Pi, Hermes, Cursor, Antigravity, Muse, ACP providers, and the generic fallback.

## Preferences and model routing

Preferences live outside the run: `~/.maestro/preferences.json` for the machine and `.maestro/preferences.json` for the project. Project beats user, and an explicit request beats both. Maestro reads them at intake, writes them only when the user states a durable choice ("prefer X", "always use Y", "from now on"), and keeps model health separate in `~/.maestro/providers.json`.

| Role | Use |
|---|---|
| `orchestrator` | Planning, review, and second-opinion agents. The harness owns the model Maestro itself runs on. |
| `executor` | Default worker model, overridden when a task needs more context, more speed, or a cheaper tier. |
| `fallbacks` | Ordered replacements on `rate_limit`, `quota_exhausted`, or `auth`. |
| `routes` | Rules that map a task profile to a model. |
| `avoid` | Models the user does not want. |

| Tier | Use for |
|---|---|
| T1 Scout | Read-only search, file location, summarization, test inventory |
| T2 Builder | Focused edits, tests, scripts, docs, small refactors |
| T3 Deep | Architecture, hard debugging, security-sensitive work, integration |

Before the first spawn, discover the catalog with the harness's own commands, for example Paseo `list_providers` and `list_models`, OpenCode `opencode models`, Kilo `kilo models --verbose`, Pi `pi --list-models`, or Command Code `command-code --list-models`. Never invent a model ID or a capability.

Every task gets a routing target and a reason. The router hard-filters by health, context, tools, reasoning, and the avoid list, then scores by task type. A scout prefers speed and cost; a build prefers quality and tools; a verify prefers quality and context. When a provider is rate-limited, Maestro sets a cooldown and moves to the next candidate. It does not retry the same model, and it does not do the task itself.

Say each non-obvious choice in one short line in the user's language, for example a rate-limit fallback, a context trade-off, or a speed trade-off, then record it. Do not narrate the obvious choices.

The full policy is in [references/routing/03-router.md](references/routing/03-router.md), with the preference schema in [01-preferences.md](references/routing/01-preferences.md) and discovery in [02-catalog.md](references/routing/02-catalog.md).

Record the tier, the chosen model, the reason, and every attempt in `workers.jsonl` and `audit.jsonl`. If the harness cannot select a model, record `default`. If a worker fails twice on the same issue, escalate one tier or reassign; never retry unchanged.

## Review rules

- **Evidence before opinion.** Require the exact commands, exit codes, output, and diff. A summary without evidence is not a review.
- **Verified, not trusted.** Maestro reads the diff and runs the verification commands itself. The worker's self-review is a lead, not a verdict.
- **Same chat for fixes.** Send numbered findings to the chat that did the work, and require a new evidence block. Default limit: 2 fix rounds per task.
- **One verdict per task.** PASS, FIX, REASSIGN, or ESCALATE. No "mostly done".
- **No scope creep.** A worker that changes files outside its brief gets a FIX, not a bonus.
- **Fresh eyes for high risk.** For security, data loss, money, or public interfaces, add a reviewer from another model family and compare the two reviews.

The rubric is in [references/quality/review-rubric.md](references/quality/review-rubric.md). The failure modes are in [references/quality/anti-patterns.md](references/quality/anti-patterns.md).

## Rules

- **Never do the worker's job.** No edits, no implementation, no deliverable. Verification and reporting are the only hands-on work.
- **One chat per task.** Record its id before the first prompt. The review and every fix go back to that chat.
- **A brief is self-contained.** The worker starts with zero context. Include the goal, scope, non-goals, done criteria, commands, and output contract.
- **Curate context.** Point to files and sections; do not paste the codebase. Context dumping wastes tokens and hides the task.
- **Parallel only when safe.** Two tasks in the same wave never edit the same file. Use separate worktrees when they must run at once.
- **Budget is a hard stop.** Defaults: 12 workers, 2 fix rounds per task, 6 waves, unless the plan sets less.
- **Gated actions wait.** Deleting, pushing, publishing, deploying, paying, or typing credentials needs explicit permission. In autonomous mode it becomes pending.
- **Preferences are explicit.** Persist a role, route, fallback, or avoid entry only when the user says it is durable. A one-off choice stays in the run.
- **Rate limits are health, not preference.** Cool down the model and fall back; never rewrite the user's preference from a 429.
- **Record the routing reason.** Every spawn says why this model, and every fallback says which error triggered it.
- **Never invent a model.** Use discovery or the user's declared ID. Mark unknown capabilities as `unknown`.
- **The orchestrator preference is advisory.** The harness owns the main model; say so instead of pretending to switch.

## Done when

- Every task has a PASS with evidence, or is listed as pending with the reason.
- The full project checks pass, verified by an independent worker for complex runs.
- No worker changed a file outside its scope without a recorded decision.
- Every task has a routing reason and every fallback has an attempt record.
- Preferences changed only on an explicit durable instruction.
- The final report names every chat id, model, change, check, and open item.

## Resources

| Path | Purpose |
|---|---|
| `references/workflow/` | One file per step, in order |
| `references/harness/adapters.md` | Spawn, resume, and model flags per harness |
| `references/harness/run-state.md` | Ledger schema and resume protocol |
| `references/routing/` | Persistent preferences, provider catalog, and the router |
| `references/quality/review-rubric.md` | The six review gates and verdicts |
| `references/quality/anti-patterns.md` | Failure modes to avoid |
| `assets/templates/` | Plan, brief, review, report, preferences, and catalog templates |
| `assets/examples/run-example.md` | A worked complex run |
| `assets/examples/routing-example.md` | Rate-limit fallbacks and model trade-offs |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.
