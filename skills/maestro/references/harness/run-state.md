# Run state

`.maestro/` is the run's memory. It must be enough to continue after a context reset, a compaction, or a new agent session.

## Layout

```text
.maestro/
├── run.json
├── workers.jsonl
├── plan.md
├── preferences.json
├── providers.json
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
| User | `~/.maestro/preferences.json` | Durable roles, fallbacks, routes, avoid |
| Project | `.maestro/preferences.json` | Project overrides |
| User | `~/.maestro/providers.json` | Model catalog, limits, health, cooldowns |
| Project | `.maestro/providers.json` | Project overrides and declared entries |

`MAESTRO_HOME` replaces `~/.maestro` when set. Keep these files out of git. They contain no credentials, only provider and model IDs plus health.

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
| `harness` | object | `name`, `adapter`, `resumable` |
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
  "phase": "review",
  "done": ["CSV route returns text/csv", "Download action exists", "Reports tests pass"],
  "nonGoals": ["Do not change the PDF export"],
  "constraints": ["Keep the existing auth middleware"],
  "risk": [],
  "budget": {"workersMax": 12, "fixRoundsMax": 2, "wavesMax": 6, "tokenCap": null},
  "harness": {"name": "paseo", "adapter": "paseo-mcp", "resumable": true},
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
| `chat` | Chat or session id, or null |
| `resumable` | Whether the chat can be prompted again |
| `status` | `spawned`, `running`, `done`, `blocked`, `failed`, `cancelled` |
| `verdict` | `PASS`, `FIX`, `REASSIGN`, `ESCALATE`, or null |
| `rounds` | Fix rounds used |
| `files` | Files the worker reported changing |
| `notes` | One line of context |

Example:

```json
{"id":"w2.1","task":"Add the CSV serializer and route","type":"build","tier":"T2","provider":"opencode","model":"deepseek-v4.1-flash","routing":"executor role; healthy; quality fits a low-difficulty build","attempts":[{"provider":"opencode","model":"deepseek-v4.1-flash","result":"rate_limit","cooldownUntil":"2026-11-14T15:12:00Z"},{"provider":"opencode","model":"deepseek-v4.1-flash-free","result":"done"}],"adapter":"paseo-mcp","chat":"agent_123","resumable":true,"status":"done","verdict":"PASS","rounds":1,"files":["src/reports/csv.ts","src/reports/route.ts"],"notes":null}
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

Record tokens and cost only when the harness reports them. Otherwise use null. Do not estimate without saying so.

## Task files

- `brief.md`: the exact prompt sent to the worker.
- `result.md`: the worker's output contract and diff. Required when the chat is not resumable.
- `review.md`: the self-review, Maestro's verification, the verdict, and the fix rounds.

The task folder is the audit trail for one task. Keep it even after PASS.

## Resume protocol

After a context reset, a compaction, or a new session:

1. Read `.maestro/run.json`.
2. Read `~/.maestro/preferences.json`, `.maestro/preferences.json`, and `~/.maestro/providers.json`. Drop models that are cooling or unavailable.
3. Read `.maestro/workers.jsonl` and take the last record per task.
4. Read the last ten lines of `decisions.jsonl`.
5. Find the first task whose verdict is not `PASS`.
6. If its chat is resumable and its model is healthy, send the review or fix prompt to that chat.
7. If its chat is gone, or its model is cooling, route the task again and spawn a new chat from `brief.md` and `result.md`.
8. Continue with the wave and the review gate.

Do not restart a run that has a ledger. Resume it.

## Context compaction

When the conversation is compacted, the ledger is the source of truth, not the chat history. Re-read `run.json`, `workers.jsonl`, and the current task's three files before doing anything else. Do not ask the user to repeat the task.

## Git

Keep `.maestro/` local by default:

```bash
git rev-parse --git-dir
```

Append `.maestro/` to `.git/info/exclude` if it is not there. Never edit the shared `.gitignore` for it.

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
