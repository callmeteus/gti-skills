# Step 5: Audit and prune a suite

## Goal

Shrink a suite to the tests that catch bugs. Tests that mirror the implementation lock in whatever code exists, slow down every change an agent makes, and cost tokens and CI time without protecting behavior.

## Measure first

Record, before any change:

- Number of test files and tests, and total runtime locally and in CI.
- Number of mocks, spies, and stubs (search for `jest.mock`, `vi.mock`, `mock.patch`, `Mockito`, `gomock`, `Substitute.For`, and similar).
- Flaky tests, if CI history is available.
- Mutation score of the main modules, when a tool is available.
- Suite CPU time and the time per test and file, with [../quality/speed.md](../quality/speed.md).

## Classify each test file

| Class | Signs | Action |
|-------|-------|--------|
| Keep | Enters through the public surface, asserts observable behavior, fails for real bugs | None |
| Rewrite higher | Asserts mock calls, private methods, or internal structure, but the behavior matters | Write an API or integration test for the behavior, then delete the old test |
| Merge | Many near-identical tests for one behavior | One table-driven or property-based test |
| Delete | Tests a getter, a framework, a constant, or a snapshot nobody reads; duplicates a better test | Delete after approval |
| Fix flake | Uses sleeps, real time, shared state, or test order | Make deterministic or rewrite |

Use [../quality/anti-patterns.md](../quality/anti-patterns.md) for the signs.

## Give every slow test a verdict

For each test above the pure-function level, try the fastest level that can prove what it checks, using the table in [02-choose-level.md](02-choose-level.md), and write a one-line verdict in the working notes:

- **Stays:** what only this level proves.
- **Moves:** to which level, and the test that replaces it.
- **Removed:** the faster or equal test that already proves every assertion it makes. Remove duplicates slowest first. Search every test that exercises the code, but change only tests in scope, and report a duplicate outside the scope with the test that covers it.

A test moves or goes only after a proof, one check per thing it asserted:

1. Name the faster test that covers it, writing that test first when it does not exist.
2. Break that behavior in the code, and confirm a remaining test fails.
3. Revert the break.

With no failing test, the verdict is "stays" until a faster test fails on that break.

## Bugs found while restructuring

Restructuring tests keeps behavior: every caller sees the same answers, errors, writes, and calls. Work in small steps, each followed by the suite; a step that turns a test red changed behavior, so undo it and take a smaller one.

A bug found on the way is outside the change. Leave the code as it behaves today, pin that behavior with a test named for it, and next to it write the test for the right behavior, skipped and named for the bug. The fix then only has to unskip one test and delete the other. Report the bug.

```ts
it("a negative amount (today: £-5)", () => {
  expect(formatPounds(-500)).toEqual("£-5");
});

it.skip("a negative amount (bug: should read -£5)", () => {
  expect(formatPounds(-500)).toEqual("-£5");
});
```

When the user asked for the fix, use Mode B instead: the red test comes first and the code changes.

## Prune safely

1. **Seed bugs.** Pick a handful of realistic defects in the area (or use mutation testing) and note which tests catch them.
2. **Replace before deleting.** Write the higher-level tests first and show they catch the same seeded bugs.
3. **Propose the deletion** as a list of files with their class and reason. Delete only after the user approves.
4. **Measure again** and report the before and after: tests, CPU time, mocks, mutation score, and the time per test type. The tests in scope pass shuffled and one at a time.

## Rules

- Never delete in bulk by file pattern. Every deleted file has a reason.
- Never lower the bugs caught to raise the speed. If replacement tests catch fewer seeded bugs, stop and report.
- Keep unit tests for dense pure logic. The problem is structure-coupled tests, not the unit level.

## Check

- Every test file in scope has a class, and every test above the pure-function level has a verdict.
- Deletions are approved and covered by replacement tests, each proven by a break that a remaining test catches.
- The report shows before and after numbers.
