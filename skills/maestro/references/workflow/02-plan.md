# 02. Plan

Maestro writes the plan. A plan is not the deliverable; it is the task contract that makes delegation and review possible.

## When to write a plan

- **Simple run:** one task in `.maestro/run.json`. No `plan.md`.
- **Complex run:** `.maestro/plan.md` with waves, tasks, dependencies, tiers, and review gates.

Write the plan before the first worker. If a scout is needed to understand the work, make the scout the first task and finish the plan after it reports.

## Plan shape

Use [../../assets/templates/run-plan.md](../../assets/templates/run-plan.md). A plan has:

1. Goal and done criteria, copied from the run record.
2. Non-goals and constraints.
3. Budget and model tiers.
4. Waves, in order.
5. Tasks inside each wave.
6. A review gate at the end of each wave.
7. Risks and open questions.

## Wave design

A wave is a set of tasks that can run at the same time without touching the same files.

Rules:

- **One writer per file per wave.** If two tasks need the same file, put them in different waves or in separate worktrees.
- **Dependencies move later.** A task that needs another task's output goes in a later wave, never in the same one.
- **Small waves.** Two or three tasks per wave is normal. More than four usually means the wave should be split.
- **Scout first when the work is unknown.** A T1 task maps the files, tests, and constraints before anyone edits.
- **Build in the middle.** T2 workers do the focused changes.
- **Verify last.** An independent verifier runs the full checks and looks for regressions.
- **A gate after every wave.** Maestro reviews the wave's evidence before starting the next one.
- **A final gate before done.** The last wave is not accepted until the full project checks pass.

## Task schema

| Field | Meaning |
|---|---|
| `id` | `w<wave>.<n>`, for example `w2.1` |
| `title` | One line, imperative |
| `type` | `scout`, `build`, `verify`, or `synthesize` |
| `tier` | `T1`, `T2`, or `T3` |
| `route` | Primary `provider/model` and the reason from the router |
| `depends` | Task ids that must pass first |
| `scope` | Files, folders, or surfaces the task owns |
| `done` | Criteria specific to this task |
| `checks` | Commands the worker must run and report |
| `output` | What the worker must return |

A task has one owner and one chat. If a task needs two owners, it is two tasks.

## Task types

| Type | Does | Must not |
|---|---|---|
| `scout` | Reads, searches, summarizes, lists tests and constraints | Edit files |
| `build` | Makes the focused change and runs the focused checks | Change files outside its scope |
| `verify` | Runs the full checks, reads the diff, hunts regressions | Fix anything; report only |
| `synthesize` | Combines several worker results into one deliverable | Invent facts that no worker produced |

A verifier that finds a problem does not fix it. The fix goes back to the builder chat or to a new task.

## Model tiers and routing

| Tier | Choose when | Do not use for |
|---|---|---|
| T1 Scout | The task is read-only and bounded | Editing, architecture |
| T2 Builder | The change is local and the pattern is known | Cross-cutting redesigns |
| T3 Deep | The task is ambiguous, risky, or cross-cutting | Routine edits |

Every task also gets a route: one primary `provider/model` and one fallback, chosen with [../routing/03-router.md](../routing/03-router.md).

- The executor role is the default for build and synthesize tasks.
- A scout prefers speed and cost.
- A verify task prefers quality and context.
- A review task prefers quality and a different family from the worker.
- A context-heavy task filters by context before scoring.
- A task can use a different model from the executor role when its profile says so.

Record the route and the reason. Choose the cheapest model that can pass the review. If no candidate passes the hard filters, stop and replan before spawning.

## Parallel safety

Before a wave starts, check every pair of tasks:

- Do they write the same file? Serialize them.
- Do they depend on each other's output? Serialize them.
- Do they touch the same public surface? Either serialize or give each a separate worktree.
- Do they run the same stateful command (migration, seed, dev server)? Serialize them.

When parallel edits are unavoidable, use separate worktrees:

- Paseo: `create_workspace({isolation: "worktree"})`.
- Claude Code: `--worktree <name>`.
- Codex: `--worktree`.
- Other CLIs: create a git worktree yourself and run the worker with its `--cwd`.
- An integration worker merges the results after the wave.

## Plan self-check

Before spawning, Maestro answers these:

- Does every done criterion map to at least one task?
- Does every task have a check that proves it?
- Is every dependency in an earlier wave?
- Does every task have a route, a fallback, and a reason?
- Does any wave contain two writers for the same file?
- Is the cheapest tier used for each task?
- Is there a verifier for the whole run?
- Does the budget cover the plan?

Fix the plan before spawning. Do not discover a collision after the workers start.

## Example

```text
WAVE 1  discover
  w1.1  scout   T1  map the report route, the export helpers, and the tests
  w1.2  scout   T1  list the UI entry points and the existing download pattern

WAVE 2  build
  w2.1  build   T2  add the CSV serializer and the route handler
  w2.2  build   T2  add the Download CSV action and its test

WAVE 3  verify
  w3.1  verify  T1  run the full checks, read the diff, hunt regressions
  w3.2  synth   T2  update the changelog and the user-facing note

ROUTES
  w1.1  opencode/deepseek-v4.1-flash-free  scout, fast, free
  w1.2  opencode/deepseek-v4.1-flash-free  scout, fast, free
  w2.1  opencode/deepseek-v4.1-flash       build, executor preference
  w2.2  opencode/deepseek-v4.1-flash       build, executor preference
  w3.1  claude/claude-opus-5.5             verify, quality and context
  w3.2  opencode/deepseek-v4.1-flash       synth, executor preference
```

Each route also gets a fallback. If the primary is cooling, the fallback is the next candidate from the router, not a guess.

## Updating a plan

- Append decisions to `decisions.jsonl`; do not silently rewrite history.
- Mark a superseded task as `superseded` and give the replacement id.
- If a new task is needed, add it to the current or next wave and say why.
- If the goal changes, stop and treat it as a new run, or ask the user when the change is not implied by the request.

After a context reset, re-read `.maestro/plan.md`, `run.json`, and the last decisions before continuing.
