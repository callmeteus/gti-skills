# Step 4: Prove the tests catch bugs

## Goal

A test that has never failed has not been shown to work. Prove each new test fails when the behavior breaks, then let tools look for the bugs the suite would miss.

## 1. Run and break on purpose

1. Run the new tests and confirm they pass.
2. Break the behavior by hand: flip a condition, change a constant, remove a line. Run again and confirm at least one new test fails with a clear message.
3. Revert the change. Confirm the code is back to its original state with `git diff`.

A test that stays green through the break asserts too little. Fix the assertion, not the break.

## 2. Mutation testing

A mutation tool makes many small changes (mutants) to the code and runs the tests against each. A mutant that survives marks a behavior no test checks.

| Language | Tool | Typical command |
|----------|------|-----------------|
| JavaScript, TypeScript | Stryker | `npx stryker run` |
| C# | Stryker.NET | `dotnet stryker` |
| Java, Kotlin | PIT | `mvn org.pitest:pitest-maven:mutationCoverage` |
| Python | mutmut | `mutmut run` |
| Rust | cargo-mutants | `cargo mutants` |
| Go | Gremlins | `gremlins unleash` |
| PHP | Infection | `vendor/bin/infection` |

- Ask before installing a tool. Scope the run to the changed files or package; a full run can take a long time.
- For each surviving mutant, either add an assertion that kills it or record why it is equivalent (the change does not alter behavior).
- Report the score for the scope you ran, not as a project-wide number.

## 3. Property-based testing

A property test states a rule that holds for every valid input and lets the tool generate inputs and shrink a failure to the smallest example.

| Language | Library |
|----------|---------|
| JavaScript, TypeScript | fast-check |
| Python | Hypothesis |
| Java | jqwik |
| Go | rapid |
| Rust | proptest |
| C#, F# | FsCheck |

Good properties:

- **Round trip:** `parse(format(x))` equals `x`.
- **Invariant:** a total is never negative; a sorted list has the same items as the input.
- **Oracle:** the optimized function returns what the simple reference implementation returns.
- **Idempotence:** applying a normalization twice equals applying it once.

When a property finds a counterexample, keep it as a plain example-based test with literal values, then fix the code.

## Check

- Each new test was seen failing at least once.
- Surviving mutants in the changed scope are killed or explained.
- The report lists the tools run, the scope, and the results.
