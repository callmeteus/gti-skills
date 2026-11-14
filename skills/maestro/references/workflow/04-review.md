# 04. Review

Review is where Maestro earns its cost. The worker produced a change; Maestro decides whether the change is real, complete, and safe.

## Evidence before opinion

The worker's summary is a claim. Accept only evidence that Maestro can check:

- The exact commands run, with exit codes and output.
- `git diff --stat` and the key hunks.
- The files changed, and whether they match the brief's scope.
- The done criteria, each marked met or not met.
- The open questions and anything the worker did not verify.

A review without this evidence is review theater. Send the worker back to collect it.

## Step 1: self-review in the same chat

Send this to the chat that did the work. Do not open a new chat for the first review.

```text
Review your own work. Do not defend it; verify it.

1. Re-read the task and the done criteria in your brief.
2. Run every check again and paste the exact commands, exit codes, and output.
3. Paste git diff --stat and the hunks that matter.
4. List every file you changed and say whether it was in scope.
5. Mark each done criterion as MET or NOT MET with the evidence.
6. List anything uncertain, skipped, out of scope, or needing a decision.
7. End with exactly one of: PASS, FIX: <numbered findings>, or BLOCKED: <reason>.
```

A self-review is useful because the worker still has the context. It is not the verdict.

## Step 2: verify independently

Maestro checks the evidence itself:

- Read the diff and the changed files.
- Run the project's test, typecheck, lint, or build command. Verification is allowed; authoring is not.
- Compare the diff to the brief's scope. Flag any file outside it.
- Check each done criterion against the evidence, not the worker's claim.
- Look for the common failures: a test that was weakened, a mock that hides the real path, an error swallowed, a public surface changed, a secret added, a dependency added without need.
- For UI work, check the rendered result when the harness can do it; otherwise require a screenshot or a DOM assertion.

If the evidence is missing, do not guess. Ask the same chat for the missing evidence.

## Step 3: verdict

| Verdict | When | Next |
|---|---|---|
| `PASS` | Every done criterion is met, every check passes, no scope creep, no blocker | Accept and update the ledger |
| `FIX` | A criterion is unmet, a check fails, or a file is out of scope | Send numbered findings to the same chat |
| `REASSIGN` | Two fix rounds failed, the worker is the wrong tier, or the chat is gone | New worker with a tighter brief |
| `ESCALATE` | A product decision, a gated action, or missing access blocks the work | Ask the user, or mark pending in autonomous mode |

No "mostly done". A task is PASS or it is not.

## Step 4: the fix loop

Send findings to the same chat, numbered, with the expected result:

```text
FIX 1: The route returns application/json, not text/csv. Expected Content-Type: text/csv; charset=utf-8. Evidence: ...
FIX 2: tests/reports/export.test.ts was changed to skip the failing case. Restore the assertion and make it pass.
FIX 3: src/billing/flag.ts is outside your scope. Revert it and explain why it changed.
```

Rules:

- One fix message per round, not a stream of small messages.
- Require a new evidence block after the fix.
- Default maximum: 2 rounds per task.
- If a fix changes the task's scope or done criteria, update the plan and record the decision first.

After the limit, reassign to a higher tier or a different model family. Do not loop.

## Step 5: second opinions

A fresh reviewer is worth it when:

- The change touches security, money, data loss, or a public interface.
- The worker and Maestro disagree on the facts.
- The same chat is unavailable.
- The task failed twice and a different model family may see the blind spot.

Give the fresh reviewer the brief, the diff, and the evidence, not the worker's self-review. Ask it to try to break the change:

```text
You are an independent reviewer. You did not write this change.
Task and done criteria: ...
Diff and evidence: ...
Find what is wrong: correctness, missing cases, weakened tests, unnecessary complexity, scope creep, safety. Do not fix anything. End with PASS, FIX with findings, or ESCALATE with the decision needed.
```

Maestro compares both reviews and makes the final call. A second opinion does not replace the evidence check.

## Model fit

A review judges the work, but it also notices when the wrong model was chosen:

- A cheap model failed on a task that needed reasoning: reassign to T3 instead of running two more fix rounds.
- A frontier model was used for a rename: pass it, note the cost, and do not repeat it.
- A fallback model produced the result: review it against the same rubric, not a lower bar.
- A context overflow forced a split: check that the split did not lose part of the task.
- A rate limit changed the model mid-task: check that the second model saw the context it needed.

Record the route and the attempts in the review. "The model was weak" is not a finding; "the task needed T3 and ran on T1" is.

## The six gates

Use [../quality/review-rubric.md](../quality/review-rubric.md). In short:

1. Scope.
2. Correctness.
3. Evidence.
4. Simplicity.
5. Integration.
6. Safety.

A blocker in any gate is a FIX. A product decision in any gate is an ESCALATE.

## Review record

Write `.maestro/tasks/<task-id>/review.md`:

```text
TASK      w2.1 Add the CSV serializer and route
WORKER    agent_123, T2, opencode/deepseek-v4.1-flash
ROUTE     executor role; healthy; quality fits a low-difficulty build
ATTEMPTS  1 rate limit on the primary, 0 on the fallback
ROUND     1
VERDICT   FIX
GATES     scope pass, correctness fail, evidence pass, simplicity pass, integration pass, safety pass
FINDINGS  1. Content-Type is JSON, expected CSV.
          2. The export test is skipped.
EVIDENCE  npm test -- reports: 1 failed, 14 passed
NEXT      Send the two findings to agent_123
```

Append the verdict to `workers.jsonl` and `audit.jsonl`.

## Avoid

- **Review theater:** accepting a summary without commands or a diff.
- **Moving goalposts:** adding criteria after the worker started.
- **Rubber stamping:** PASS because the worker said PASS.
- **Scope blindness:** ignoring a changed file because the main change works.
- **Fix by Maestro:** editing the file instead of sending the finding back.
- **Infinite loop:** more than two fix rounds on the same issue.
