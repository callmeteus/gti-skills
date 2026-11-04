# Anti-patterns and honesty checks

Check the work against this list before reporting. Any "yes" must be fixed or stated in the report.

## Breaking the rules

- [ ] A loop changed weights and kept the change when a metric improved without a stated reason for each change (this is search, not programming).
- [ ] Gradients, an optimizer, least squares fitting to activations, or a trained probe produced weights.
- [ ] The network ran on inputs outside the ledger, including "just one quick test".
- [ ] The held-out set was looked at, used to pick between edits, or overlaps the practice data.
- [ ] The original checkpoint was overwritten.

## Weak evidence

- [ ] A read-mode claim rests on one signal with no second, independent check.
- [ ] The answer follows from the file name, the folder, metadata, or the user's wording rather than the weights.
- [ ] A layer was named by a path product that ignored saturating activations or large biases.
- [ ] Differences between two models were reported as the cause of a behavior without a test linking them.

## Fragile edits

- [ ] The edit changed a large share of weights when a smaller move was available.
- [ ] Several edits were applied together and tested once, so their effects cannot be separated.
- [ ] No unrelated behavior was checked after an LLM edit.
- [ ] LLM measurements used sampling settings that differ from the model card or from the baseline run.

## Overclaiming

- [ ] Results from a few seeds, episodes, or problems are reported without the sample count.
- [ ] No baseline or no negative control is given.
- [ ] The report suggests editing added an ability the base model never showed.
- [ ] Numbers from the source post are presented as what this run should achieve.
