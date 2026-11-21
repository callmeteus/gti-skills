# The adapter-shape decision: where the LoRA goes decides where you can serve it

Tinker's LoRA can cover three module groups, switched independently on
`create_lora_training_client(train_attn=, train_mlp=, train_unembed=)`. The cookbook's
`train.Config` has no such switches; `<skill-dir>/scripts/inkling-2-small/train.py` passes them through.

On Inkling 2 Small, "mlp" means the 384 routed experts per layer, which the released
checkpoint stores as NVFP4 and MXFP8. That makes the choice structural:

| | `--adapter release` (default) | `--adapter full` |
|---|---|---|
| Modules | attention projections + unembedding head | attention + experts + unembedding |
| Rank | 32 | 8 |
| Adapter size | 81.7M parameters, 327 MB | ~1.05B parameters, 4.2 GB fp32 |
| Merge into the open checkpoint | **Exact**: every target tensor is BF16 | Not exact: the expert deltas would have to be requantized to 4-bit, which erases most of a small update and perturbs the rest; no tool supports it for inkling2 |
| Where you can serve it | Anywhere the base runs: SGLang, vLLM, Tinker, as a merged checkpoint or as a PEFT adapter | Tinker |

## What it cost us in loss

Same data (1,073 rows, 46.9M tokens), same schedule (one epoch, 135 steps, LR 1e-4,
batch 8), same price ($70.34 each):

| Run | test NLL start → best | Share of the gain |
|---|---|---|
| all-linear, rank 8 | 0.7314 → 0.6796 | 100% |
| attention + unembed, rank 32 | 0.7314 → 0.6894 | ~80% |

The attention-only run was worse on 54 of 57 held-out rows by NLL. It passed
every behaviour probe (12/12 text on a greeting, 12/12 text on a no-tool question,
12/12 tool call on a task), and the merged release scored 88.2% on SWE-Bench Pro v2
Hard at xhigh against the base's 78.4% on the same harness. We decided by behaviour
and shipped it.

## How to choose

- You want open weights, your own serving, or a model card people can download:
  `release`. This is the default.
- You will only ever use the model through Tinker and want every bit of NLL:
  `full`. You can still transplant it to 256K and serve it through Tinker's endpoints.
- Unsure: train `release` first. It is the one you can always ship.

If the NLL gap matters for your data, the levers inside the mergeable shape are a
second epoch and a higher rank on attention only (we did not need them). Do not
turn on `train_mlp` to close the gap unless you accept Tinker-only serving.

## The math of the exact merge

`W <- bf16(fp32(W) + (alpha / r) * B @ A)` for each adapted BF16 tensor, computed in
FP32, every other tensor copied byte for byte. For our adapter (r = alpha = 32,
scaling 1.0) that touched 289 tensors across all 24 shards; relative deltas were
0.24-0.87% of each weight's norm. Shard sizes are identical to the base, so the
merged repository is a drop-in replacement and every published serving recipe
applies unchanged. `<skill-dir>/scripts/inkling-2-small/merge/merge_lossless.py selftest` proves the math and the
byte-for-byte guarantees on a synthetic checkpoint.

Tensor names, adapter → checkpoint:

| Adapter module (Tinker download) | Checkpoint tensor |
|---|---|
| `language_model.layers.N.attn.<proj>` | `model.llm.layers.N.attn.<proj>.weight` |
| `language_model.lm_head` | `model.llm.unembed.weight` |
| `language_model.layers.N.mlp.experts.w{1,2,3}` | NVFP4/MXFP8 experts: refused |
