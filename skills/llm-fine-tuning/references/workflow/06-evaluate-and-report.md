# Step 6: evaluate honestly and report

## Measure the base on the same harness first

Model card numbers come from the publisher's harness. Run the base through the user's harness, at the same settings, before the fine-tune, and report both. In the Inkling 2 Small recipe the base card said 86.3% on a benchmark and the base through the recipe's harness scored 78.4%; the fine-tune scored 88.2%. Comparing only against 78.4% overstates the gain; comparing only against 86.3% hides the harness. Put both in the report and use the more conservative one in any headline.

## Sweep the inference settings

Reasoning effort, thinking budget, and temperature can move a fine-tune far more than the base. In the recipe, the fine-tune scored 70.6% at `high` and 88.2% at `xhigh` on the same 51 tasks while the base did not move. Evaluating only at the training setting would have called the fine-tune worse. Evaluate at least two settings and say which one the numbers use.

## Practical rules

- Small task sets move by a task or two on luck. Report counts (45/51), not only percentages, and the task-level overlap with the base (both solved, only the fine-tune, only the base, neither).
- Use the benchmark's prescribed sampling; otherwise temperature 1.0 and top-p 0.95.
- Long agentic benchmarks need the long context window; hosted caps can end tasks mid-run.
- Do not headline a benchmark the base card does not report: there is nothing honest to compare against.
- Check that abilities the fine-tune did not target (long context, general chat) stayed level.
- Keep the behaviour probe in every evaluation run. A benchmark gain with a greeting that triggers tool calls is not a better model.

## Report

Fill `<skill-dir>/assets/templates/fine-tune-report.md` and save it to `~/.gti/llm-fine-tuning/<project>/reports/<name>-<date>.md`. Include the money spent, every checkpoint probed, the chosen checkpoint and why, and what was not verified.
