# Suite speed: budgets, measuring, and fixes

One example per test with fresh state multiplies whatever each test's setup costs. A suite can grow from 825 tests to 2,200 this way and push its CI run from 6 minutes past a 20-minute limit, while elapsed time on a many-core laptop barely moves. So price changes before making them, and measure.

This file covers the cost of the tests themselves. Runners, caches, sharding, and the CI pipeline belong to the Fast CI skill.

## Where a cost belongs

A cost belongs at the highest level that can carry it:

| Level | Paid | Budget | What belongs here |
|-------|------|--------|-------------------|
| Run | Once per test run | Seconds are fine | Compiling the app, running migrations once and saving a snapshot or template database, building fixture templates (Vitest and Jest `globalSetup`, a pytest session fixture) |
| File | Once per test file | 100 ms from the first import to the end of `beforeAll` | Importing and starting the app, starting its database from the snapshot |
| Test | Every test, its own setup included | The type's budget in [../rules/test-types.md](../rules/test-types.md) | One call, one request, one round trip |

Vitest and Jest run each test file in a new worker, so something kept in memory is gone by the next file: the run level hands its results on as files on disk or a template database.

**Suite:** the full suite's CPU time (user plus system) rises by no more than 25% against the baseline, and fits the CI job limit if the project has one.

## Measure

Write every measurement to `~/.gti/better-tests/<project>/speed/`, never into the project.

1. **Baseline first,** on a clean checkout of the base commit, on a quiet machine. Note the machine's load and treat a loaded run as rough.
2. **Suite CPU time:** `/usr/bin/time -p <test command>` on macOS and Linux, then add `user` and `sys`. On Windows, use `Measure-Command` for elapsed time and say that CPU time was not measured. Elapsed time hides extra work on a many-core machine, so the budget is CPU time.
3. **Each test and file:** run once, one file at a time, with the runner's machine-readable report:

   | Runner | Command |
   |--------|---------|
   | Vitest | `vitest run --no-file-parallelism --reporter=json --outputFile=<speed-dir>/pass.json` |
   | Jest | `jest --runInBand --json --outputFile=<speed-dir>/pass.json` |
   | pytest | `pytest -p no:randomly --durations=0 -q` |
   | Go | `go test -json -p 1 ./...` |

4. Re-run the files over budget three times and take the median before reporting them.
5. Group the results by test type (pure function, service, repository, route, browser), and give each group its total, its average per test, and the tests over budget.

## Fix

- **Price a change before making it.** Before splitting tests or giving each example fresh state, multiply the new test count by the setup cost per test. If the result breaks a budget, make the setup cheap first.
- **Find the cause before the fix.** Each cost over budget gets a named cause, confirmed by measuring where its time goes. Usual causes: migrations per file or per test, a real database or subprocess where a fake belongs, routes compiled on first request, fixed sleeps, polling at a slow interval, real retry backoff, an outside service with no fake waiting on DNS, password hashing at production cost, long arrange chains through many routes.
- **Fix in this order:**
  1. Prepare once per run and copy per test or file: a database snapshot, a template database (`CREATE DATABASE test_1 TEMPLATE app_template` in Postgres), a fixture template. Tests stay isolated.
  2. Replace a real dependency with a contract-tested fake, where the test type allows it.
  3. Share an expensive real fixture across a file whose tests only read, and say so in the report. This gives up some isolation, so it comes last.
- **Warm-up goes into setup.** Whatever only the first test would pay moves to `beforeAll`, because tests run shuffled and any of them can be first.
- **Make delays settings.** Retry backoff, timeouts, and hashing cost become settings the test harness lowers.
- **Speed never costs coverage.** Every test keeps its type's rules, its cases, its assertions, and its isolated data. Route tests stay black box. Never raise a test timeout or a CI time limit to make a slow test pass.
- **Each fix is one step,** measured again afterwards.

## Isolation check

Speed fixes break isolation easily. After them, the tests in scope pass:

- shuffled (`vitest run --sequence.shuffle <file>`, `jest --randomize`, `pytest` with `pytest-randomly` installed, `go test -shuffle=on`),
- and one at a time (each test alone, by name).

## Report

Add a "Test speed" section to the report, and to the pull request description when there is one:

- Suite CPU time and test count, before and after.
- Time per test type, before and after.
- Each test moved or removed, and the test that now covers it.
- The ten slowest tests and files, before and after.
- Each test or file still over budget, with its time, its cause, and the change that would fix it.
