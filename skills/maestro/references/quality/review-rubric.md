# Review rubric

Use this rubric for every task. Maestro applies it after the self-review and before the verdict. A blocker in any gate is a FIX.

## Gates

### 1. Scope

- The change does what the task asked, and nothing more.
- Every changed file is in the brief's scope.
- No unrelated cleanup, rename, dependency, or formatting churn.
- No public surface changed unless the task said so.

Evidence: `git diff --stat`, the file list, and the brief.

### 2. Correctness

- The done criteria are met, each one checked.
- The focused checks pass, and the full checks pass for a final verification.
- Edge cases named in the brief are handled.
- No test was skipped, weakened, or deleted to make the change pass.
- No error is swallowed, and no fallback hides a real failure.

Evidence: commands, exit codes, output, and the specific tests.

### 3. Evidence

- The worker returned the output contract: status, summary, files, checks, diff, open items.
- The commands are reproducible and match the project's real commands.
- Claims about behavior point to a file, a line, a test, or a command result.
- Nothing important is "assumed" or "should work".

Evidence: the output contract itself, plus Maestro's own verification checks.

### 4. Simplicity

- The smallest change that meets the criteria.
- No speculative abstraction, configuration, or helper for one use.
- No new dependency without a stated reason.
- The code follows the project's patterns, not a new style.

Evidence: the diff, the dependency file, and the surrounding code.

### 5. Integration

- The change works with the existing code, not around it.
- Public interfaces, CLI flags, schemas, and exported types are intact or deliberately changed.
- No duplicate implementation of an existing helper.
- The build and typecheck pass in the combined tree, not only in the worker's folder.

Evidence: the full check output and a search for the existing pattern.

### 6. Safety

- No secret, token, or credential in the diff or the brief.
- No destructive action without permission.
- No outward action (push, publish, deploy, send) without permission.
- Input validation and authorization are not weakened.
- The worker respected its sandbox and permission mode.

Evidence: the diff, the commands, and the permission record.

## Severity

| Severity | Meaning | Verdict |
|---|---|---|
| Blocker | Wrong result, broken check, security issue, data loss risk, scope violation that changes behavior | FIX |
| Major | A criterion is partially met, a test is weak, integration is broken | FIX |
| Minor | Naming, comment, or style issue that does not change behavior | PASS with a note |
| Decision | A product, interface, or irreversible choice is needed | ESCALATE |

A task cannot PASS with an open blocker or major finding.

## Verdict form

```text
TASK      w2.1 Add the CSV serializer and route
WORKER    agent_123, T2, sonnet
ROUND     1
GATES
  scope         PASS
  correctness   FAIL  Content-Type is application/json
  evidence      PASS
  simplicity    PASS
  integration   PASS
  safety        PASS
VERDICT   FIX
FINDINGS
  1. Blocker: the route returns application/json; expected text/csv; charset=utf-8.
  2. Major: tests/reports/export.test.ts skips the failing case; restore it.
NEXT      Send both findings to agent_123, round 1 of 2.
```

## High-risk additions

For security, money, data loss, public interfaces, or production changes:

- Add a fresh reviewer from another model family.
- Ask the reviewer to try to break the change, not to confirm it.
- Require the exact command that proves the risk is handled.
- If the risk cannot be proven in the environment, record it as `notVerified` and say so in the report.

## Routing check

The review also records whether the chosen model fit the task. A task that needed T3 and ran on T1 is a routing finding; a task that used a frontier model for a rename is a cost finding. Record the route, the reason, and the attempts, and use the model-fit section in [../workflow/04-review.md](../workflow/04-review.md).

## Review the review

Before accepting a PASS, Maestro asks:

- Did I read the diff, or only the summary?
- Did I run the check, or trust the worker's exit code?
- Did I compare the files to the brief's scope?
- Did I check the test that proves the main behavior?
- Is there a finding I am downgrading because the worker is likable or fast?

If any answer is weak, the review is not done.
