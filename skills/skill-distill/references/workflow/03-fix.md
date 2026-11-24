# Fixing the skill between iterations

Read this after the verdicts of an iteration, before you edit `<run>/skill/`.

## Pick the fix from the kind of failure

| What happened | Fix |
|---------------|-----|
| Skipped or never read a step | Move it earlier, make it shorter, add a "stop and check" gate |
| Misread a step | Rewrite it concretely; add an example of the expected result |
| Harness or tool misuse (blocking server, wrong tool, giant output) | A harness note at the top, with the exact command to use |
| Could not do a hard part even when told what to do | A short snippet, or a script in `skill/scripts/` |
| Declared done without checking, or stopped early | Make the verification step mandatory, with the exact command and the expected output |
| Lost the thread in a long run | Cut prose; split into `references/` files read only at the step that needs them |
| The trial's environment was broken | Fix `--setup` or `checks.sh`, not the skill; rerun and do not count the trial |

## Rules

- Make the changes for every failure you saw in one edit, and say what each change targets in the verdict's `--fix`.
- If the next iteration scores worse, revert the change that caused it rather than piling more on top. Each iteration's skill is frozen in `iters/NN/skill/`, so `diff -r` shows exactly what changed.
- On a user `fail`, the user's note is the most important evidence you have. Add it to `acceptance.md` as a checkable item before you change the skill.

## When to stop looping

| Condition | Next |
|-----------|------|
| All 3 trials of an iteration are `match` | Write the report and ask the user |
| 8 iterations have run | Stop, write the report, and say what the student still cannot do and what you tried |
| 3 iterations in a row with no improvement in the best score | Same as above |

A skill the student cannot follow is a useful result too: it says the task is beyond that model in that harness, and the ledger shows where it fails.
