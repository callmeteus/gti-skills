# Worked example: CSV export

This example shows a complex run from intake to report. The project is a web app with a reports page, a server route, and a test suite.

## Intake

```text
MAESTRO  run-2026-11-14-001  complex
goal    Add CSV export to the reports page
done    CSV route returns text/csv with a header row, the page shows a Download CSV action, the reports tests pass
budget  12 workers, 2 fix rounds, 6 waves
harness paseo (native tools, resumable chats)
```

Decision: the run is complex because it touches the server route, the export helper, the UI, and the tests. Three of those can run separately, so the plan uses waves.

## Plan

```text
WAVE 1  discover
  w1.1  scout   T1  map the report route, the export helper, and the tests
  w1.2  scout   T1  list the UI entry points and the existing download pattern

WAVE 2  build
  w2.1  build   T2  add the CSV serializer and the route handler
  w2.2  build   T2  add the Download CSV action and its test

WAVE 3  verify
  w3.1  verify  T1  run the full checks, read the diff, hunt regressions
```

No two tasks in wave 2 write the same file. The route and the UI are separate, so the wave runs in parallel.

## Delegate

The first worker brief:

```text
Task: w2.1 Add the CSV serializer and the route handler.

Context: The reports page needs a CSV download. The route already returns JSON for the report payload; this task adds text/csv for the same report.

Scope: src/reports/csv.ts, src/reports/route.ts, tests/reports/csv.test.ts.

Non-goals: Do not change the PDF export, the report schema, or the UI.

Done criteria:
- GET /reports/:id.csv returns text/csv; charset=utf-8 and a header row.
- The serializer escapes commas, quotes, and newlines.
- tests/reports/csv.test.ts covers the escaping cases.

Checks: npm test -- reports; npm run typecheck.

Output: STATUS, SUMMARY, FILES, CHECKS, DIFF, OPEN, NEXT.

Stop if a product decision is needed. Do not push or deploy.
```

Recorded worker:

```json
{"id":"w2.1","task":"Add the CSV serializer and route","type":"build","tier":"T2","model":"sonnet","adapter":"paseo-mcp","chat":"agent_123","resumable":true,"status":"running","verdict":null,"rounds":0}
```

## Review round 1

The self-review came back with `FIX` because the route used `application/json`. Maestro verified it:

```text
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
NEXT      Send the finding to agent_123.
```

The fix prompt went to `agent_123`, not to a new chat. Round 2 returned the corrected header, the full output contract, and the passing focused tests.

## Review round 2

```text
GATES
  scope         PASS
  correctness   PASS
  evidence      PASS
  simplicity    PASS
  integration   PASS
  safety        PASS
VERDICT   PASS
```

The recorded verdict:

```json
{"id":"w2.1","task":"Add the CSV serializer and route","type":"build","tier":"T2","model":"sonnet","adapter":"paseo-mcp","chat":"agent_123","resumable":true,"status":"done","verdict":"PASS","rounds":1,"files":["src/reports/csv.ts","src/reports/route.ts","tests/reports/csv.test.ts"],"notes":null}
```

## Verify

The verifier was a fresh T1 worker. It did not write the change. It ran the full suite, read the whole diff, and reported one issue: the UI test used the old button label. The UI builder fixed it in its own chat (`agent_104`), and the verifier re-ran the full suite.

## Finish

```text
MAESTRO  run-2026-11-14-001  done
goal    Add CSV export to the reports page
waves   3/3 passed
workers 5 spawned, 5 passed, 0 reassigned
checks  test pass, typecheck pass, lint pass, build pass
chats   w1.1 agent_101, w1.2 agent_102, w2.1 agent_123, w2.2 agent_104, w3.1 agent_105
open    none
```

The report listed the five chats, the two changes, the one review round, and the fact that the CSV was not tested in Safari.

## What Maestro did not do

- It did not write the serializer.
- It did not change the Content-Type header.
- It did not fix the UI test.
- It did not merge or deploy.

It planned, delegated, reviewed, and reported. That is the whole job.
