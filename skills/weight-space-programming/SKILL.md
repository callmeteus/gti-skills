---
name: weight-space-programming
description: >-
  Reads, fixes, and writes neural network weights directly by reasoning about
  what each layer computes, without training, gradients, or fitting to data.
  Three modes: read (infer the task, data, or behavior of a network from its
  weights), fix (diagnose a failure and make a small, targeted weight edit
  such as removing a direction or adding a side path), and write (construct a
  working network from zero-initialized weights, layer by layer). Enforces a
  forward-pass budget, keeps edits minimal and reversible, and scores only on
  held-out evaluation. Use when the user asks to inspect, interpret, edit,
  patch, steer, or hand-write model weights, to find what a checkpoint was
  trained on, to fix a policy or LLM failure by editing weights, or mentions
  weight-space programming. Do not use for ordinary training or fine-tuning,
  hyperparameter tuning, or prompt engineering.
compatibility: >-
  Python 3.9+ with numpy. Optional: PyTorch for .pt/.pth checkpoints and large
  models, safetensors is read and written without extra packages.
metadata:
  display-name: Weight Space Programming
---

# Weight Space Programming

## Core Rule

Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## When to use

- **Read:** the user hands over a checkpoint and asks what it does, what it was trained on, which heads or units do what, or which of two models has a behavior.
- **Fix:** a trained network fails in a specific, repeatable way (a policy stuck in a local minimum, an LLM that loops or refuses) and the user wants a weight edit instead of retraining.
- **Write:** the user wants a small network built by hand from a specification (rules, source code of an environment, an input and output layout) with no training.

Do not use this skill to train, fine-tune, distill, or tune hyperparameters, or to change behavior through prompts.

## The idea

A network is a program written in weights. Each layer computes features of the layer below, and those features can be read, named, and rewritten. Instead of searching weight space with gradients, you reason about what a unit or direction computes, then read it or set it by hand. The method comes from the post "Weight-Space Programming" (see Notes), where a frontier model identified games from policy weights, removed a repetition-loop direction from a 0.8B LLM, and wrote Go and MinAtar policies into zero-initialized MLPs.

## The rules

These rules apply in every mode. State them in the contract and keep to them.

1. **No optimization.** No training loops, gradients, optimizers, fitting weights to data, tree search, or rollout-based search over weights. Every weight change comes from an explicit reason.
2. **Analysis is free, running is budgeted.** You may compute anything from the weights themselves (norms, SVD, matrix products, projections). Running the network on inputs is a forward pass and spends the budget. A budget of 0 means never run it.
3. **Held-out evaluation.** The final score uses data or environments you never saw or used during the work. Practice data and test data never mix.
4. **Minimal, reversible edits.** Keep the original weights untouched, write edits to a new file, and report the fraction of weights changed.
5. **Keep an edit only if it helps.** Measure before and after on practice inputs inside the budget; revert anything that does not improve the target metric.
6. **Log everything.** Every forward pass, every edit, and every keep or revert decision goes into the ledger.

## Prerequisites

- The weights as `.npz`, `.npy`, `.safetensors`, or `.pt`/`.pth` (the last needs PyTorch).
- The architecture: layer order, shapes, activations, weight layout (`[out, in]` as in PyTorch, or `[in, out]`), and the input and output encoding.
- The goal in words, and, for fix and write, a practice environment or dataset separate from the held-out evaluation.
- Python with numpy. Use `python3` on macOS and Linux and `python` or `py -3` on Windows. Install nothing without asking.

## Instructions

Every mode starts with the contract and ends with evaluation and a report. Read a reference file only when a step needs it.

### Step 1: set the contract

Write down the architecture, I/O layout, goal, allowed tools, forbidden actions, forward-pass budget, practice data, and held-out evaluation, then create the ledger. If any of these is missing, ask. See [references/workflow/01-contract.md](references/workflow/01-contract.md).

```bash
python3 <skill-dir>/scripts/budget/ledger.py --ledger wsp-ledger.json init --mode fix --budget 50 --goal "car reaches the goal"
```

### Step 2: inventory the weights

Run the inspector and read its output before forming any hypothesis.

```bash
python3 <skill-dir>/scripts/inspect/inspect_weights.py model.safetensors --svd 8 --top 5
```

### Step 3: work in the chosen mode

