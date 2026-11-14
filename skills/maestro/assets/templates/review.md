# Review: <task-id>

## Self-review prompt

Send this to the chat that did the work.

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

## Independent verification

Maestro fills this in.

| Check | Result | Evidence |
|---|---|---|
| Diff read | <yes or no> | `<command>` |
| Focused checks | <pass or fail> | `<command and output>` |
| Full checks | <pass or fail> | `<command and output>` |
| Scope match | <pass or fail> | `<files>` |
| Public surface | <pass or fail> | `<file or none>` |
| Secrets | <pass or fail> | `<file or none>` |
| Model fit | <pass or fail> | <route, reason, and attempts> |

## Gates

| Gate | Result | Notes |
|---|---|---|
| Scope | <PASS or FAIL> | |
| Correctness | <PASS or FAIL> | |
| Evidence | <PASS or FAIL> | |
| Simplicity | <PASS or FAIL> | |
| Integration | <PASS or FAIL> | |
| Safety | <PASS or FAIL> | |

## Verdict

```text
ROUTE     <provider/model and reason>
ATTEMPTS  <primary, fallback, errors, cooldowns>
ROUND     <n>
VERDICT   <PASS | FIX | REASSIGN | ESCALATE>
FINDINGS
  1. <severity: finding and expected result>
NEXT      <send to same chat, reassign, or ask the user>
```

## Fix prompt

Send this to the same chat when the verdict is FIX.

```text
FIX 1: <what failed, what was expected, and the evidence>.
FIX 2: <what failed, what was expected, and the evidence>.

Make only these changes. Then return the full output contract and the check output again. Do not change anything outside your scope.
```

## Second opinion prompt

Use only when the risk is high or the facts are disputed.

```text
You are an independent reviewer. You did not write this change.
Task and done criteria: <paste>.
Diff and evidence: <paste or point to .maestro/tasks/<id>/>.
Find what is wrong: correctness, missing cases, weakened tests, unnecessary complexity, scope creep, safety. Do not fix anything.
End with PASS, FIX with findings, or ESCALATE with the decision needed.
```
