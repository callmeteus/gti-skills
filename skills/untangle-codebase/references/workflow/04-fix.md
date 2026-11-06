# Step 4: Fix Everything on the List

Remove the special cases the redesign makes unnecessary, and keep the ones the system still needs. Do not go looking for bugs separately. A structural fix may fix some along the way, which is fine.

## The loop for each fix

1. **Re-read the log entry** and the current code it touches. Code may have moved since you wrote the plan.
2. **Cover it.** If no existing test would catch a regression in the code you are about to move, add a characterization test first and commit it alone.
3. **Change.** Make the smallest set of edits that fully implements the fix. Move code with its tests. Update every caller in the same commit; do not leave compatibility shims unless the fix touches a public surface and the user asked for one.
4. **Verify.** Run the type check and the tests for the affected area, then the full suite before committing. Run the build if the project has one.
5. **Commit.** One fix, one commit. The message names the fix and the log entry, for example `untangle: route all user actions through one command list (fix 3)`.
6. **Log.** Mark the fix done, list any special cases it removed or kept, and record any bug it fixed with the test that now covers it.

If verification fails and the cause is not obvious within a short investigation, revert the working tree to the last commit, note what went wrong in the log, and re-plan that fix. Never commit with a test failing that passed at baseline, and never weaken or delete a test to make a fix pass.

## If the user chose Comments

- **Restating the implementation:** comments like `// sort first so the binary search works` only change when the code does, so they have no reason of their own to change. Remove them, even if they are phrased as a why.
- **About something outside the code:** comments like `// the proxy drops websockets, so we poll` change when that outside fact does, and the code cannot show it. Keep them.
- **Explaining a workaround in the codebase:** comments like `// wait 100ms because the cache isn't ready yet` only change when the problem behind the workaround does. They go when the redesign removes that problem.
- **Keep** license headers, generated-file markers, directives the tooling reads (lint, type, coverage, build pragmas, doc comments that generate API docs), and anything the project's style guide requires.

## If the user chose Tests

Do this last, because tests are your regression safety net. A test should fail on a regression, and only then.

- **Tests that repeat the implementation** only change when it does, so they have no reason of their own to change. They check the same interpretation against itself, so remove them.
- **Tests tied to internals** break when the code changes but behavior does not, so they change for the wrong reason. Rewrite them to depend on behavior, which changes less.
- **Tests that cannot fail** pass whatever the code does, so no change ever affects them. They are not checking anything, so remove them.

Before removing a test, check that it cannot fail on a real regression: break the behavior it names on purpose and see whether it, or another test, fails. Record removed tests and the reason in the log. If the `better-tests` skill is installed, use its audit rules for this step.

## Commit hygiene

- Keep formatting-only changes out of fix commits. If a file needs reformatting, do it in its own commit with the project's formatter.
- Renames and moves go in their own commit when possible, so history follows the files (`git mv`).
- Do not touch generated, vendored, or lock files except by running the tool that produces them.