- **Read:** form hypotheses from first-layer input mass, output-layer differences between actions or classes, attention circuit products, and low-rank structure; confirm each with a second, independent signal. See [references/workflow/02-read.md](references/workflow/02-read.md) and [references/techniques/reading-probes.md](references/techniques/reading-probes.md).
- **Fix:** observe the failure, locate the component that causes it, design the smallest edit that removes or overrides it, then measure and keep or revert. See [references/workflow/03-fix.md](references/workflow/03-fix.md) and [references/techniques/editing-moves.md](references/techniques/editing-moves.md).
- **Write:** design the algorithm first, assign each layer a feature to compute, then set weights layer by layer from zero. See [references/workflow/04-write.md](references/workflow/04-write.md) and [references/techniques/construction-patterns.md](references/techniques/construction-patterns.md).

### Step 4: evaluate and report

Score on the held-out evaluation, compare with the baseline, report the fraction of weights changed, and fill [assets/templates/wsp-report.md](assets/templates/wsp-report.md). See [references/workflow/05-evaluate-and-report.md](references/workflow/05-evaluate-and-report.md). Check the result against [references/quality/anti-patterns.md](references/quality/anti-patterns.md) before you report.

## Scripts

All scripts take `--help`. Run them from any folder; paths are relative to `<skill-dir>`.

| Script | Purpose |
|--------|---------|
| `scripts/inspect/inspect_weights.py` | Shapes, statistics, row and column norms, singular values, and input-group mass for every tensor |
| `scripts/edit/ablate_direction.py` | Project a direction out of the selected columns or rows of one tensor, to a new file |
| `scripts/edit/diff_weights.py` | Count and fraction of changed weights between two checkpoints, per tensor and in total |
| `scripts/build/mlp.py` | Create a zero-initialized MLP, and run a budgeted forward pass that spends from the ledger |
| `scripts/budget/ledger.py` | Contract, forward-pass budget, edit log, and keep or revert decisions |

Shared loading and saving code lives in `scripts/common/weights_io.py`.

## Examples

```text
User: Here are four policy checkpoints for 10x10 grid games, 5 input channels,
5 actions. Which game is each? Don't run them.
Agent: Sets budget 0. Inspects layers.0.weight with --input-groups 5 and finds
one channel's mass concentrated on the bottom row in one model (a paddle),
spread across the board in another (a maze agent). Compares output rows to
see which actions each model actually distinguishes, for example only left
and right for a horizontal paddle. Confirms each guess with a second signal
and reports a game per checkpoint with the evidence and its confidence.
```

```text
User: This 0.8B model loops on math problems until it hits the token limit.
Fix it by editing weights. You get 50 forward passes on the practice set.
Agent: Spends 5 passes to record loops and collect residual activations, finds
one direction written strongly by the MLPs of two middle layers during loops,
projects it out of the top 64 columns of each down projection with
ablate_direction.py, and measures on practice problems. Loops drop, accuracy
rises; it keeps the edit, reports 0.016% of weights changed and the held-out
score.
```

```text
User: Write weights for a 600-32-32-6 tanh MLP that plays Breakout. Here is
the game source. No training.
Agent: Reads the encoding, designs layer 1 to estimate where the ball lands
from its position and trail, layer 2 to compare that with the paddle column,
and the output to move toward it. Creates the zero MLP with mlp.py init, sets
each block from an explicit formula in a script, and scores it on the
held-out episodes.
```

## Resources

| Path | Purpose |
|------|---------|
| `references/workflow/` | One file per step: contract, read, fix, write, evaluate and report |
| `references/techniques/` | Reading probes, editing moves, and construction patterns |
| `references/quality/` | Anti-patterns and honesty checks |
| `scripts/` | Inspect, edit, diff, build, and budget tools |
| `assets/templates/` | The report structure |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.

## Notes

- Source: the blog post "Weight-Space Programming" at `https://rikiyat.github.io/blog/weight-space-programming/`. The results there come from one frontier model, small samples, and released logs. Treat them as evidence the approach can work, not as expected numbers.
- Editing removes obstacles that hide an ability; it does not add an ability the model lacks. In the post, a model that rarely looped could not be improved at math by editing.
- Weights that fit in context are easier to reason about. For larger models, load tensors in Python and reason about summaries, products, and projections instead of raw numbers.
