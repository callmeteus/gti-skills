# Test anti-patterns

Use this list to review every test you write and to classify existing tests in an audit. The rule column points to the eight rules in `SKILL.md`.

## Coupled to structure

| Anti-pattern | Rule | Fix |
|--------------|------|-----|
| Asserts that a collaborator was called, how often, or with what arguments, when the effect is observable | 3, 8 | Assert the effect: the stored record, the response, the sent message |
| Tests a private or internal function through a backdoor (exported only for tests, reflection, `_private` access) | 3 | Test through the public surface |
| One test file per source file by habit, mirroring the folder layout | 3 | Organize tests by behavior or feature |
| Snapshot of a large structure nobody reviews | 8 | Assert the few fields that matter |
| Breaks when code is moved or renamed with no behavior change | 3 | Rewrite at a higher level |

## Mock-heavy

| Anti-pattern | Rule | Fix |
|--------------|------|-----|
| Mocks a module the team owns | 1 | Use the real module |
| Mocks the database client or ORM | 1, 2 | Use a Testcontainers database |
| Mock setup longer than the test | 1 | Use real dependencies or a shared fake |
| Test only proves the mock returns what it was told to return | 1 | Delete or rewrite against real behavior |

## Logic in tests

| Anti-pattern | Rule | Fix |
|--------------|------|-----|
| Expected value computed with the same formula as the code | 5 | Write the literal expected value |
| Loops or conditionals deciding what to assert | 5 | Separate tests, a table of literal cases, or a property test |
| Helpers so abstract the test cannot be read alone | 5 | Inline the arrange step or name the helper after the scenario |
| `try`/`catch` that swallows a failure | 5 | Use the runner's assertion for thrown errors |

## Weak assertions

| Anti-pattern | Rule | Fix |
|--------------|------|-----|
| Asserts only "no error" or "is defined" | 8 | Assert the value the user gets |
| Asserts a status code but not the body or stored state | 8 | Assert the observable result too |
| Never seen failing | 6 | Break the code on purpose; run mutation testing |
| Many example tests for an input space, none on the edges | 6 | Add a property test |

## Unreliable

| Anti-pattern | Rule | Fix |
|--------------|------|-----|
| `sleep` or fixed timeouts | 7 | Web-first assertions, fake timers, polling with a deadline |
| Depends on test order or shared mutable data | 2 | Isolated data per test |
| Depends on the real clock, timezone, or network | 1 | Inject the clock, pin the timezone, stub third parties |
| CSS or XPath selectors in UI tests | 7 | Role, label, and text locators |

## Bug-fix process

| Anti-pattern | Rule | Fix |
|--------------|------|-----|
| Fix committed with no test | 4 | Write the reproduction test first |
| Test written after the fix and never seen failing | 4 | Revert the fix, see it fail, reapply |
| Expected value in the test edited to match the code | 4 | Fix the code, not the test |

## Volume over value

| Anti-pattern | Rule | Fix |
|--------------|------|-----|
| Tests added to raise line coverage | 6 | Measure bugs caught with mutation testing |
| Tests for getters, constants, or framework behavior | 8 | Delete |
| Duplicate tests at several levels for one behavior | 3 | Keep the highest one that is fast enough |
