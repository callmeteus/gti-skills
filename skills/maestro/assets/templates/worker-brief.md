# Worker brief

## Task

`<task-id>`: <one imperative sentence>

## Context

<Why this task exists and what depends on it. Two or three sentences.>

## Scope

You own:

- `<file or folder>`
- `<file or folder>`

You may not edit anything outside this list.

## Non-goals

- <What not to change>
- <What not to add>

## Done criteria

- [ ] <Observable criterion and the check that proves it>
- [ ] <Observable criterion and the check that proves it>

## Checks

Run and report the exact command, exit code, and relevant output:

```bash
<focused command>
<typecheck or lint command>
```

## Output contract

Return exactly these sections:

```text
STATUS: done | blocked | failed
SUMMARY: three sentences, what changed and why
FILES: every path created, changed, or deleted
CHECKS: each command, exit code, and relevant output
DIFF: git diff --stat and the key hunks
OPEN: anything uncertain, out of scope, or needing a decision
NEXT: what you would do next if the task continued
```

## Stop conditions

- If a done criterion needs a product decision, stop and report it. Do not guess.
- If a change would delete data, push, publish, deploy, send, pay, or type credentials, stop and report it.
- If the task needs a file outside your scope, stop and report it.
- If a check fails twice for a reason you cannot fix, stop and report the exact failure.

## Rules

- Do only this task. Do not fix unrelated issues.
- Keep the diff minimal. No unrelated cleanup, rename, or dependency.
- Follow the project's existing patterns.
- Do not weaken, skip, or delete a test to pass.
- Report honestly. A blocked task with evidence is better than a false PASS.
