# 05. Finish

Finish means the run is proven, reported, and left in a state the user can continue.

## Integrate

When a wave produced more than one change:

- If the workers used separate worktrees, an integration worker merges them in a clean branch and resolves conflicts.
- If the workers shared a checkout and touched different files, an integration worker runs the full checks on the combined tree.
- If two workers touched the same file, the plan was wrong. Stop, record the collision, and serialize the work in a new wave.

Maestro does not merge or resolve conflicts itself. The integration worker does, and Maestro reviews its evidence.

## Final verification

Every complex run ends with an independent verifier:

- It did not write the change.
- It runs the full project checks, not only the focused ones.
- It reads the complete diff against the base branch.
- It hunts for regressions outside the changed area.
- It reports evidence, not a summary.
- It does not fix anything.

For a simple run, Maestro runs the verification checks itself and reviews the worker's evidence.

The run is not done until the verifier's evidence passes or the failing item is recorded as pending.

## Done checklist

- [ ] Every done criterion is met and evidenced.
- [ ] Every task has a PASS, or is listed as pending with a reason.
- [ ] The full checks pass in the combined tree.
- [ ] The diff matches the plan's scope.
- [ ] No gated action ran without permission.
- [ ] Every worker chat id is in `workers.jsonl`.
- [ ] The report names what was not verified.
- [ ] No dev server, watcher, or background process is left running.

## Learn from the run

At the end, update what the next run needs:

- Write health and cooldowns to `~/.maestro/providers.json`. Do not write preferences from failures.
- Record success and failure counts per model when the harness reports them.
- Persist a preference only if the user stated a durable choice during the run ("from now on", "always"). Write to the user scope unless the user said project.
- Report every preference change with the old value and the new value.
- Do not promote a single success into a preference. The router can use the stats; the user owns the preference.
- If the user switched models manually and said "keep this", persist it with the user's words in `note`.

Update what was observed; leave the rest as `unknown`.

## Report

Write `.maestro/report.md` with [../../assets/templates/final-report.md](../../assets/templates/final-report.md). Include the routing table, every attempt, and every preference change, then print the short interface:

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

If the run is not done:

```text
MAESTRO  run-2026-11-14-001  blocked
done    4/5 tasks passed
blocked w2.2 needs a product decision: the CSV button label
pending deploy to staging (not requested)
chats   w1.1 agent_101, w1.2 agent_102, w2.1 agent_103, w2.2 agent_104
```

## Keep the chats

Do not archive or delete worker chats at the end. They are the review trail and the fastest way to answer a follow-up. List them in the report with the task they own.

If the user asks to clean up, archive only the chats whose tasks passed and whose work is merged, and record the action in `audit.jsonl`.

## Clean up

- Stop any dev server, watcher, or background process a worker started. Use the harness's cancel or stop tool; do not leave a port occupied.
- Remove temporary worktrees only when their work is merged and the user allows it.
- Keep `.maestro/` local. If the user wants the plan or report versioned, copy those two files into the repository deliberately; do not commit the whole run directory.
- Leave the working tree in the state the user asked for: a branch, an uncommitted diff, or a clean tree.

## Pending and not verified

Be explicit:

- **Pending:** a gated action, a product decision, a missing credential, a provider cooldown that outlives the run, or a task over budget.
- **Not verified:** a check that could not run, a platform that was not tested, a UI state that was not rendered, or a model whose capabilities could not be discovered.

Say both in the report. A run that hides an unverified item is worse than a run that reports it.

## Handoff

The report must stand alone. A new session or a different agent should be able to read it and continue without the conversation. Include:

- The goal and done criteria.
- The plan and the waves.
- Every worker, chat id, model, and verdict.
- The changes and the checks.
- The pending items and the open questions.
- The commands needed to reproduce the verification.
