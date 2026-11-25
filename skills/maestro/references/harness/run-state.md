# Run state

`~/.gti/maestro/<project>/` is the run's memory. It sits outside the repository: Maestro writes nothing into the user's project except the changes the workers make. It must be enough to continue after a context reset, a compaction, or a new agent session.

## Layout

```text
~/.gti/maestro/<project>/
├── run.json
├── workers.jsonl
├── plan.md
├── preferences.json
├── providers.json
├── orchestrators.json
├── decisions.jsonl
├── audit.jsonl
├── tasks/
│   └── <task-id>/
│       ├── brief.md
│       ├── result.md
│       └── review.md
└── report.md
```

## Preference and catalog files

These live outside the run report and are read at intake.

| Scope | Path | Contents |
|---|---|---|
| User | `~/.gti/maestro/preferences.json` | Roles, run defaults, run profiles, fallbacks, routes, avoid |
| Project | `~/.gti/maestro/<project>/preferences.json` | Project overrides |
| User | `~/.gti/maestro/history.jsonl` | Last 50 runs: kind and the settings the user set, for the repeated-request rule |
| User | `~/.gti/maestro/hosts.json` | The cluster: every machine Maestro can run workers on, see [hosts.json](#hostsjson) |
| User | `~/.gti/maestro/providers.json` | Model catalog, limits, health, cooldowns |
| Project | `~/.gti/maestro/<project>/providers.json` | Project overrides and declared entries |
| Project | `~/.gti/maestro/<project>/orchestrators.json` | MCP servers found in this run, their role, tools, and status |

`MAESTRO_HOME` replaces `~/.gti/maestro` when set. They contain no credentials, only provider and model IDs plus health.

## hosts.json

The cluster registry, one file for the machine at `~/.gti/maestro/hosts.json`. Maestro rewrites it at intake from what it can reach: Paseo connected hosts (`paseo host ls --json` or the `list_hosts` tool) and OpenCode servers the user named (`opencode --server <url>`). This machine is always in the cluster, as the entry with `self: true`.

| Field | Type | Meaning |
|---|---|---|
| `updated` | string | ISO timestamp of the last refresh |
| `hosts[].id` | string | Stable id: Paseo `serverId` or registration id, `local` for this machine, or the label |
| `hosts[].label` | string | Name shown in the central |
| `hosts[].self` | boolean | True for this machine |
| `hosts[].via` | string | `local`, `paseo`, or `opencode` |
| `hosts[].address` | string | Connection target without credentials, for example `ssh://deploy@build-box` |
| `hosts[].status` | string | `online`, `offline`, `disabled`, or `unknown` |
| `hosts[].lastSeen` | string | ISO timestamp of the last successful contact |
| `hosts[].providers` | string[] | Provider ids that machine can launch |
| `hosts[].meta` | object | Short labels, for example the Paseo host metadata |

```json
{"version":1,"updated":"2026-11-23T15:00:00Z","hosts":[{"id":"local","label":"studio-desktop","self":true,"via":"local","status":"online","providers":["claude","codex"]},{"id":"srv_build","label":"build-box","via":"paseo","address":"ssh://deploy@build-box","status":"online","lastSeen":"2026-11-23T14:59:40Z","providers":["codex"]}]}
```

Never store a password, token, or key in this file: no `password=` in an address, no auth headers. Every worker record names its machine in `host` (omit it for this machine).

## orchestrators.json

Written at intake by the MCP sweep. It records what was found, not what was hoped for.

| Field | Type | Meaning |
|---|---|---|
| `updatedAt` | string | ISO timestamp of the sweep |
| `sweep` | object | `sessionNative`, `configured`, `knownLocal`, `remote` |
| `servers` | array | One entry per server |
| `servers[].name` | string | Server name |
| `servers[].transport` | string | `stdio` or `http` |
| `servers[].source` | string | `session`, `harness-config`, `known-local`, `remote` |
| `servers[].role` | string | `spawner`, `coordination`, `read-only` |
| `servers[].tools` | object | Capability to exact tool name |
| `servers[].auth` | string | `none`, `harness-session`, `oauth`, or `env:<NAME>` |
| `servers[].resumable` | boolean | Whether a send tool exists |
| `servers[].status` | string | `ready`, `auth-required`, `read-only`, `unavailable`, `error` |
| `servers[].notes` | string | Version caveats and limits |
| `selected` | object | `spawner`, `coordination`, `reason` |

Never store a token, header, or credential in this file. Store the environment variable name instead.

Use [../../assets/templates/orchestrator-registry.json](../../assets/templates/orchestrator-registry.json).

## run.json

One object, updated in place at every phase change.

| Field | Type | Meaning |
|---|---|---|
| `id` | string | `run-<date>-<sequence>` |
| `goal` | string | One sentence |
| `class` | string | `simple` or `complex` |
| `phase` | string | `intake`, `plan`, `delegate`, `review`, `finish`, `done`, `blocked` |
| `done` | string[] | Done criteria |
| `nonGoals` | string[] | What the run will not touch |
| `constraints` | string[] | Rules the workers must keep |
| `risk` | string[] | Risk flags |
| `budget` | object | `workersMax`, `fixRoundsMax`, `wavesMax`, `tokenCap` |
| `harness` | object | `name`, `adapter`, `resumable`, `orchestrator`, `mcp` |
| `routing` | object | `orchestrator`, `executor`, `catalogUpdated` |
| `checklist` | object | Boolean per workflow step |
| `pending` | string[] | Gated actions and open decisions |
| `notVerified` | string[] | Checks that could not run |

Example:

```json
{
  "id": "run-2026-11-14-001",
  "goal": "Add CSV export to the reports page",
  "class": "complex",
  "kind": "feature",
  "profile": {"name": null, "scope": null},
  "explicit": {"executor": {"provider": "opencode", "model": "deepseek-v4.1-flash"}},
  "phase": "review",
  "done": ["CSV route returns text/csv", "Download action exists", "Reports tests pass"],
  "nonGoals": ["Do not change the PDF export"],
  "constraints": ["Keep the existing auth middleware"],
  "risk": [],
  "budget": {"workersMax": 12, "fixRoundsMax": 2, "wavesMax": 6, "tokenCap": null},
  "harness": {"name": "paseo", "adapter": "paseo-mcp", "resumable": true, "orchestrator": "paseo", "mcp": ["paseo", "openagents-workspace"]},
  "routing": {
    "orchestrator": {"provider": "claude", "model": "claude-opus-5.5", "source": "user"},
    "executor": {"provider": "opencode", "model": "deepseek-v4.1-flash", "source": "user"},
    "catalogUpdated": "2026-11-14T15:00:00Z"
  },
  "checklist": {"intake": true, "plan": true, "delegate": true, "review": true, "finish": false},
  "pending": [],
  "notVerified": []
}
```

## workers.jsonl

One JSON object per line, appended when a worker is spawned and updated in place when its state changes. If the harness cannot update lines, append a new record with the same `id` and the newer `status`; the last record wins.

| Field | Meaning |
|---|---|
| `id` | Task id, for example `w2.1` |
| `task` | Short title |
| `type` | `scout`, `build`, `verify`, or `synthesize` |
| `tier` | `T1`, `T2`, or `T3` |
| `provider` | Provider id, for example `opencode` |
| `model` | Model id, or `default` |
| `routing` | Why this model was chosen |
| `attempts` | Every provider/model attempt with its result and cooldown |
| `adapter` | Adapter name from `adapters.md` |
| `host` | Id of the machine the worker runs on, from `hosts.json`; omitted for this machine |
| `orchestrator` | MCP spawner or adapter that owns the chat, or `null` |
| `chat` | Chat or session id, or null |
| `resumable` | Whether the chat can be prompted again |
| `ephemeral` | True for a Paseo ephemeral agent: archived after its first result, so `resumable` is false and the result is in `tasks/<id>/result.md` |
| `status` | `spawned`, `running`, `done`, `blocked`, `failed`, `cancelled` |
| `verdict` | `PASS`, `FIX`, `REASSIGN`, `ESCALATE`, or null |
| `rounds` | Fix rounds used |
| `files` | Files the worker reported changing |
| `notes` | One line of context |

Example:

```json
{"id":"w2.1","task":"Add the CSV serializer and route","type":"build","tier":"T2","provider":"opencode","model":"deepseek-v4.1-flash","routing":"executor role; healthy; quality fits a low-difficulty build","attempts":[{"provider":"opencode","model":"deepseek-v4.1-flash","result":"rate_limit","cooldownUntil":"2026-11-14T15:12:00Z"},{"provider":"opencode","model":"deepseek-v4.1-flash-free","result":"done"}],"adapter":"paseo-mcp","orchestrator":"paseo","chat":"agent_123","resumable":true,"status":"done","verdict":"PASS","rounds":1,"files":["src/reports/csv.ts","src/reports/route.ts"],"notes":null}
```

## decisions.jsonl

Append-only. Every plan change, promotion, reassignment, escalation, adapter change, and gated action.

```json
{"ts":"2026-11-14T15:04:00Z","decision":"Promote run to complex","reason":"The feature touches the route, the UI, and the export tests"}
```

## audit.jsonl

Append-only. Every spawn, prompt, review, fix, verification, and report.

```json
{"ts":"2026-11-14T15:05:00Z","action":"spawn","worker":"w2.1","chat":"agent_123","provider":"opencode","model":"deepseek-v4.1-flash","result":"started"}
{"ts":"2026-11-14T15:21:00Z","action":"review","worker":"w2.1","chat":"agent_123","result":"FIX","tokens":null,"costUsd":null}
```

Add `summary`, one line of what was sent or found, to every prompt, review, fix, and verify record. The central shows it in the run feed; without it the feed falls back to a generic line.

Record tokens and cost only when the harness reports them. Otherwise use null. Do not estimate without saying so.

## Task files

- `brief.md`: the exact prompt sent to the worker.
- `result.md`: the worker's output contract and diff. Required when the chat is not resumable.
- `review.md`: the self-review, Maestro's verification, the verdict, and the fix rounds.

The task folder is the audit trail for one task. Keep it even after PASS.

## Resume protocol

After a context reset, a compaction, or a new session:

1. Read `~/.gti/maestro/<project>/run.json`.
2. Read `~/.gti/maestro/preferences.json`, `~/.gti/maestro/<project>/preferences.json`, `~/.gti/maestro/providers.json`, and `~/.gti/maestro/<project>/orchestrators.json`. Drop models that are cooling or unavailable, and drop MCP servers marked `unavailable` or `auth-required`.
3. Read `~/.gti/maestro/<project>/workers.jsonl` and take the last record per task.
4. Read the last ten lines of `decisions.jsonl`.
5. Find the first task whose verdict is not `PASS`.
6. If its chat is resumable and its model is healthy, send the review or fix prompt to that chat.
7. If its chat is gone, or its model is cooling, route the task again and spawn a new chat from `brief.md` and `result.md`.
8. Continue with the wave and the review gate.

Do not restart a run that has a ledger. Resume it.

## Context compaction

When the conversation is compacted, the ledger is the source of truth, not the chat history. Re-read `run.json`, `workers.jsonl`, and the current task's three files before doing anything else. Do not ask the user to repeat the task.

## Git

The run directory lives in the user's home, outside the repository, so it never shows up in git. `<project>` is the repository folder name; `$GTI_HOME` replaces `~/.gti`.

If the user wants the plan or the report versioned, copy those files into the repository deliberately. Do not commit the whole run directory: it contains worker transcripts and possibly secrets.

## Concurrency

- One writer per file per wave.
- One stateful command at a time: migrations, seeds, dev servers, and tests that share a database.
- Use a worktree per parallel writer when files cannot be split.
- An integration worker owns the merge; Maestro reviews the evidence.

## Size and retention

The ledger is small. The task folders can grow. Keep them until the user confirms the run is closed, then archive or delete the run directory only with permission.

## Report

`report.md` is the durable deliverable. It must be readable without the conversation and without the ledger. See [../../assets/templates/final-report.md](../../assets/templates/final-report.md).
