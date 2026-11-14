# 01. Intake

Turn the request into a run record before spawning anything. Intake is the only step where Maestro is allowed to read a little of the project, and only enough to classify the work and write a brief.

## What intake produces

- One goal sentence and a list of done criteria.
- A class: simple or complex.
- The risk flags and the gated actions.
- The worker tier and budget.
- The detected harness and worker adapter.
- `.maestro/run.json`, `.maestro/workers.jsonl`, and `.maestro/decisions.jsonl`.
- A printed run header.

## Steps

1. **Restate the request.** Write one sentence: "The run is done when ..." Do not copy the user's words if they are vague. Name the observable result.
2. **Write done criteria.** Each criterion must be verifiable by reading a diff or running a command. "Works well" is not a criterion; "the CSV route returns 200 with a header row and the tests pass" is.
3. **List non-goals.** Name what the run will not touch. This is the main defense against scope creep.
4. **Classify.** Use the table below. When in doubt, choose simple first; a simple task that grows can be promoted to complex after the scout reports.
5. **Flag risk.** Mark anything irreversible, outward-facing, secret-bearing, production-facing, or money-related.
6. **Load preferences.** Read `~/.maestro/preferences.json` and `.maestro/preferences.json`. Resolve the orchestrator and executor roles, with the project overriding the user.
7. **Discover the catalog.** Use the harness's own commands from [../routing/02-catalog.md](../routing/02-catalog.md) and refresh when the cache is older than a day. Record provider, model, context, quality, speed, cost, tools, limits, and health.
8. **Choose the tier and the route.** T1 for read-only work, T2 for focused edits, T3 for architecture or hard debugging. Pick the default executor candidate with [../routing/03-router.md](../routing/03-router.md). Do not use T3 by default.
9. **Set the budget.** Workers, fix rounds, waves, and an optional token cap. The defaults are 12 workers, 2 fix rounds per task, and 6 waves.
10. **Detect the harness.** Read [../harness/adapters.md](../harness/adapters.md). Record the adapter name, the spawn command or tool, and whether the chat can be resumed.
11. **Create the ledger.** Write `run.json`, create `workers.jsonl` and `decisions.jsonl`, and add `.maestro/` to `.git/info/exclude`.
12. **Print the run header.** Use the interface below. Keep it short.

## Simple or complex

| Signal | Simple | Complex |
|---|---|---|
| Deliverables | One | Two or more |
| Areas | One file or one folder | Several modules or repositories |
| Decisions | None, the request fixes it | Architecture, product, or interface choice |
| Unknowns | None, the path is clear | Needs research before building |
| Parallelism | Not useful | Two or more tasks can run at once |
| Duration | One worker turn | Several waves |
| Review | One review round | A gate per wave plus a final verifier |

A simple run still uses a worker. Maestro never does the work just because the task is small.

## Done criteria

A good criterion has a subject, an action, and an observable result:

- Good: "`GET /reports/:id.csv` returns `text/csv` and a header row, and `npm test -- reports` passes."
- Good: "The settings page loads at 390 px wide with no horizontal scroll."
- Bad: "CSV export works."
- Bad: "Improve the tests."

For each criterion, name the check that proves it: a command, a file to read, a route to call, or a screenshot to inspect.

## Risk flags

| Flag | Examples | Default |
|---|---|---|
| Irreversible | Delete files, drop data, rewrite history, remove a dependency | Ask or mark pending |
| Outward | Push, open a PR, publish, deploy, send a message | Ask or mark pending |
| Secret | Read or type credentials, tokens, keys | Never put in a brief |
| Production | Run against a live service, migrate a database | Ask or mark pending |
| Money | Buy, upgrade, call a paid API in a loop | Ask or mark pending |
| Public surface | Change a CLI flag, API schema, or exported type | Record and review with care |

In autonomous mode, take the safe choice and write the gated action to `pending`. Never perform it silently.

## Blocking questions

