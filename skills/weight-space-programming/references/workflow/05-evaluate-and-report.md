# Step 4: evaluate and report

## Evaluate

1. **Use only the held-out setting** named in the contract. Never tune on it, and run it once per final candidate.
2. **Compare with a baseline:** the original network for fix mode, a trained network of the same size or a simple heuristic for write mode, chance or the alternatives for read mode.
3. **Use enough samples** to separate the result from noise: many episodes or games, and several samples per problem for stochastic LLM decoding. Report the count.
4. **Run a negative control when you can.** For fix mode, apply the same procedure to a model that does not show the failure; a large "improvement" there means the evaluation is suspect. For read mode, include a model whose answer you know.
5. **Check side effects.** For an LLM edit, measure one unrelated benchmark (for example instruction following) to confirm nothing else broke.

## Report

Fill [../../assets/templates/wsp-report.md](../../assets/templates/wsp-report.md). It must include:

- The contract: mode, architecture, budget, allowed and forbidden actions.
- The claim, edit, or construction, with the reasoning that produced it.
- For fix and write: the fraction of weights changed (`scripts/edit/diff_weights.py`) and the construction or edit script.
- Forward passes spent out of the budget (`scripts/budget/ledger.py status`).
- Held-out results next to the baseline, with sample counts.
- What did not work and was reverted.
- Confidence and limits.

Keep the ledger file and every checkpoint you kept, so the work can be audited.
