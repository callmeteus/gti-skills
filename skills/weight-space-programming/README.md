<div align="center">

# Weight Space Programming

> Read, fix, and write neural network weights without training

**Teaches an agent to read what a network does from its weights, repair failures with small targeted edits, and hand-build working networks from zero, under a forward-pass budget and held-out evaluation.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Python](https://img.shields.io/badge/python-3.9%2B-blue.svg)](#requirements)
[![Agents](https://img.shields.io/badge/agents-10%20supported-8A63D2.svg)](#installation)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](#requirements)
[![License](https://img.shields.io/badge/license-not%20declared-lightgrey.svg)](#license)

[Quick Start](#quick-start) • [Usage](#usage) • [Reference](#reference) • [Troubleshooting](#troubleshooting)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Reference](#reference)
- [Output](#output)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Overview

Networks are normally changed by gradient descent: collect data, define a loss, train. The post "Weight-Space Programming" reports that a frontier model can instead treat weights as a program: reason about what each unit, head, or direction computes, and read or rewrite it directly. In its experiments the model identified games from policy weights, removed a repetition-loop direction from a 0.8B LLM by editing 0.016% of its weights, and wrote Go and MinAtar policies into zero-initialized MLPs.

This skill turns that method into a workflow with three modes (read, fix, write), fixed rules (no optimization, budgeted forward passes, held-out evaluation, minimal reversible edits), and numpy scripts for inspecting, editing, diffing, building, and budgeting.

```text
  checkpoint + architecture + goal
              │
              v
  contract and ledger (budget, forbidden actions, held-out set)
              │
              v
  inspect weights (norms, SVD, input-group mass)
              │
     ┌────────┼─────────────┐
     v        v             v
   read      fix          write
  probes   locate cause   algorithm first
  2 signals smallest edit  layer by layer from zero
     │      keep or revert  │
     └────────┼─────────────┘
              v
  held-out evaluation + report (fraction changed, passes spent)
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Infer a network's task, data, or circuits from its weights | Train, fine-tune, or distill models |
| Diagnose a failure and apply a small, logged weight edit | Search weight space with gradients or rollouts |
| Hand-build small networks from rules or environment source | Tune hyperparameters or prompts |
| Enforce a forward-pass budget and held-out evaluation | Guarantee the results reported in the source post |

## Features

- **Three modes:** read, fix, and write, each with its own workflow file.
- **Contract first:** architecture, I/O encoding, allowed and forbidden actions, budget, practice and held-out data are fixed before work starts.
- **Budget ledger:** every forward pass, edit, and keep or revert decision is recorded; the build script refuses to run past the budget.
- **Weight inspector:** shapes, statistics, row and column norms, singular values, effective rank, and per-group input mass, with no forward pass.
- **Direction ablation:** projects a diagnosed direction out of the top columns of one tensor, to a new file.
- **Edit accounting:** reports the count and fraction of weights changed between two checkpoints.
- **Construction patterns:** detectors, logic gates, value carrying, comparisons, and grid propagation for ReLU and tanh.
- **Honesty checks:** an anti-pattern list that catches hidden optimization, test leakage, and overclaiming.
- **No heavy dependencies:** numpy only; safetensors is read and written in pure Python, PyTorch is optional for `.pt` files.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| Python | 3.9+ | Runs the scripts | No |
| numpy | Any recent | Tensor analysis and editing | No |
| PyTorch | Any recent, optional | Loading `.pt`, `.pth`, and `.bin` checkpoints, and running large models | No |

Use `python3` on macOS and Linux and `python` or `py -3` on Windows. Install numpy with `pip install numpy` if it is missing. For CI, ensure numpy is installed before running tests.

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill weight-space-programming
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--pack coding` or `--pack research` to install it with its pack, `--scope user` to install for every project, and `--dry-run` to preview.

| Agent | Id | Project folder | User folder |
|-------|----|----------------|-------------|
| Cursor / Cursor CLI | `cursor` | `.cursor/skills` | `~/.cursor/skills` |
| Claude / Claude Code | `claude` | `.claude/skills` | `~/.claude/skills` |
| Antigravity | `antigravity` | `.agents/skills` | `~/.gemini/antigravity/skills` |
| OpenCode | `opencode` | `.opencode/skills` | `~/.config/opencode/skills` |
| Cline | `cline` | `.cline/skills` | `~/.cline/skills` |
| Kilo Code | `kilo` | `.kilocode/skills` | `~/.kilocode/skills` |
| Kiro | `kiro` | `.kiro/skills` | `~/.kiro/skills` |
| Codex | `codex` | `.agents/skills` | `~/.agents/skills` |
| GitHub Copilot | `copilot` | `.github/skills` | `~/.copilot/skills` |
| Muse Code | `muse` | `.agents/skills` | `~/.agents/skills` |

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/weight-space-programming` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/weight-space-programming .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\weight-space-programming .claude\skills\
```

Each agent has a short guide in `skills/weight-space-programming/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

To pre-install the Python dependency:

```bash
python3 -m pip install numpy
```

## Quick Start

```text
Here is policy.safetensors, an MLP 500-32-32-5 with tanh trained on a 10x10 grid game with 5 input channels. Tell me which game it plays without running it.
```

The agent sets a contract with a budget of 0, inspects the weights, maps first-layer mass per input channel and the output rows per action, confirms its guess with a second signal, and reports the game with its evidence and confidence.

## Usage

### Input

| Input | Required | Example |
|-------|:--------:|---------|
| Weights | Yes | `.npz`, `.npy`, `.safetensors`, `.pt`, or `.pth` |
| Architecture | Yes | Layer sizes, activations, `[out, in]` or `[in, out]` layout |
| Input and output encoding | Yes | Channel order and flattening, action or class order |
| Goal | Yes | "Name the task", "stop the loops", "play Breakout" |
| Forward-pass budget | No | 0 by default for read mode; the user sets it for fix and write |
| Practice data or environment | Fix and write | Practice problems, practice opponents, a failed episode |
| Held-out evaluation | Fix and write | A test set or environment the agent never uses while working |
| Environment rules or source | Write | Game source code, rules, scoring |

### Examples

```text
These two Gemma checkpoints were fine-tuned the same way except one agrees with the user's guesses. Which one is it? You may see attention weights for up to 16 texts.
```

```text
My PPO car policy drives straight into the ramp and stalls every episode. Here are the weights, the scene description, and one failed episode. Fix it by editing weights; 20 forward passes allowed.
```

```text
Qwen loops on math problems until the token limit. Find the cause in the weights and remove it. 50 forward passes on the GSM8K train split; MATH-500 is held out.
```

```text
Write the weights of a 243-512x6-82 ReLU MLP that plays 9x9 Go from these rules. No training and no runs.
```

## How It Works

```text
  1. Contract        architecture, I/O, goal, tools, forbidden actions, budget, held-out set
          │
  2. Inventory       inspect_weights.py: norms, SVD, input-group mass
          │
  3. Mode
     read            probes, hypotheses, second signal, confidence
     fix             observe, locate, smallest edit, measure, keep or revert
     write           algorithm, unit allocation, zero MLP, set blocks, local checks
          │
  4. Evaluate        held-out set, baseline, negative control, side effects
          │
  5. Report          template with ledger, fraction changed, and limits
```

## Reference

All scripts print their full help with `--help`.

### inspect_weights.py

```bash
python3 scripts/inspect/inspect_weights.py model.safetensors --svd 8 --top 5 --input-groups 5
```

| Argument | Default | Description |
|----------|---------|-------------|
| `weights` | - | Checkpoint: `.npz`, `.npy`, `.safetensors`, `.pt`, or `.pth` |
| `--tensor` | All | Regular expression; only matching tensor names are shown |
| `--layout` | `out_in` | `out_in` as in PyTorch Linear, `in_out` as in JAX or numpy |
| `--top` | `5` | Number of largest row and column norms to list |
| `--svd` | `0` | Number of singular values to list; 0 skips SVD |
| `--max-svd-dim` | `4096` | Skip SVD when the smaller side is larger than this |
| `--input-groups` | `0` | Split the input dimension into N equal groups and report the mass share per group |
| `--json` | Off | Print JSON instead of text |

### ablate_direction.py

```bash
python3 scripts/edit/ablate_direction.py model.safetensors --tensor model.layers.15.mlp.down_proj.weight --direction loop_dir.npy --space-axis 0 --top 64 --out edited.safetensors
```

| Argument | Default | Description |
|----------|---------|-------------|
| `weights` | - | Input checkpoint, left unchanged |
| `--tensor` | Required | Exact name of the 2D tensor to edit |
| `--direction` | Required | `.npy` file holding the direction vector |
| `--space-axis` | `0` | Axis whose length equals the direction length |
| `--top` | `0` | Edit only the N vectors with the largest absolute projection; 0 edits all |
| `--scale` | `1.0` | Fraction of the projection to remove; above 1 reverses it |
| `--out` | Required | Output `.npz` or `.safetensors`; must differ from the input |

### diff_weights.py

```bash
python3 scripts/edit/diff_weights.py model.safetensors edited.safetensors
```

| Argument | Default | Description |
|----------|---------|-------------|
| `original` | - | Original checkpoint |
| `edited` | - | Edited checkpoint |
| `--tolerance` | `0.0` | Absolute change at or below this counts as unchanged |
| `--json` | Off | Print JSON instead of text |

### mlp.py

```bash
python3 scripts/build/mlp.py init --sizes 600,32,32,6 --activations tanh,tanh,none --out policy.npz
python3 scripts/build/mlp.py forward --weights policy.npz --inputs x.npy --out y.npy --ledger wsp-ledger.json
```

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `init` | Write an all-zero MLP with tensors `layers.<i>.weight` `[out, in]` and `layers.<i>.bias` | `--sizes`, `--activations` (`relu`, `tanh`, `sigmoid`, `none`), `--out` |
| `forward` | Spend one pass from the ledger, then run inputs through the MLP | `--weights`, `--inputs`, `--out`, `--ledger`, `--note` |

### ledger.py

```bash
python3 scripts/budget/ledger.py --ledger wsp-ledger.json init --mode fix --budget 50 --goal "car reaches the goal"
python3 scripts/budget/ledger.py --ledger wsp-ledger.json status
```

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `init` | Create the ledger | `--mode`, `--goal`, `--budget`, `--forbidden`, `--force` |
| `spend` | Record forward passes; exits with code 2 when over budget | `--count`, `--note` |
| `edit` | Record an edit and its decision | `--id`, `--file`, `--description`, `--fraction`, `--before`, `--after`, `--decision` |
| `note` | Record an observation or hypothesis | `text` |
| `status` | Print the budget and log | None |

The global flag `--ledger` (default `wsp-ledger.json`) goes before the command.

### Reference files

| File | Purpose | Used in |
|------|---------|---------|
| `references/workflow/01-contract.md` | Contract items, one forward pass, ledger | All modes |
| `references/workflow/02-read.md` | Inferring task and circuits from weights | Read |
| `references/workflow/03-fix.md` | Diagnosing a failure and editing | Fix |
| `references/workflow/04-write.md` | Building a network from zero | Write |
| `references/workflow/05-evaluate-and-report.md` | Held-out evaluation and report | All modes |
| `references/techniques/reading-probes.md` | MLP and transformer probes, model comparison | Read |
| `references/techniques/editing-moves.md` | Direction removal, gating, rescaling, side paths | Fix |
| `references/techniques/construction-patterns.md` | Detectors, gates, carrying values, grids | Write |
| `references/quality/anti-patterns.md` | Rule breaks, weak evidence, overclaiming | All modes |

## Output

````markdown
# Weight space programming report: Qwen math loops

## Contract

- **Mode:** fix
- **Forward-pass budget:** 50 of 50, one pass = generations on a batch of practice problems

## Edits

| Id | Tensors | Fraction changed | Practice before | Practice after | Decision |
|----|---------|------------------|-----------------|----------------|----------|
| ablate-l15-l19 | layers 15 and 19 down_proj, 64 columns each | 0.016% | 12% | 55% | keep |
````

| Section | Contents |
|---------|----------|
| Contract | Mode, architecture, encoding, tools, forbidden actions, budget, data |
| Result | The claim, edit, or network |
| Evidence and reasoning | Each computation or observation and its conclusion |
| Edits | Every edit with fraction changed, practice metrics, and decision |
| Held-out evaluation | Baseline, result, and negative control with sample counts |
| Side effects | Unrelated behavior measured after the edit |
| Files | Ledger, kept checkpoint, and edit or construction script |
| Limits | Sample size and alternative explanations |

The template is `assets/templates/wsp-report.md`. The numbers in the example are placeholders.

## Development

| Command | Action |
|---------|--------|
| `python -m unittest discover -s skills/weight-space-programming/tests` | Runs the script tests |
| `npm test` | Runs every CLI and Python test in the repository, including these |
| `node packages/cli build` | Regenerates the agent guides and validates the skill |

## Troubleshooting

<details>
<summary><strong>The agent does not see the skill</strong></summary>

Restart the agent session after installing, and confirm the folder is in the path your agent reads (see the table in [Installation](#installation)).

</details>

<details>
<summary><strong>"PyTorch is required for .pt/.pth files"</strong></summary>

The checkpoint is a PyTorch pickle. Install PyTorch, or convert the checkpoint to `.safetensors` on a machine that has it.

```bash
python3 -m pip install torch
```

</details>

<details>
<summary><strong>"over budget" and exit code 2</strong></summary>

The ledger has no forward passes left. This is intended: either finish with analysis only, or ask the user to raise the budget and record it with a new `init --force` or a note.

</details>

<details>
<summary><strong>SVD is skipped for a large matrix</strong></summary>

Matrices whose smaller side is larger than `--max-svd-dim` are skipped to keep the inspector fast. Raise the limit, or select the tensor with `--tensor` and compute a truncated SVD in your own script.

</details>

<details>
<summary><strong>Unsupported safetensors dtype</strong></summary>

The pure Python reader supports F64, F32, F16, BF16, and the common integer types. For FP8 or other formats, load the checkpoint with PyTorch and save it as `.safetensors` in F32 or BF16.

</details>

## Limitations

- The method depends on the agent's reasoning ability; the source post used one frontier model, and its numbers are not expected results for other models.
- Weights that fit in context are far easier to reason about. Large models need summaries, products, and projections computed in Python.
- Editing removes obstacles that hide an ability; it cannot add an ability the model lacks.
- The scripts run CPU numpy. Forward passes of large LLMs need your own runner; the ledger still records them.
- The skill does not provide environments or benchmarks; practice and held-out evaluation come from the user.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [Weight-Space Programming (blog post)](https://rikiyat.github.io/blog/weight-space-programming/) | Not stated | Source of the method, rules, and examples |

## License

No license has been declared for this skill yet. See the [root README](../../README.md#license).
