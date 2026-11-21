---
name: llm-fine-tuning
description: >-
  Plans, runs, and ships supervised fine-tunes (LoRA SFT) of large language
  models on any platform, with a proven end-to-end recipe for Inkling 2 Small on
  Tinker. Decides whether fine-tuning is the right tool, builds and checks chat
  datasets (tool calls, thinking, split by session, exact token counts with the
  target tokenizer), picks an adapter shape that can be merged into the released
  weights, estimates cost and waits for approval before spending, probes
  behaviour on the base and every checkpoint, adds a self-distilled
  conversational slice, merges exactly and verifies token by token, and
  evaluates honestly against the base on the same harness. Use when the user
  wants to fine-tune, train a LoRA, distill a model, turn agent transcripts into
  training data, evaluate or merge a fine-tuned checkpoint, serve or publish a
  fine-tune, or mentions Tinker or Inkling. Do not use for prompt engineering,
  retrieval, pretraining from scratch, or editing weights by hand without
  training (use weight-space-programming).
compatibility: >-
  Generic scripts: Python 3.9+, standard library (transformers optional for
  exact token counts). Inkling 2 Small recipe: Python 3.11+, tinker-cookbook,
  tml-renderers, a Tinker API key; training and sampling cost money; the merge
  needs about 790 GB of disk and serving about 500 GB of GPU memory.
license: MIT
metadata:
  display-name: LLM Fine Tuning
---

# LLM Fine Tuning

## Core Rule

Always respond in the user's language, regardless of the language used in this skill, its references, the scripts' output, or the training data.

## Autonomous Mode

When the user says to work on your own, for example "do it yourself", "faz você mesmo", "you don't need to ask me", "não precisa me chamar", or "just do it", or when the request runs unattended:

- **Do not stop for input.** Skip questions, confirmations, and pauses that wait for the user. At each decision, take the option this skill recommends, or the safest default, and note the decision and the reason.
- **Do not open anything for the user.** No browser tabs, viewers, editors, or servers started for the user to look at. Still write every file the skill produces and give the paths at the end.
- **Never take a gated irreversible or outward action** unless the request already allows it: deleting the user's data, tests, or files; publishing, posting, pushing, or sending; paying; typing credentials. List each one as pending instead.
- **Finish with one report:** the decisions you took and why, what you did, what is pending, and what you could not verify.

In this skill:

- **Fine-tune or not (step 1):** decide from the table in the scope step and record the reason; when a prompt or retrieval would do, say so and stop.
- **Where the weights will run (step 1, step 3):** assume they may leave the platform and choose the exactly mergeable adapter shape.
- **Serving system prompt and tools (step 1):** take them from the dataset rows; when rows disagree, use the most common set and list the choice.
- **Installing packages:** install only into a virtual environment under `~/.gti/llm-fine-tuning/`, never globally or into the user's project; when the request did not allow installs, run the offline steps that need none and list the rest as pending.
- **Anything that costs money** (training, sampling, the conversational slice, transplants, cloud GPUs, the merge on Modal): run the offline smoke test and estimate, then stop and list the paid step as pending with its estimate, unless the request named a budget that covers it.
- **Uploads, publishing, deployments, deleting checkpoints:** never; list them as pending with the exact command.
- **API keys:** never ask for them; when missing, list the steps that need them as pending.
- **Checkpoint choice (step 4):** pick by probe results, then validation loss, and record why.

## Output Location

Everything this skill generates (datasets, reports, probe results, run folders, logs, checks, and run state) goes to `~/.gti/llm-fine-tuning/<project>/`, where `<project>` is the repository folder name and `GTI_HOME` replaces `~/.gti`. Create the folder when needed. Never write generated files into the user's repository: only the changes the user asked for (their code, tests, or docs) go there, and a generated file goes there only when the user names that place. API keys live in `~/.gti/llm-fine-tuning/.env`, never in a repository.

| Folder | Contents |
|--------|----------|
| `~/.gti/llm-fine-tuning/<project>/plan.md` | Scope decisions, budget, and state between sessions |
| `~/.gti/llm-fine-tuning/<project>/data/` | Synthetic rows and conversational slices |
| `~/.gti/llm-fine-tuning/<project>/datasets/` | Checked splits, manifests, and dataset reports |
| `~/.gti/llm-fine-tuning/<project>/runs/` | Training run folders and `checkpoints.jsonl` |
| `~/.gti/llm-fine-tuning/<project>/probes/` | Behaviour probe results |
| `~/.gti/llm-fine-tuning/<project>/check/` | Token-level merge verification files |
| `~/.gti/llm-fine-tuning/<project>/reports/` | The final report from the template |

