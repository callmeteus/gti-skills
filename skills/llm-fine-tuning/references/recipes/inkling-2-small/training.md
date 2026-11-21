# Training Inkling 2 Small on Tinker: data rules, hyperparameters, cost

## The data rules (enforced by prepare_dataset.py and train.py)

1. **One rendering path.** The row budget, the trainer and every check use
   `<skill-dir>/scripts/inkling-2-small/inkling2.py`. The dataset report records the rendering provenance
   (model, renderer, tokenizer, effort, package versions) and the sha256 of both
   splits; the trainer refuses a dataset whose provenance or files changed.
2. **Rows fit the variant.** At most 65,536 tokens for the 64K variant, measured with
   the H200K tokenizer. Rows chunked for another model (or another Inkling) will not
   fit: re-chunk them for this one.
3. **Train with what you serve.** Every row carries the system prompt and the full
   tool set of the harness the model will run in. Rows without tool definitions
   regressed tool use for us even while loss improved. Declaring a single tool
   changes the base model's behaviour too: with only `Bash` declared, the *base*
   called `ls` on "Hey there!" in 6 of 12 samples; with the full set, 0 of 12.
4. **Thinking on every assistant turn.** Inkling 2 is a thinking model. Turns
   without thinking teach it to skip reasoning. If your transcripts have none,
   generate grounded first-person reasoning for each step first (a separate pipeline).
5. **One effort.** Every row is rendered at one effort (0.9 = `high` by default).
   The effort line is part of the prompt the model is trained under.
6. **Split by session.** Give rows a `group` (the session id) so windows of one
   session never land on both sides; the split is seeded so rebuilds hold out the
   same sessions.
7. **Loss on all assistant messages, thinking included**, mean-reduced per row.

## Hyperparameters

| | Default | Why |
|---|---|---|
| Learning rate | 1e-4 | `get_lr` has no Inkling calibration. Tinker's own SFT sweeps put the largest MoEs at 3e-4 best with 1e-4 within noise, 1e-3 clearly worse, 3e-3 diverging. On agentic transcripts at batch 8, 1e-4 trained Inkling 2 cleanly with a monotonic loss and probes passing at every checkpoint. If budget allows, run a 3e-4 sibling and compare behaviour, not loss |
| Schedule | linear decay to zero | built-in annealing |
| Batch | 8 rows | with 64K rows that is ~350K tokens per step |
| Epochs | 1 | 1,073 rows gave 135 steps; test NLL was still falling at step 120 but behaviour was already where we wanted it |
| Rank | 32 (`release`) / 8 (`full`) | an all-linear rank-8 adapter is already ~1B parameters on this model; LR matters more than rank |
| Eval / save | every 20 steps | each save is a checkpoint you can probe |

Aim for at least ~100 optimizer steps (`rows / batch x epochs`). With a few hundred
rows, use two epochs or a batch of 4.

**Divergence signature:** validation NLL dips, then rises within the first 20-40
steps. Stop the run and halve the learning rate.

## What a healthy run looked like

| | all-linear r8 | attention + unembed r32 |
|---|---|---|
| Train tokens | 46.9M | 46.9M |
| Steps | 135 | 135 |
| test NLL | 0.7314 → 0.6796 | 0.7314 → 0.6894 |
| Summed step time | ~17.5 min | similar |
| Billed | $70.34 | $70.34 |
| Behaviour probe | pass at every checkpoint | pass, 12/12 on all three probes |

## Cost

Training = train tokens x epochs x price (`$1.50/M` on the 64K variant, `$3.00/M` on
256K). The smoke test prints the estimate; tell the user and get a yes before
`--train`. Periodic evaluation adds forward passes over the validation split.
Sampling for probes and the conversational slice is cents to a few dollars.
Checkpoint storage is billed per GB-month: a full-linear rank-8 checkpoint is 4.2 GB,
and the cookbook saves one every 20 steps; delete the periodic ones you no longer
need (`tinker checkpoint list`, `tinker checkpoint delete`).

Train on the 64K variant even if you need 256K at inference: it costs half as much
and the adapter transplants (`references/recipes/inkling-2-small/long-context.md`).

## Weights & Biases

On by default (`WANDB_API_KEY` in `~/.gti/llm-fine-tuning/.env`). Watch `train_mean_nll`, `test/nll` and
`learning_rate`; confirm the first points arrive before walking away.

## Operational rules (from the cookbook's AGENTS.md, and our own scars)

- Submit Tinker calls and await their futures; never wrap them in your own timeouts
  or retry loops. The SDK retries and detects stuck requests.
- A sampling client created before a save samples the old weights. Make a new one.
- Commit your code before each run and keep the run directory: `checkpoints.jsonl`
  maps checkpoint names to `state_path` (downloadable) and `sampler_path` (servable).
- The cookbook prints a fully colorized example every step (~50K tokens of text per
  64K row); `train.py` replaces it with a one-line summary.
