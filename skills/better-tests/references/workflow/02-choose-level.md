# Step 2: Choose the level

## Goal

Test each behavior at the highest level that is still fast and deterministic. Higher tests survive refactors and catch integration bugs; lower tests are only worth it where the logic itself is dense.

## Levels

| Level | Enters through | Real | Replaced | Best for |
|-------|----------------|------|----------|----------|
| User flow | Browser or app UI (Playwright) | Everything the team owns | Third-party services | Critical journeys: sign up, checkout, publish |
| API or integration | HTTP route, message handler, public module API | Database, queue, cache (Testcontainers), own modules | Third-party services, clock | Most business behavior |
| Unit | Exported pure function or class | Everything it calls in-process | Nothing, ideally | Dense pure logic: parsers, pricing, date math, state machines |

## Decide

1. Write the behavior as a sentence a user or caller would recognize.
2. Ask where that behavior is visible. If it is visible at the API, test it at the API.
3. Go down a level only when the higher level cannot reach the case cheaply, for example 40 rounding cases of a price function. Then test the pure function directly through its exported name.
4. Keep user-flow tests few: one per critical journey plus its most important failure path. Put variations at the API level.

## Signals you picked too low

- The test needs more than one mock to run.
- The test name describes a method ("calls repository.save") instead of a behavior ("stores the order").
- A refactor that keeps behavior would break the test.

## Signals you picked too high

- Each case takes seconds and there are dozens of cases.
- The failure message cannot point to the cause.
- The test needs sleeps or retries to pass.

## Check

- Every planned test has a level and a one-line reason.
- No planned test enters through a private function.
