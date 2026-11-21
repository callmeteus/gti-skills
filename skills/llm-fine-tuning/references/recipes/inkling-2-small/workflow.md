# Recipe: fine-tune Inkling 2 Small on Tinker

Fine-tune `thinkingmachines/Inkling-2-Small` (594B total, 17B active, mixture of experts) with a LoRA on Tinker, then use it on Tinker, self-host it, or publish it. This is the recipe that produced Tess-4.5-594B-A17B (88.2% on SWE-Bench Pro v2 Hard at `xhigh`). Adapted from [drost-ai/finetune-inkling-2-small](https://github.com/drost-ai/finetune-inkling-2-small) (MIT). Many users keep their model private; never upload anything unless they ask.

`R` below is `<skill-dir>/scripts/inkling-2-small`. Every script explains its flags in `--help` and has an offline default. A bare name (`my-run`, `conversational`, `val16.jsonl`) resolves inside `~/.gti/llm-fine-tuning/<project>/`; a path with a folder is used as given. Use `python3` on macOS and Linux and `python` or `py -3` on Windows.

## Before you start

1. **Environment.** Python 3.11+. In a virtual environment outside the user's repository (for example `~/.gti/llm-fine-tuning/venv`), install `R/requirements.txt`. The pins matter: older `tml-renderers` renders Inkling 2 with the wrong tokenizer without an error. Ask before installing.
2. **Keys.** The user copies `R/.env.example` to `~/.gti/llm-fine-tuning/.env` and fills `TINKER_API_KEY`, optionally `WANDB_API_KEY`, and `HF_TOKEN` only to publish. Never ask for, print, or commit them.
3. **Money.** Training costs train tokens times $1.50 per million on the 64K variant (November 2026 list price; check `model-facts.md`). About 1,000 rows of up to 64K tokens is about 47M tokens, about $70 per epoch. Run every script's offline mode first and get the user's yes on the printed estimate before anything that calls Tinker.
4. **Decide two things with the user now:** whether the weights will ever leave Tinker (then `--adapter release`, see `adapter-shape.md`), and the system prompt, tool set, and reasoning effort the model will be served with.

## Steps

1. **Rows.** One JSON object per line: `{"messages": [...], "tools": [...], "group": "<session id>"}`. To try everything for free: `python R/make_synthetic_rows.py --out demo-rows.jsonl --sessions 40 --long-results`. The companion project [drost-ai/tinker-ai-skill](https://github.com/drost-ai/tinker-ai-skill) turns coding-agent transcripts into rows this recipe accepts.
2. **Validate, measure, split.** `python R/prepare_dataset.py --input path/to/rows.jsonl --name my-run`. Renders every row with the exact training rendering (`tml_v0`, H200K tokenizer, tools declared, effort 0.9, loss on every assistant message including thinking), fails on rows over 65,536 tokens or broken rows, drops harness noise, splits by group, and writes the splits and a report with the cost per epoch. Read the ADVICE lines. Details: `model-facts.md`, `training.md`.
3. **Conversational slice** (when ADVICE says most rows open with a tool call):
   ```bash
   python R/conversational_slice.py --source-rows path/to/rows.jsonl --n 150 --out conversational --dry-run
   python R/conversational_slice.py --source-rows path/to/rows.jsonl --n 150 --out conversational
   python R/prepare_dataset.py --input path/to/rows.jsonl --input conversational.jsonl --name my-run
   ```
   A few dollars. Why: `behaviour.md`.
4. **Train.**
   ```bash
   python R/probe.py --dataset my-run --model thinkingmachines/Inkling-2-Small -n 8   # base baseline
   python R/train.py --dataset my-run                                                # offline smoke test
   python R/train.py --dataset my-run --train                                        # after the user approves the cost
   ```
   Defaults: `--adapter release` (rank 32, attention and unembedding, experts frozen), LR 1e-4, batch 8, one epoch, linear decay, eval and save every 20 steps, W&B on. Tinker's `get_lr` has no Inkling calibration; if budget allows, run a `--learning-rate 3e-4` sibling with its own `--log-dir`. Watch `test/nll` at steps 20 to 40: a dip then a rise means the LR is too hot.
5. **Probe every checkpoint.** `python R/probe.py --dataset my-run --model tinker://<run-id>:train:0/sampler_weights/000020`. Sampler paths are in `~/.gti/llm-fine-tuning/<project>/runs/<run>/checkpoints.jsonl`. Greeting and no-tool question must stay text; the task must call a tool. Use `-n 12` before concluding from one miss. Pick by behaviour and evaluation, not by NLL.
6. **Use it on Tinker at 256K.** `python R/transplant_256k.py --run-dir <run> --checkpoint final --needle 130000 250000` loads the 64K-trained adapter onto `thinkingmachines/Inkling-2-Small:peft:262144` in seconds, no retraining. The caps count prompt plus output, so coding agents need this. See `long-context.md`.
7. **Export and merge exactly** (only to self-host or publish):
   ```bash
   tinker checkpoint download tinker://<run-id>:train:0/weights/final -o <adapters folder>
   python R/merge/merge_lossless.py selftest
   python R/merge/merge_lossless.py check --adapter-dir <adapters folder>/<dir> --base-index <base>/model.safetensors.index.json
   hf download thinkingmachines/Inkling-2-Small --revision <commit> --local-dir <base>
   python R/merge/merge_lossless.py merge --base-dir <base> --adapter-dir <adapters folder>/<dir> --out-dir <merged>
   ```
   About 790 GB of disk; ask the user where it goes. Without it, run the same stages on Modal with `R/merge/modal_app.py`. See `export-merge-serve.md`.
8. **Verify the merge token by token** with `R/merge/merge_check.py` (render, tinker, sglang, compare) and probe the server with `probe.py --base-url`. The merged model must sit at kernel noise from the Tinker adapter and clearly away from the base. Only then serve it, or upload it if the user asked (`hf upload`, private first).
9. **Serve** with SGLang or vLLM using the base model's recipes (reasoning parser `inkling`, tool parser `inkling2` on SGLang and `inkling` on vLLM), at least about 500 GB of GPU memory, context up to 1,048,576. No GGUF.
10. **Evaluate honestly.** Run the base through the same harness at the same effort; evaluate at `high` and `xhigh`. See `evaluation.md`.

## Rules that saved the most time

- Resolve the renderer from the model name and assert the H200K tokenizer. Never reuse rows chunked or rendered for another model.
- Decide `release` vs `full` before training. A `full` adapter cannot leave Tinker without a lossy requantization of the experts.
- Train with the exact system prompt, full tool set, and effort you will serve with.
- Probe the base, then every checkpoint, with the real tool set.
- Train at 64K, transplant to 256K; never point an agent at the 64K cap.
- Prove the merge token by token before serving or publishing. Upload only when asked, private first.
- Sweep reasoning effort at evaluation and benchmark the base on your harness.
- Datasets, runs, and checks live in `~/.gti/llm-fine-tuning/<project>/`; adapters, base, and merged weights go where the user says, never into a repository.
