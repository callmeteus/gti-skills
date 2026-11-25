# Test report: <feature, bug, or suite>

## Summary

- **Mode:** <write tests | fix a bug | audit and prune>
- **Stack:** <runner, container tool, E2E tool>
- **Scope:** <files, modules, or flows covered>

## Behaviors covered

| Behavior | Level | Test |
|----------|-------|------|
| <user-visible statement> | <user flow, API, unit> | <file and test name> |

| Method or route | Case | Test |
|-----------------|------|------|
| <OrderService.placeOrder> | <payments down> | <file and `it` name, or "gap"> |

## Bug reproduction

Write this section only in bug-fix mode.

- **Report:** <input, expected, actual>
- **Failing before the fix:** <assertion message>
- **Passing after the fix:** <command and result>
- **Root cause and fix:** <one or two sentences, files changed>

## Dependencies

| Dependency | How it runs in tests | Reason |
|------------|----------------------|--------|
| <Postgres> | <Testcontainers postgres:16> | <real dependency> |
| <Payment provider> | <HTTP stub> | <third party, cannot run> |

## Verification

- **Seen failing:** <how each new test was broken on purpose>
- **Mutation testing:** <tool, scope, score, surviving mutants and what was done>
- **Property-based testing:** <properties added and any counterexample found>
- **Shuffled and alone:** <commands and results>

## Test speed

| Metric | Before | After |
|--------|-------:|------:|
| Suite CPU time | | |
| Tests | | |

| Test type | Tests | Total | Avg per test | Budget | Over budget |
|-----------|------:|------:|-------------:|-------:|------------:|
| <Pure functions> | | | | 5 ms | |

- **Still over budget:** <test or file, time, cause, the change that would fix it>
- **Bugs pinned:** <the pinned test and the skipped test named for each bug found while restructuring>

## Audit

Write this section only in audit mode.

| Metric | Before | After |
|--------|-------:|------:|
| Test files | | |
| Tests | | |
| Runtime | | |
| Mocks | | |
| Mutation score | | |

| File | Class | Reason | Status |
|------|-------|--------|--------|
| <path> | <keep, rewrite higher, merge, delete, fix flake> | <anti-pattern> | <proposed, approved, done> |

| Test | Verdict | Covered by, or what only its level proves | Proof |
|------|---------|--------------------------------------------|-------|
| <file and test name> | <stays, moves, removed> | <test, or reason> | <the break and the test that failed> |

## Not covered

- <Behaviors left untested and why, tools that could not run, follow-up work.>
