---
name: maestro
description: >-
  Orchestrates requests as delegated tasks: Maestro runs on the strongest
  model, classifies simple and complex work, writes the plan, spawns cheaper
  workers for every step, reviews each result in the chat that produced it,
  and never does the task. Persists model preferences, discovers the providers
  and models the harness can run, routes each task by capability, context,
  speed, cost, and health, and falls back on a rate limit. Detects the host
  harness (Paseo, Claude Code, Cursor, Codex, OpenCode, Kilo, Cline, Command
  Code, Pi, Hermes, ACP), probes orchestration MCP servers such as OpenAgents,
  and delegates through any with a spawn and send contract. Reuses worker chats
  for reviews. Use when the user wants a task orchestrated across agents or
  providers, asks for Maestro or /maestro, wants a strong planner with cheap
  workers, or a plan plus execution with review gates. Do not use for a single
  small edit the current agent can finish, for a diff review without
  delegation, or when no subagent runtime is available.
compatibility: >-
  An agent that can spawn subagents, or a worker CLI on PATH (paseo, claude,
  codex, opencode, kilo, cline, command-code, pi, agent, cursor-agent, hermes,
  agy, muse), or an MCP client able to load an orchestration server. No scripts
  are bundled; provider discovery may use the harness's own network access.
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

- **Do not stop for input.** Skip questions, confirmations, and pauses that wait for the user. At each decision, take the option this skill recommends, or the safest default, and write the decision and the reason to `~/.gti/maestro/<project>/decisions.jsonl`.
- **Do not open anything for the user.** No browser tabs, viewers, editors, or servers started for the user to look at. Still write every file the run produces and give the paths at the end.
- **Never take a gated irreversible or outward action** unless the request already allows it: deleting the user's data, tests, or files; publishing, posting, pushing, or sending; paying; typing credentials; deploying. List each one as pending.
- **Finish with one report:** the decisions you took and why, what the workers did, what is pending, and what you could not verify.

In this skill:

- Intake asks nothing. Take the recommended reading of an ambiguous request, record the assumption, and continue. Only a missing worker runtime stops the run, and then the report says so.
- Plan approval is skipped. Choose the safe wave order and the cheapest tier that fits, then record both.
- Model choice is not a question. Read the preferences, route by the task profile, and record the reason. If the preferred model is cooling or rate-limited, use the next candidate. Remember only settings the user stated (in the run kind's profile, or as a durable preference), never a choice Maestro made on its own.
- The run kind is not a question. Detect it, load its profile, and show it in the run header.
- The final worker path is not a question. Use the saved `adapter` when it is usable; otherwise take the recommended path (Paseo through the first of MCP, CLI, or API that works, then an MCP spawner, native agent tools, then the CLIs), record it, and do not save it as a default.
- The MCP sweep asks nothing. Probe the available servers, classify them by tool schema, and use the best spawner. Record a server that needs OAuth as pending instead of starting a login that waits for the user.
- Never edit a user-global harness config to add an MCP server. Use a session-scoped config or the CLI adapter, and list the global registration as pending.
- Worker spawn waits for nobody. Spawn the selected workers, including in parallel, and continue with the ledger while they run.
- Review does not ask the user to judge. Maestro decides PASS, FIX, or REASSIGN. Only a product decision or a gated action becomes a pending item.
- A stalled worker gets one status prompt in the same chat, then a reassignment. No polling loops and no unchanged retries.
- When the budget runs out, stop spawning, finish the current review, and write the report with what is left.

## Output Location

Everything this skill generates (reports, notes, logs, downloads, renders, measurements, and run state) goes to `~/.gti/maestro/<project>/`, where `<project>` is the repository folder name and `GTI_HOME` replaces `~/.gti`. Create the folder when needed. Never write generated files into the user's repository: only the changes the user asked for (their code, tests, or docs) go there, and a generated file goes there only when the user names that place. The run ledger lives in `~/.gti/maestro/<project>/`, and user preferences (defaults, run profiles, model roles), the run history, and the provider catalog in `~/.gti/maestro/`.

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
| `/maestro status` | Read `~/.gti/maestro/<project>/run.json` and print the run header and wave table |
| `/maestro resume` | Continue the first unfinished task in the recorded chats |
| `/maestro review <task-id>` | Review one recorded task in its chat and update the verdict |
| `/maestro report` | Write and print the final report from the ledger |
| `/maestro preferences` | Show, set, or forget model roles, run defaults, run profiles, fallbacks, routes, and avoid entries |
| `/maestro providers` | List discovered providers, models, capabilities, limits, health, and cooldowns |
| `/maestro orchestrators` | List the detected orchestration MCP servers, their role, tools, and status; add `--refresh` to sweep again |

## Workflow

Track these steps in `~/.gti/maestro/<project>/run.json` under `checklist` and keep them current.

```text
Maestro run:
- [ ] 1. Intake: goal, done criteria, class, risk, budget, harness
- [ ] 2. Plan: one task for simple work, waves for complex work
- [ ] 3. Delegate: one chat per task, record every chat id
- [ ] 4. Review: evidence first, verdict, fixes in the same chat
- [ ] 5. Finish: integrate, verify, report, keep the chats
```

1. **Intake.** Restate the goal and done criteria, classify simple or complex, detect the run kind, detect the harness and worker runtime, sweep the orchestration MCP servers, load the user and project preferences with the defaults and the run kind's profile, discover the provider and model catalog, resolve the orchestrator and executor, set the budget, and create `~/.gti/maestro/<project>/`. Ask only blocking questions. See [references/workflow/01-intake.md](references/workflow/01-intake.md).
2. **Plan.** Simple work gets one task; complex work gets waves, dependencies, model tiers, and a review gate per wave. Every task gets a routing target, an orchestrator, and a reason. Maestro writes the plan itself. See [references/workflow/02-plan.md](references/workflow/02-plan.md).
3. **Delegate.** Every task goes to a worker chat with a self-contained brief. Prefer a resumable MCP spawner when one is available. Route to the chosen model, record the chat id, model, adapter, orchestrator, and reason in `~/.gti/maestro/<project>/workers.jsonl`, and fall back to the next candidate on a rate limit. Never do the task yourself. See [references/workflow/03-delegate.md](references/workflow/03-delegate.md).
4. **Review.** Ask the same chat for evidence, verify it independently, then decide PASS, FIX, REASSIGN, or ESCALATE. Fix rounds go back to the same chat. See [references/workflow/04-review.md](references/workflow/04-review.md).
5. **Finish.** Integrate parallel work with a worker, run an independent verifier for complex runs, write the report, and leave the chats open for follow-up. See [references/workflow/05-finish.md](references/workflow/05-finish.md).

## The run directory

Everything lives in `~/.gti/maestro/<project>/` (`<project>` is the repository folder name; `$GTI_HOME` replaces `~/.gti`), outside the repository. Never write run files into the user's project.

```text
~/.gti/maestro/<project>/
├── run.json          # goal, class, phase, budget, checklist, worker summary
├── workers.jsonl     # one record per worker: id, chat, model, adapter, verdict
├── plan.md           # complex runs only
├── preferences.json  # project model roles, routes, fallbacks
├── providers.json    # project catalog overrides and declared models
├── orchestrators.json # detected MCP orchestrators, roles, tools, status
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

1. **An orchestration MCP server with a spawn and a send tool.** Sweep session-native tools, the harness MCP config, and known local or remote servers. Use a resumable server when one exists, and record its role and capability mapping.
2. **Native agent tools in the session.** A tool that creates an agent and a tool that prompts the same agent (for example Paseo `create_agent` and `send_agent_prompt`, or a host subagent tool that returns a resumable id).
3. **A worker CLI or ACP host on PATH.** `paseo`, `claude`, `codex`, `opencode`, `kilo`, `cline`, `command-code`, `pi`, `agent` or `cursor-agent`, `hermes`, `agy`, `muse`, and `openagents`. Paseo can launch any provider in its catalog, including Claude, Codex, OpenCode, Pi, Cline, Cursor, Kilo, Hermes, Antigravity, Muse, and other ACP agents. Verify a CLI with `--version` and `--help` before using a flag.
4. **Nothing.** Stop and report that Maestro needs a worker runtime. Do not do the work yourself.

Paseo has three access paths: its MCP tools (`paseo-mcp`), the `paseo` CLI (`paseo-cli`), and the daemon API through `@getpaseo/client` (`paseo-api`). Probe them in that order and use the first that works; when none works, Paseo is not available and is not used.

Detection lists every usable path; the user picks the final one. When a saved `adapter` in the run kind's profile or in `defaults` is usable, use it. When exactly one path is usable, use it. When several are usable and nothing is saved, ask once which runtime should run the workers, recommended first (Paseo when available), and save the answer to `defaults.adapter` unless the user says "only this run". See [Choosing the final path](references/harness/adapters.md#choosing-the-final-path).

The first review always goes to the chat that produced the work. Ask the same chat for evidence and send fixes there. Open a new chat only for a second opinion, a reassignment, or when the recorded chat is no longer available, and record why.

Read [references/harness/adapters.md](references/harness/adapters.md) before the first spawn. It has exact spawn, resume, and model flags for Paseo (MCP, CLI, and API), Claude and Claude Code, Codex, OpenCode, Kilo, Cline, Command Code, Pi, Hermes, Cursor, Antigravity, Muse, OpenAgents, ACP providers, and the generic fallback. Read [references/harness/mcp-orchestrators.md](references/harness/mcp-orchestrators.md) before the MCP sweep.

## MCP orchestrators

Many harnesses expose agents over the Model Context Protocol, and OpenAgents adds a workspace that can coordinate several of them. Maestro probes what is available instead of assuming a fixed product.

At intake, in this order:

1. **Session-native MCP tools.** Already loaded, so they are the shortest path.
2. **The harness MCP inventory.** For example `claude mcp list`, `codex mcp list --json`, `opencode mcp list`, or Paseo's provider tools.
3. **Known local servers when the CLI is installed.** `agn mcp-server` for OpenAgents Workspace, and `openagents mcp serve` for OpenAgents Coder.
4. **Known remote servers.** `openagents.com/mcp/docs` without a login, and `openagents.com/mcp` with OAuth.

Classify each server by tool schema, not by name:

| Role | Contract | Use |
|---|---|---|
| Spawner | `spawn` plus `send`, ideally `status`, `cancel`, and model selection | Delegate and review in the same chat |
| Coordination | Workspace history, agents, files, todos, approvals | Shared context, published briefs, status, and evidence |
| Read-only | Docs, models, account identity | Discovery only |

A coordination server is not a spawner. A read-only server is not an orchestrator. Never call a tool that posts, spends, or starts work during discovery, and never invent a tool the server does not list.

OpenAgents Coder delegates through `openagents coder delegate --to <agent> --task "<brief>" --json` or `openagents coder chat -p "<brief>" --session <id> --json`, and its MCP surfaces are read-only. OpenAgents Workspace exposes coordination tools, not a message-post tool in the verified build, so Maestro uses it for shared state and finds a real spawn surface for the work.

When the CLI is installed but the harness has no server configured, load it for the worker with the harness's session-scoped flag: Claude Code `--mcp-config`, Codex `-c mcp_servers.<name>...`, or OpenCode `OPENCODE_CONFIG`. If the harness has no session-scoped path, use the CLI adapter and do not edit the user's global config.

Record every server in `~/.gti/maestro/<project>/orchestrators.json`, select one spawner and one coordination server, and add an `orchestrator` field to every worker record. Prefer a session-scoped MCP config over editing a user-global one; in autonomous mode, a global registration is pending.

An orchestrator that spawns its own workers is still a worker to Maestro. Give it a bounded task, require per-task evidence, review in its thread, and never accept its PASS as the verdict. Keep nesting to two levels.


## Preferences and model routing

Preferences live in the GTI home, outside the run and the repository: `~/.gti/maestro/preferences.json` for the machine and `~/.gti/maestro/<project>/preferences.json` for the project. Each file holds `defaults` (the settings every run starts from: adapter, budget, tier, verifier), `profiles` (settings per run kind, such as `security` or `frontend`), and the model `roles`, `fallbacks`, `routes`, and `avoid` list. Model health stays separate in `~/.gti/maestro/providers.json`.

At intake Maestro detects the run kind and layers the settings, highest first: the explicit request, the project profile, the user profile, project defaults, user defaults, then the router default. It learns in three ways:

- **Per run:** whatever the user sets for a run ("security run with model XY in harness Z") is used now and saved to that kind's profile, so the next run of the kind starts the same way. "Just this once" is not saved.
- **Repeated:** a value the user set in the last 3 runs of a kind goes to the profile, and one set in the last 3 runs of any kind goes to `defaults`. The history is `~/.gti/maestro/history.jsonl`.
- **Durable:** "prefer X", "always use Y", or "from now on" writes the role, route, fallback, or avoid entry.

Every saved setting is reported with its old and new value and can be removed with `/maestro preferences forget <key>`. The schema, run kinds, and commands are in [references/routing/01-preferences.md](references/routing/01-preferences.md).

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
- **Preferences come from the user.** Persist a role, route, fallback, or avoid entry only when the user says it is durable. Settings the user states for a run go to that run kind's profile, unless the user says "just this once". Maestro's own choices are never saved as preferences.
- **Rate limits are health, not preference.** Cool down the model and fall back; never rewrite the user's preference from a 429.
- **Record the routing reason.** Every spawn says why this model, and every fallback says which error triggered it.
- **Never invent a model.** Use discovery or the user's declared ID. Mark unknown capabilities as `unknown`.
- **The orchestrator preference is advisory.** The harness owns the main model; say so instead of pretending to switch.
- **MCP is discovered, not assumed.** Probe the server, classify it by tool schema, and record the exact capability mapping. A server name in a doc is not proof that the installed version exposes the tool.
- **Coordination is not delegation.** A workspace server without a spawn and send contract does not start work. Use it for shared state and find a real spawn surface.
- **No global MCP edits without permission.** Prefer a session-scoped config or the CLI adapter. In autonomous mode, a user-global registration is pending.
- **A nested orchestrator is still a worker.** It gets a bounded task and per-task evidence, and its PASS is not Maestro's verdict.

## Done when

- Every task has a PASS with evidence, or is listed as pending with the reason.
- The full project checks pass, verified by an independent worker for complex runs.
- No worker changed a file outside its scope without a recorded decision.
- Every task has a routing reason and every fallback has an attempt record.
- Every delegated task records the orchestrator and adapter used, and any nested orchestrator returned per-task evidence.
- Preferences changed only from settings the user stated, the run kind's profile and `history.jsonl` are updated, and every change is in the report.
- The final report names every chat id, model, change, check, and open item.

## Resources

| Path | Purpose |
|---|---|
| `references/workflow/` | One file per step, in order |
| `references/harness/adapters.md` | Spawn, resume, and model flags per harness |
| `references/harness/mcp-orchestrators.md` | MCP sweep, capability contract, OpenAgents, and nested-orchestrator rules |
| `references/harness/run-state.md` | Ledger schema and resume protocol |
| `references/routing/` | Persistent preferences, provider catalog, and the router |
| `references/quality/review-rubric.md` | The six review gates and verdicts |
| `references/quality/anti-patterns.md` | Failure modes to avoid |
| `assets/templates/` | Plan, brief, review, report, preferences, catalog, and orchestrator registry templates |
| `assets/examples/run-example.md` | A worked complex run |
| `assets/examples/routing-example.md` | Rate-limit fallbacks and model trade-offs |
| `assets/examples/mcp-orchestration-example.md` | A worked OpenAgents sweep, delegation, fallback, and review |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.
