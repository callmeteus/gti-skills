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
| JavaScript, TypeScript | Stryker (mandatory) | `node <skill-dir>/scripts/tools/js-tools.mjs stryker --project . --mutate <files>` |
| C# | Stryker.NET | `dotnet stryker` |
| Java, Kotlin | PIT | `mvn org.pitest:pitest-maven:mutationCoverage` |
| Python | mutmut | `mutmut run` |
| Rust | cargo-mutants | `cargo mutants` |
| Go | Gremlins | `gremlins unleash` |
| PHP | Infection | `vendor/bin/infection` |

- **JavaScript and TypeScript:** Stryker always runs, from the tools folder outside the project, as described in `references/tools/js-tools.md`. Never use `npx stryker`, `npm install`, or `npm init stryker` inside the project.
- **Other languages:** ask before installing a tool.
- Scope the run to the changed files or package with `--mutate`; a full run can take a long time.
- For each surviving mutant, either add an assertion that kills it or record why it is equivalent (the change does not alter behavior).
- Report the score for the scope you ran, not as a project-wide number.

## 3. Property-based testing

A property test states a rule that holds for every valid input and lets the tool generate inputs and shrink a failure to the smallest example.

| Language | Library |
|----------|---------|
| JavaScript, TypeScript | fast-check (mandatory, run from the tools folder) |
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

In JavaScript and TypeScript, write each property in the project's work folder inside the tools folder and run it with the `property` command (see `references/tools/js-tools.md`). The property file is a probe and stays outside the project; what lands in the project is the literal example test for each counterexample. Only when the project already depends on `fast-check` may property tests live in its suite.

## Check

- Each new test was seen failing at least once.
- Surviving mutants in the changed scope are killed or explained.
- In JavaScript and TypeScript, Stryker ran on the changed scope and at least one fast-check property was run for each piece of logic with a rule worth stating.
- The project has no new dependency, lockfile change, config file, or report from the tools (`git status` shows only the tests you meant to add).
- The report lists the tools run, the tools folder, the scope, and the results.
