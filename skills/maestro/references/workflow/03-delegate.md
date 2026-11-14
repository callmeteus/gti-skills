# 03. Delegate

Delegation is Maestro's main job. A worker starts with zero context, so the brief must be self-contained and the chat id must be recorded before the first prompt.

## The hard rule

Maestro does not do the task. No edits, no implementation, no deliverable. If the worker fails, Maestro writes a better brief, sends a fix to the same chat, reassigns, or escalates. It does not take over.

## Brief contract

Use [../../assets/templates/worker-brief.md](../../assets/templates/worker-brief.md). Every brief has these sections:

1. **Task.** One imperative sentence and the task id.
2. **Context.** Why the task exists and what depends on it.
3. **Scope.** The files, folders, or surfaces the worker owns. Name what it may edit.
4. **Non-goals.** What it must not touch.
5. **Done criteria.** The specific, verifiable result.
6. **Checks.** The exact commands to run and the evidence to return.
7. **Output contract.** The summary, files changed, commands and output, open questions, and `git diff --stat`.
8. **Stop conditions.** What to do when blocked, uncertain, or facing a gated action.
9. **Rules.** One task only, no scope creep, no unrelated cleanup, ask before deleting or publishing.

A good brief fits on one screen. If it needs the whole plan, paste the relevant wave, not the whole plan.

## Curate context

Point to files, sections, and symbols. Do not paste the codebase.

- Good: "Start at `src/reports/route.ts:40`, follow `renderReport` in `src/reports/render.ts`, and read the fixtures in `tests/reports/`."
- Bad: "Here is the repository. Figure it out."

Context dumping wastes tokens and hides the actual task. If the worker needs to explore, give it a scout task instead of a bigger brief.

## Route the task

Before spawning, give the task a route with [../routing/03-router.md](../routing/03-router.md). The router uses the preferences from [../routing/01-preferences.md](../routing/01-preferences.md) and the catalog from [../routing/02-catalog.md](../routing/02-catalog.md).

Answer three questions:

- **Does the task need context?** A repository-wide map or a long transcript filters for a larger context first. A model that is cheaper but smaller is not a candidate.
- **Does the task need speed?** A rename, a format pass, or a small test edit can use a smaller, faster model. A frontier model adds cost, not value.
- **Does the task need quality?** Architecture, hard debugging, security, and final verification use the strongest model that fits the budget.

Then choose:

1. The explicit run instruction, if any.
2. A matching route.
3. The executor role for build and synthesize tasks.
4. The router score order.

Record the primary candidate, one fallback, and the reason. The reason is mandatory; "it seemed better" is not a reason.

## Spawn sequence

1. Read [../harness/adapters.md](../harness/adapters.md) and pick the adapter.
2. Write the brief to `.maestro/tasks/<task-id>/brief.md`.
3. Route the task and record the primary, the fallback, and the reason.
4. Create the worker chat on the primary. Capture the id and model.
5. Append a record to `.maestro/workers.jsonl` with the provider, model, chat, and routing reason.
6. Send the brief as the first prompt.
7. Append an `audit.jsonl` record with the action, chat, model, provider, and adapter.
8. Continue with the ledger or the next task; do not poll.

Example of the record:

```json
{"id":"w2.1","task":"Add the CSV serializer and route","type":"build","tier":"T2","provider":"opencode","model":"deepseek-v4.1-flash","adapter":"paseo-mcp","chat":"agent_123","resumable":true,"status":"running","verdict":null,"rounds":0,"routing":"executor role; healthy; quality fits a low-difficulty build","attempts":[]}
```

The `chat` field is mandatory. A worker without a recorded chat id cannot be reviewed in place.

## Parallelism

Spawn tasks in parallel only when the plan says the wave is safe:

- They do not write the same files.
- They do not depend on each other.
- They do not share a stateful command or a singleton service.

Send the spawns together, then track them in the ledger. If the harness supports completion notifications, wait for them instead of polling.

## Waiting

- Use the harness notification when it exists (Paseo `notifyOnFinish`, Claude Code background sessions, native agent tools).
- Do not run a polling loop. One status check is allowed after a long silence.
- While workers run, Maestro can prepare the next brief, update the plan, or review a finished task. It cannot do their work.

## Rate limits and fallback

Providers fail in different ways. Classify the error before doing anything:

| Error | Action |
|---|---|
| `429` rate limit | Set `cooldownUntil` from `Retry-After` or 2 minutes, record the attempt, spawn the fallback |
| Quota exhausted | Set a cooldown until the reset if known, else 15 minutes, spawn the fallback |
| Auth or permission | Mark the provider `unavailable` for the run, spawn the fallback |
| Model not found | Refresh the catalog, mark the model `unknown`, spawn the fallback |
| Context overflow | Drop the model, choose one with more context, or split the task |
| Tool unsupported | Drop the model, choose one with tools |
| Timeout or `5xx` | Retry once on the same model, then spawn the fallback |

Rules:

- Do not retry a rate-limited model before the cooldown.
- Do not send the same prompt unchanged to a weaker model and call it a fallback. Adapt it only when the new model's context or tools require it.
- Record every attempt in the worker's `attempts` array and in `audit.jsonl`.
- Never write a preference from a failure. A `429` is health, not a user choice.
- If every candidate is cooling or unavailable, stop the task, write the blocked state, and report. Do not do the task yourself.
- If the wait budget allows and the harness has a sleep tool, wait for the earliest cooldown and retry.

## Stalls and retries

A stall is silence past the expected turn, not a slow model.

1. Check the worker status once, in the same chat, with a short prompt: "Report status in five lines: done, running, blocked, or failed."
2. If there is still no answer, cancel the worker and reassign the task.
3. If the worker reports a blocker, decide: provide the missing context, split the task, or escalate.

Retries:

- First failure: send a fix to the same chat with the exact failure and the expected result.
- Second failure on the same issue: reassign to a higher tier or a different model family.
- Third failure: stop and escalate with the evidence. Do not retry unchanged.

## Isolation

- One writer per file per wave.
- Use a separate worktree for parallel edits that cannot be serialized.
- Use a branch or worktree when the worker's change must be reviewed as a unit.
- Never let two workers run a migration, seed, or dev server at the same time.

## Output contract

Ask every worker to return:

```text
STATUS: done | blocked | failed
SUMMARY: three sentences, what changed and why
FILES: every path created, changed, or deleted
CHECKS: each command, its exit code, and the relevant output
DIFF: git diff --stat and the key hunks
OPEN: anything uncertain, out of scope, or needing a decision
NEXT: what you would do next if the task continued
```

A worker that cannot fill this contract has not finished. Send it back with the missing sections.

## Record the review target

The review happens in the same chat. If the harness returns a chat id, store it before the first prompt. If the harness returns no id and cannot resume, record `chat: null`, `resumable: false`, and plan a fresh reviewer that receives the worker's output contract and diff.

If a fallback model produced the result, the review goes to the fallback's chat, not the primary's. Record both attempts and both chat ids when the primary got as far as creating one.

## What not to delegate

- The plan itself. Maestro writes it.
- The verdict. Maestro decides it.
- Gated actions. Those wait for the user.
- Secrets. Never put credentials in a brief; pass the name of an environment variable or a profile instead.
