<div align="center">

# LLM Fine Tuning

> Fine-tunes that still behave, priced and verified before they ship

**Plans, runs, and ships LoRA fine-tunes of language models on any platform, with checked data, cost approval, behaviour probes, exact merges, and honest evaluation, plus a proven recipe for Inkling 2 Small on Tinker.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Python](https://img.shields.io/badge/python-3.9%2B-blue.svg)](#requirements)
[![Agents](https://img.shields.io/badge/agents-10%20supported-8A63D2.svg)](#installation)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](#requirements)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](#license)

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
- [Security](#security)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Overview

Most fine-tunes fail quietly. The loss falls while the model learns the wrong habit: it answers a greeting with tool calls, skips its reasoning, overflows its context in production, or cannot be merged into the weights it was supposed to ship as. Rows measured with the wrong tokenizer, an adapter on quantized layers, and a benchmark run only at one setting are all invisible until the money is spent.

LLM Fine Tuning gives the agent a six-step method for any model and platform (scope, data, train, behaviour, export, evaluate) with two standard-library tools, a dataset checker and a behaviour probe, and bundles a complete, tested recipe for Inkling 2 Small on Tinker adapted from the one that produced Tess-4.5-594B-A17B. Every paid step waits for the user's yes, and nothing is published unless the user asks.

```text
  goal + base model + rows
          │
          v
  scope: fine-tune or not, evaluation, where it will run, budget
          │
          v
  check_dataset.py ──> splits by session, exact tokens, cost, advice
          │
          v
  adapter shape ──> smoke test ──> estimate ──> user's yes ──> train
          │
          v
  probe.py on base and every checkpoint (+ conversational slice)
          │
          v
  exact merge ──> token-level check ──> serve (only if it leaves the platform)
          │
          v
  base vs fine-tune on the same harness ──> report in ~/.gti/llm-fine-tuning/<project>/
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Decide whether a prompt or retrieval would do instead | Fine-tune to add changing facts |
| Check, count, and split chat rows with tools and thinking | Pretrain models or run reinforcement learning |
| Choose an adapter shape that merges exactly into the released weights | Spend money, upload, or publish without the user's yes |
| Probe the base and every checkpoint for behaviour regressions | Edit weights by hand without training (see Weight Space Programming) |
| Merge exactly and verify token by token before serving | Store API keys or weights in the user's repository |
| Run the full Inkling 2 Small on Tinker recipe | Invent prices, flags, or benchmark numbers |

## Features

- **Scope first:** a decision table for fine-tuning versus prompting, retrieval, or distillation, written to a plan before any data work.
- **Dataset checker:** validates OpenAI-style rows with tool calls and thinking, drops harness noise, splits by session with a fixed seed, counts tokens exactly through the target model's chat template, and estimates cost.
- **Advice that prevents bad runs:** flags rows that mostly open with a tool call, assistant turns without thinking, missing system prompts, mixed tool sets, duplicates, and too few optimizer steps.
- **Adapter shape rules:** put the LoRA only on full-precision tensors when the weights must leave the platform.
- **Cost gate:** offline smoke test and estimate, then the user's yes, before any paid call.
- **Behaviour probe:** greeting, no-tool question, and task prompts through any OpenAI-compatible endpoint, with think-tag leak detection and custom probes.
- **Conversational slice:** self-distilled multi-turn rows from the base model that keep a fine-tune on agent data conversational.
- **Exact merge and verification:** `bf16(fp32(W) + (alpha/r) * B @ A)` on full-precision tensors only, then a token-level comparison against the adapter and the base.
- **Honest evaluation:** base on the same harness, swept inference settings, counts and task overlap.
- **Inkling 2 Small recipe:** dataset rendering with the H200K tokenizer, LoRA training on Tinker, 64K to 256K transplant, exact merge into the NVFP4/MXFP8 checkpoint, Modal stages, and serving notes.
- **Generated files outside the repository:** datasets, runs, probes, and reports go to `~/.gti/llm-fine-tuning/<project>/`.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|----------------|
| Python | 3.9+ | Generic scripts (standard library) | No |
| transformers | Any recent | Optional exact token counts in `check_dataset.py` | No |
| Python | 3.11+ | Inkling 2 Small recipe | No |
| tinker-cookbook, tml-renderers, tinker | See `scripts/inkling-2-small/requirements.txt` | Recipe rendering, training, and sampling | No |
| torch, safetensors | Any recent | Exact merge and its selftest | No |
| Tinker API key | - | Paid training and sampling for the recipe | No |
| modal | Any recent | Optional cloud merge and serving | No |

| Platform | Notes |
|----------|-------|
| macOS, Linux | Use `python3` |
| Windows | Use `python` or `py -3` |

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill llm-fine-tuning
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--scope user` to install for every project, and `--dry-run` to preview.

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

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/llm-fine-tuning` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/llm-fine-tuning .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\llm-fine-tuning .claude\skills\
```

Each agent has a short guide in `skills/llm-fine-tuning/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

To use the Inkling 2 Small recipe, install its dependencies in a virtual environment outside your project:

```bash
python3 -m venv ~/.gti/llm-fine-tuning/venv
~/.gti/llm-fine-tuning/venv/bin/pip install -r skills/llm-fine-tuning/scripts/inkling-2-small/requirements.txt
```

```powershell
py -3 -m venv $HOME\.gti\llm-fine-tuning\venv
& $HOME\.gti\llm-fine-tuning\venv\Scripts\pip.exe install -r skills\llm-fine-tuning\scripts\inkling-2-small\requirements.txt
```

Put the keys in `~/.gti/llm-fine-tuning/.env`, using `scripts/inkling-2-small/.env.example` as the template.

## Quick Start

```text
Fine-tune Inkling 2 Small on the agent transcripts in ./transcripts so it works like our coding agent. Show me the cost before training.
```

The agent writes the plan, converts and checks the rows, adds a conversational slice if most rows open with a tool call, runs the offline smoke test, shows the estimate, and trains only after you approve it.

## Usage

### Input

| Input | Required | Description |
|-------|----------|-------------|
| Goal | Yes | What the fine-tune must do better, in words |
| Base model | Yes | Model id; the Inkling 2 Small recipe applies to `thinkingmachines/Inkling-2-Small` |
| Rows | Yes, to train | JSONL of `{"messages", "tools", "group"}`, or raw transcripts to convert |
| Evaluation | Recommended | Held-out tasks and the harness that scores them |
| Serving conditions | Recommended | System prompt, tool set, reasoning settings, where the model will run |
| Budget | Recommended | The most the user will spend; every paid step still waits for a yes |
| API keys | For paid steps | In `~/.gti/llm-fine-tuning/.env` or the environment, never in chat |

### Examples

```text
Should I fine-tune a model to answer questions about our docs?
```

```text
Check my dataset for Qwen3-8B before I train: rows.jsonl, 32K context.
```

```text
Probe my fine-tune at http://localhost:8000/v1 against the base model with our tool set.
```

```text
Merge my Inkling LoRA into the base weights and prove the merge is exact.
```

## How It Works

```text
  1. Scope ──────────> plan.md: fine-tune or not, eval, base model, platform, budget
          │
  2. Data ───────────> check_dataset.py (or the recipe's prepare_dataset.py)
          │
  3. Train ──────────> adapter shape ─> smoke test ─> estimate ─> yes ─> run
          │
  4. Behaviour ──────> conversational slice ─> probe.py on base and checkpoints
          │
  5. Export ─────────> exact merge ─> token-level check ─> serve  (optional)
          │
  6. Evaluate ───────> base vs fine-tune, same harness, swept settings ─> report
```

## Reference

### check_dataset.py

```bash
python3 scripts/data/check_dataset.py --input rows.jsonl --name my-run [--tokenizer ID] [--max-tokens N] [--price-per-million USD]
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--input` | Required | JSONL file; repeatable |
| `--name` | Required | Dataset name for the output files |
| `--out-dir` | `~/.gti/llm-fine-tuning/<project>/datasets` | Output folder |
| `--tokenizer` | None | Hugging Face id or path for exact counts through the chat template (needs `transformers`) |
| `--max-tokens` | None | Row budget; rows over it fail unless `--drop-overlong` |
| `--val-fraction` | `0.05` | Share of groups held out |
| `--seed` | `split-v1` | Split seed; keep it fixed across rebuilds |
| `--tools-file` | None | Tool definitions for rows that have none |
| `--require-tools` | Off | Fail rows without tool definitions |
| `--price-per-million` | None | Training price in USD per million tokens, for the estimate |
| `--epochs` | `1` | Epochs for the estimate and the step count |
| `--batch-size` | None | Rows per step, for the step count advice |
| `--drop-overlong` | Off | Drop rows over budget instead of failing |
| `--skip-bad-rows` | Off | Drop invalid rows instead of failing |

### probe.py

```bash
python3 scripts/probe/probe.py --base-url URL --model NAME [--dataset NAME] [-n 4]
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--base-url` | Required | OpenAI-compatible root ending in `/v1` |
| `--model` | Required | Model name the endpoint expects |
| `--api-key-env` | `OPENAI_API_KEY` | Environment variable with the key; `NONE` for none |
| `--dataset` | None | Dataset name or prefix; its first train row supplies system prompt and tools |
| `--system-prompt-file` | None | System prompt file |
| `--tools-file` | None | Tool definitions |
| `--probes-file` | None | Custom probes `{"name": {"prompt", "expect": "text" or "tool"}}` |
| `-n` | `4` | Samples per probe |
| `--reasoning-effort` | None | Sent as `reasoning_effort` when given |
| `--temperature` | `1.0` | Sampling temperature |
| `--top-p` | `0.95` | Nucleus sampling |
| `--max-tokens` | `900` | Output tokens per sample |
| `--allow` | `0` | Tool calls or think leaks tolerated on text probes |
| `--out` | `~/.gti/llm-fine-tuning/<project>/probes/<model>-<time>.json` | Result file |

Exit code 1 on FAIL.

### Inkling 2 Small recipe

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `prepare_dataset.py` | Render, validate, measure, and split with the exact training path | `--input`, `--name`, `--model`, `--effort`, `--tools-file`, `--drop-overlong` |
| `make_synthetic_rows.py` | Fake agent sessions for a free dry run | `--out`, `--sessions`, `--long-results` |
| `conversational_slice.py` | Self-distilled conversational rows (paid) | `--source-rows`, `--n`, `--out`, `--dry-run` |
| `train.py` | Offline smoke test, or training with `--train` (paid) | `--dataset`, `--adapter release\|full`, `--learning-rate`, `--train` |
| `probe.py` | Behaviour probe on Tinker or a server | `--dataset`, `--model`, `--base-url`, `-n` |
| `transplant_256k.py` | Move a 64K adapter to the 256K variant | `--run-dir`, `--state-path`, `--needle`, `--dry-run` |
| `merge/merge_lossless.py` | Exact merge | `selftest`, `check`, `merge` |
| `merge/merge_check.py` | Token-level merge verification | `render`, `tinker`, `sglang`, `compare` |
| `merge/modal_app.py` | Download, merge, upload, serve on Modal | `download_base`, `merge`, `upload` |

All recipe scripts live in `scripts/inkling-2-small/` and take `--help`. Bare names such as `my-run` resolve inside `~/.gti/llm-fine-tuning/<project>/`.

## Output

```text
~/.gti/llm-fine-tuning/
├── .env                          # API keys (you create it)
└── <project>/
    ├── plan.md                   # scope decisions and state
    ├── data/                     # synthetic rows, conversational slices
    ├── datasets/                 # my-run.train.jsonl, my-run.val.jsonl, my-run.report.json
    ├── runs/                     # training runs and checkpoints.jsonl
    ├── probes/                   # probe results
    ├── check/                    # merge verification files
    └── reports/                  # the final report
```

| Section | Contents |
|---------|----------|
| Goal and decision | Target behaviour, why fine-tuning, where it will run |
| Data | Sources, rows, tokens, held-out groups, tool openers, thinking coverage |
| Training | Adapter, hyperparameters, steps, loss, cost, run folder |
| Behaviour probes | Base and every checkpoint, chosen checkpoint and why |
| Export and verification | Merge and token-level comparison, or skipped |
| Evaluation | Fine-tune, base on the same harness, base card, task overlap |
| Spend | Training, sampling, storage, GPU time |
| Pending and not verified | Outward steps not taken and checks not run |

## Security

- **Keys:** read from the environment or `~/.gti/llm-fine-tuning/.env`; the agent never asks for, prints, or commits them.
- **Network:** the generic checker runs offline; the probe calls only the endpoint you name; recipe scripts call Tinker, Hugging Face, W&B, or Modal only in their paid or online modes.
- **Data:** rows go to a training service; scan them for keys and personal data first.
- **Publishing:** uploads happen only on request, private first.

## Development

| Command | Action |
|---------|--------|
| `python -m unittest discover -s skills/llm-fine-tuning/tests` | Run this skill's tests (the merge selftest runs when torch and safetensors are installed) |
| `node packages/cli validate --skill llm-fine-tuning` | Validate the skill |
| `node packages/cli build` | Regenerate the per-agent guides |

## Troubleshooting

<details>
<summary><strong>"token counts are estimates"</strong></summary>

`check_dataset.py` ran without `--tokenizer`, so it divided characters by 4. Install `transformers` and pass the target model's Hugging Face id before trusting a row budget or a cost.

</details>

<details>
<summary><strong>"Inkling 2 must render with the H200K tokenizer"</strong></summary>

An old `tml-renderers` or `tinker-cookbook` is installed and would count tokens with the wrong vocabulary. Reinstall the pinned versions from `scripts/inkling-2-small/requirements.txt`.

</details>

<details>
<summary><strong>"dataset was rendered with ... live rendering is ..."</strong></summary>

The dataset was built in a different environment or with different package versions than the trainer. Rebuild it with `prepare_dataset.py` in the environment you train from.

</details>

<details>
<summary><strong>The probe says ERROR</strong></summary>

Every request for a probe failed: the URL, model name, or key is wrong, or the server is still starting. Check that `--base-url` ends in `/v1`, warm the server, and run again.

</details>

<details>
<summary><strong>"no exact merge target ... the routed experts are NVFP4/MXFP8"</strong></summary>

The adapter was trained with LoRA on the experts (`--adapter full`), which cannot merge into 4-bit weights. Serve it on Tinker, or retrain with `--adapter release`.

</details>

## Limitations

- The only bundled recipe is Inkling 2 Small on Tinker; for other models the agent follows the generic steps and the platform's own documentation.
- Text fine-tuning only; image parts in rows are rejected.
- Supervised fine-tuning only; no preference or reinforcement learning.
- Prices, model names, and limits in the recipe were checked in November 2026 and change.
- The Inkling merge needs about 790 GB of disk and serving needs about 500 GB of GPU memory.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [drost-ai/finetune-inkling-2-small](https://github.com/drost-ai/finetune-inkling-2-small) | MIT | The Inkling 2 Small recipe, its scripts and references, and the lessons generalized in the workflow |
| [drost-ai/tinker-ai-skill](https://github.com/drost-ai/tinker-ai-skill) | See the project | Referenced for turning agent transcripts into rows |

## License

MIT, see [LICENSE](LICENSE). Copyright Migel Tissera for the upstream Inkling 2 Small recipe; the additions in this repository follow the same license.
