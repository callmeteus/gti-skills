# Step 5: Audit and prune a suite

## Goal

Shrink a suite to the tests that catch bugs. Tests that mirror the implementation lock in whatever code exists, slow down every change an agent makes, and cost tokens and CI time without protecting behavior.

## Measure first

Record, before any change:

- Number of test files and tests, and total runtime locally and in CI.
- Number of mocks, spies, and stubs (search for `jest.mock`, `vi.mock`, `mock.patch`, `Mockito`, `gomock`, `Substitute.For`, and similar).
- Flaky tests, if CI history is available.
- Mutation score of the main modules, when a tool is available.

## Classify each test file

| Class | Signs | Action |
|-------|-------|--------|
| Keep | Enters through the public surface, asserts observable behavior, fails for real bugs | None |
| Rewrite higher | Asserts mock calls, private methods, or internal structure, but the behavior matters | Write an API or integration test for the behavior, then delete the old test |
| Merge | Many near-identical tests for one behavior | One table-driven or property-based test |
| Delete | Tests a getter, a framework, a constant, or a snapshot nobody reads; duplicates a better test | Delete after approval |
| Fix flake | Uses sleeps, real time, shared state, or test order | Make deterministic or rewrite |

Use [../quality/anti-patterns.md](../quality/anti-patterns.md) for the signs.

## Prune safely

1. **Seed bugs.** Pick a handful of realistic defects in the area (or use mutation testing) and note which tests catch them.
2. **Replace before deleting.** Write the higher-level tests first and show they catch the same seeded bugs.
3. **Propose the deletion** as a list of files with their class and reason. Delete only after the user approves.
4. **Measure again** and report the before and after: tests, runtime, mocks, mutation score.

## Rules

- Never delete in bulk by file pattern. Every deleted file has a reason.
- Never lower the bugs caught to raise the speed. If replacement tests catch fewer seeded bugs, stop and report.
- Keep unit tests for dense pure logic. The problem is structure-coupled tests, not the unit level.

## Check

- Every test file in scope has a class.
- Deletions are approved and covered by replacement tests.
- The report shows before and after numbers.