Adapters, base checkpoints, and merged weights are huge: they go where the user says (default `~/.gti/llm-fine-tuning/<project>/adapters/` for adapters), never into a repository. Scripts resolve a bare name such as `my-run` inside these folders and use a path with a folder in it as given.

## When to use

- The user wants to fine-tune or LoRA-train a model, or to distill a big model into a small one.
- The user has agent transcripts or chat logs and wants a model trained on them.
- The user has a fine-tuned checkpoint to probe, evaluate, merge, serve, or publish.
- The user mentions Tinker, Inkling 2 Small, or the Tess recipe.

Do not use this skill for prompt engineering, retrieval, pretraining from scratch, reinforcement learning from rewards, or editing weights by reasoning without training (that is `weight-space-programming`).

## The rules

1. **Evaluation before data.** Write how success is measured and reserve a held-out set before building rows.
2. **One rendering path.** Count, check, and train with the target model's own chat template and tokenizer; assert the tokenizer.
3. **Train with what you serve:** the same system prompt, full tool set, and reasoning settings in every row.
4. **Decide the adapter shape before training,** from where the model will run.
5. **No money without a yes.** Offline smoke test and cost estimate first; the user approves every paid step.
6. **Behaviour over loss.** Probe the base and every checkpoint; pick the checkpoint by behaviour and evaluation.
7. **Exact means exact.** Merge only full-precision tensors, then verify token by token before serving.
8. **Honest numbers.** Benchmark the base on the same harness, sweep inference settings, report counts.
9. **Publish only when asked,** private first.

## Instructions

### Step 1: scope

Decide whether fine-tuning is the right tool, the target behaviour and its evaluation, the base model, where it trains and where it will run, and the budget. Write them to `plan.md`. See [references/workflow/01-scope.md](references/workflow/01-scope.md).

If a recipe exists for the base model, follow it from here: [references/recipes/inkling-2-small/workflow.md](references/recipes/inkling-2-small/workflow.md) for `thinkingmachines/Inkling-2-Small` on Tinker. Read the recipe's [model-facts.md](references/recipes/inkling-2-small/model-facts.md) first. The generic steps below still apply as the checklist.

### Step 2: data

Build rows in the standard format, then check and split them:

```bash
python3 <skill-dir>/scripts/data/check_dataset.py --input rows.jsonl --name my-run --tokenizer <hf-model-id> --max-tokens <context> --price-per-million <usd> --batch-size 8
```

Act on every ADVICE line. See [references/workflow/02-data.md](references/workflow/02-data.md). Inkling recipe: [training.md](references/recipes/inkling-2-small/training.md).

### Step 3: adapter and training

Choose the adapter shape from where the model will run, set hyperparameters, run the offline smoke test, show the estimate, and train only after the user's yes. See [references/workflow/03-train.md](references/workflow/03-train.md). Inkling recipe: [adapter-shape.md](references/recipes/inkling-2-small/adapter-shape.md), [long-context.md](references/recipes/inkling-2-small/long-context.md).

### Step 4: behaviour

Add a self-distilled conversational slice when most rows open with a tool call, and probe the base and every checkpoint:

```bash
python3 <skill-dir>/scripts/probe/probe.py --base-url <openai-compatible /v1 url> --model <name> --dataset my-run -n 4
```

See [references/workflow/04-behaviour.md](references/workflow/04-behaviour.md). Inkling recipe: [behaviour.md](references/recipes/inkling-2-small/behaviour.md).

### Step 5: export, merge, verify, serve

Only when the model leaves the training platform. Merge exactly, verify token by token, probe the server, and publish only when asked. See [references/workflow/05-export-and-serve.md](references/workflow/05-export-and-serve.md). Inkling recipe: [export-merge-serve.md](references/recipes/inkling-2-small/export-merge-serve.md).

### Step 6: evaluate and report

Benchmark the base on the same harness, sweep inference settings, report counts, and fill [assets/templates/fine-tune-report.md](assets/templates/fine-tune-report.md) into `~/.gti/llm-fine-tuning/<project>/reports/`. See [references/workflow/06-evaluate-and-report.md](references/workflow/06-evaluate-and-report.md) and [evaluation.md](references/recipes/inkling-2-small/evaluation.md). Check the plan and the result against [references/quality/anti-patterns.md](references/quality/anti-patterns.md) and the recipe's [lessons-learned.md](references/recipes/inkling-2-small/lessons-learned.md) before reporting.

