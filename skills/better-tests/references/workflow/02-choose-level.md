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

## Each outcome high, each case where it is decided

The higher level proves the wiring once per outcome; each further case of a decision goes down to where it is decided. A route that answers 401 for a missing, an expired, and a forged token gets one 401 route test, and the token check gets three pure-function tests. When the decision is buried in a handler or a service, extract it into a pure function with a name from the domain, moved unchanged, and keep it reachable through its module's public interface. A private helper exported only so a test can reach it does not count.

| Level | Stays at this level | Goes down |
|-------|---------------------|-----------|
| User flow | One journey per critical flow, and what needs a real browser | Edge cases and logic, to API or component tests |
| API or route | Each status code once, each outside service's wiring, each follow-up effect | Every further reason for a status |
| Service | Each outcome once, and what lands in the fakes | Decisions, to pure functions |
| Repository | SQL behavior, filter edges, and locks | Row mapping written in application code |
| UI component | Rendering and interaction | Formatting and state logic |

Before writing, list the cases each method or route must cover with [../rules/test-types.md](../rules/test-types.md), and place each case on a level.

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
- Every case on the type's list has a planned test, and no case is tested at two levels.
- No planned test enters through a private function.
