# Evaluating an Inkling 2 Small fine-tune honestly

## Measure the base on your harness first

Model-card numbers come from the publisher's harness. Run the base through *your*
harness, at the same effort, before you run the fine-tune, and report both. On
SWE-Bench Pro v2 Hard the base card says 86.3%; the base through our harness
scored 78.4%. Comparing our fine-tune's 88.2% to 78.4% alone would overstate the
gain; comparing it to 86.3% alone would hide the harness. Put both on the card and
use the more conservative one in headlines.

## Effort is a bigger knob than you think

Rows are rendered at one effort (0.9, `high`). At serving time, sweep it:

| SWE-Bench Pro v2 Hard (51 tasks) | high | xhigh |
|---|---|---|
| Fine-tune | 70.6% (36/51) | 88.2% (45/51) |
| Base, same harness | 78.4% (40/51) | 78.4% (40/51) |

Effort moved the fine-tune far more than the base. Had we evaluated only at the
training effort we would have concluded the fine-tune was worse. Evaluate at
`high` and `xhigh` (at least), pick per use case, and say which on the card.
At xhigh the fine-tune also used 9% fewer output tokens than the base (4.07M vs
4.45M on those 51 tasks).

## Benchmarks that matched the card's protocol

| Benchmark | Fine-tune | Base card | Notes |
|---|---|---|---|
| SWE-Bench Pro v2 Hard (51) | 88.2% | 86.3% | locked protocol, agent diff re-graded on a pristine image, one attempt per task |
| LongBench v2 (503, 1M context) | 70.2% | 70.6% | official template; prompts over 1M middle-truncated with the model's tokenizer |
| AA-LCR v1.1 | 85.0% | 83.3% | official template and grader prompts (judge model differs from AA's) |

Long-context scores staying level is the check that the adapter did not damage the
base's long-context ability.

## Practical rules

- A 51-task set moves by a task or two on luck. Report counts (45/51), not just
  percentages, and the task-level overlap with the base (both solved 38, only the
  fine-tune 7, only the base 2, neither 4).
- Use temperature 1.0 and top-p 0.95 unless the benchmark prescribes otherwise.
- Long agentic benchmarks need the long window: Tinker's 256K ceiling ended DeepSWE
  tasks after ~140 steps. Self-host for those, and budget for it: GPU time for
  a full agentic suite is hundreds of dollars.
- Do not use a benchmark the base card does not report as a headline comparison;
  there is nothing honest to compare against.
- Keep the probe (`references/recipes/inkling-2-small/behaviour.md`) in every eval run. A benchmark gain
  with a greeting that triggers tool calls is not a better model.