## Scripts

All scripts take `--help`. Use `python3` on macOS and Linux and `python` or `py -3` on Windows. Paths are relative to `<skill-dir>`.

| Script | Purpose | Needs |
|--------|---------|-------|
| `scripts/data/check_dataset.py` | Validate, count, and split chat rows for any model; cost estimate and advice | Standard library; `transformers` for exact counts |
| `scripts/probe/probe.py` | Behaviour probe through any OpenAI-compatible endpoint | Standard library |
| `scripts/inkling-2-small/prepare_dataset.py` | Inkling: render, validate, measure, and split with the exact training path | Recipe requirements |
| `scripts/inkling-2-small/make_synthetic_rows.py` | Inkling: fake agent sessions for a free dry run | Standard library |
| `scripts/inkling-2-small/conversational_slice.py` | Inkling: self-distilled conversational rows from the base (paid) | Recipe requirements, Tinker key |
| `scripts/inkling-2-small/train.py` | Inkling: offline smoke test, or LoRA SFT on Tinker with `--train` (paid) | Recipe requirements, Tinker key |
| `scripts/inkling-2-small/probe.py` | Inkling: behaviour probe on Tinker or a server | `httpx` |
| `scripts/inkling-2-small/transplant_256k.py` | Inkling: move a 64K adapter to the 256K variant | Recipe requirements, Tinker key |
| `scripts/inkling-2-small/merge/merge_lossless.py` | Inkling: exact merge into the released checkpoint, `check`, offline `selftest` | `torch`, `safetensors` |
| `scripts/inkling-2-small/merge/merge_check.py` | Inkling: token-level comparison of adapter, base, and merged server | Recipe requirements |
| `scripts/inkling-2-small/merge/modal_app.py` | Inkling: download, merge, upload, and serve on Modal | `modal` |

Recipe dependencies are pinned in `scripts/inkling-2-small/requirements.txt`; the key template is `scripts/inkling-2-small/.env.example`.

## Examples

```text
User: I have 3,000 Claude Code transcripts. Fine-tune Inkling 2 Small on them so
it works like our agent.
Agent: Writes the plan (target: the team's harness on 50 held-out tasks; weights
may be self-hosted, so the release adapter). Converts the transcripts to rows,
runs prepare_dataset.py, sees 97% of rows open with a tool call, dry-runs the
conversational slice and shows its cost, then runs the train.py smoke test and
shows the $140 estimate. After the user's yes, trains, probes every checkpoint,
picks step 120, transplants to 256K, and reports base vs fine-tune at high and
xhigh on the same harness.
```

```text
User: Should I fine-tune Llama to know our product docs?
Agent: Explains that changing facts belong in retrieval, not weights, records
the decision in plan.md, and stops without building a dataset.
```

```text
User: Here's my dataset for Qwen. Is it ready to train?
Agent: Runs check_dataset.py with --tokenizer and the model's context, reports
12 rows over budget, missing thinking on 30% of turns, and 140 optimizer steps
at batch 8, and lists the fixes before any spending.
```

## Resources

| Path | Purpose |
|------|---------|
| `references/workflow/` | One file per step: scope, data, train, behaviour, export and serve, evaluate and report |
| `references/quality/` | Anti-patterns |
| `references/recipes/inkling-2-small/` | The Inkling 2 Small on Tinker recipe: workflow, model facts, adapter shape, training, behaviour, long context, export and serving, evaluation, lessons |
| `scripts/data/`, `scripts/probe/`, `scripts/common/` | Generic, standard-library tools |
| `scripts/inkling-2-small/` | The recipe's scripts |
| `assets/templates/` | The report structure |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.

## Notes

- The Inkling 2 Small recipe and its numbers come from [drost-ai/finetune-inkling-2-small](https://github.com/drost-ai/finetune-inkling-2-small) by Migel Tissera (MIT), announced on X in November 2026. They are one team's runs on one model; treat them as evidence of what works, not as expected numbers.
- Prices, model names, and service limits change. Re-check the platform's pages before quoting them.
- Fine-tuning sharpens and redirects what a model can already do; it rarely adds an ability the base lacks.