Ask only when the answer changes the plan or the done criteria. Maximum three questions, in one message, and only after reading the project enough to make them specific.

Ask when:

- Two very different deliverables match the request.
- The user named an environment or branch that does not exist.
- A gated action is required to finish.
- The request contradicts a project rule.

Do not ask when:

- A safe default exists and can be recorded.
- The answer is discoverable by a scout.
- The question is about style or preference the project already settles.

## Preferences and provider discovery

Read both preference files before choosing anything. The user scope is `~/.maestro/preferences.json`; the project scope is `.maestro/preferences.json`. Project wins. An explicit request wins over both.

- **Orchestrator.** Record the preferred planning and review model. The harness owns the model Maestro is running on, so compare when the harness exposes it and say once if they differ. Do not stop the run for a mismatch.
- **Executor.** Record the default worker model. The router can override it per task, with a reason.
- **Fallbacks and routes.** Read the stored rules. Add a run-scoped override only when the user states one for this run.
- **Avoid.** Drop avoided models before scoring.

Then discover the catalog. Use the provider's own command from [../routing/02-catalog.md](../routing/02-catalog.md). Do not hardcode IDs and do not assume a marketing name is an ID.

If no model passes the hard filters, stop before spawning and report which filter excluded every candidate. Do not start a run that cannot execute.

## Run header

Print this after intake and again after each wave:

```text
MAESTRO  run-2026-11-14-001  complex
goal    Add CSV export to the reports page
done    CSV route returns text/csv, header row, tests pass, no UI regressions
budget  12 workers, 2 fix rounds, 6 waves
harness paseo (native tools, resumable chats)
orchestr claude/claude-opus-5.5 (preference)
executor opencode/deepseek-v4.1-flash (healthy; free fallback ready)
```

For a simple run:

```text
MAESTRO  run-2026-11-14-002  simple
goal    Rename the billing flag and update its call sites
done    No old name remains, tests pass, no public flag change
budget  1 worker, 2 fix rounds
harness claude (CLI session, resumable)
orchestr claude/claude-opus-5.5 (preference)
executor opencode/deepseek-v4.1-flash (healthy)
```

## Status view

`/maestro status` prints the run header plus the wave table. Keep it compact and truthful:

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

Rules for the status view:

- Show the phase and the budget use on the header line.
- Show one line per wave with its passed or total count.
- Show one line per active or failed task, with its chat id and verdict.
- Do not hide a `FIX` or `blocked` line to make the run look cleaner.


## Ledger record

Write the first record before spawning:

```json
{
  "id": "run-2026-11-14-001",
  "goal": "Add CSV export to the reports page",
  "class": "complex",
  "phase": "intake",
  "done": [
    "GET /reports/:id.csv returns text/csv with a header row",
    "The reports page shows a Download CSV action",
    "The reports tests pass"
  ],
  "nonGoals": ["Do not change the PDF export", "Do not add new report types"],
  "constraints": ["Keep the existing auth middleware"],
  "risk": [],
  "budget": {"workersMax": 12, "fixRoundsMax": 2, "wavesMax": 6, "tokenCap": null},
  "harness": {"name": "paseo", "adapter": "paseo-mcp", "resumable": true},
  "routing": {
    "orchestrator": {"provider": "claude", "model": "claude-opus-5.5", "source": "user"},
    "executor": {"provider": "opencode", "model": "deepseek-v4.1-flash", "source": "user"},
    "catalogUpdated": "2026-11-14T15:00:00Z"
  },
  "checklist": {
    "intake": true,
    "plan": false,
    "delegate": false,
    "review": false,
    "finish": false
  }
}
```

## Promote a simple run

Promote to complex when the scout finds any of these:

- The change crosses two or more modules with separate owners.
- The request hides a product or interface decision.
- The tests do not cover the area and a characterization step is needed.
- Two or more independent deliverables appear.
- The work needs a migration, a backfill, or a rollout plan.

Write the promotion and the reason to `decisions.jsonl`, then plan again.
