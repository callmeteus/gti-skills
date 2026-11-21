# Step 5: export, merge, verify, serve

Skip this step when the model stays on the training platform.

## Download the adapter

Download the training checkpoint (not a sampling-only path) to a folder the user chose, or under `~/.gti/llm-fine-tuning/<project>/adapters/`. Check its config: rank, alpha, target modules. Base checkpoints can be hundreds of gigabytes; check the adapter against the base's tensor index before downloading the base.

## Merge exactly, or serve the adapter

- **Exact merge:** for each adapted full-precision tensor, compute `cast(fp32(W) + (alpha / r) * B @ A)` back to the stored dtype; copy every other tensor byte for byte. Shard sizes stay identical, so every serving recipe for the base still applies, and hubs that deduplicate chunks upload only the changed tensors.
- **Refuse** a merge into quantized tensors. Serve that adapter on the training platform instead, or as a separate adapter on a server that supports adapters for this architecture.
- **Adapter serving:** vLLM and SGLang can apply a PEFT adapter on top of the base when one deployment serves several fine-tunes. Check that the serving version supports adapters for the architecture.
- Pin the base model revision so the merge is reproducible. Plan disk for the base plus the merged copy.

The Inkling 2 Small recipe ships `merge/merge_lossless.py` (with an offline `selftest`) and `merge/modal_app.py` for running the merge in the cloud.

## Verify token by token

Before serving or publishing, score the same rendered validation rows through the training platform's adapter and through the merged, served model, then compare per-token log probabilities. An exact merge sits at kernel noise from the adapter and clearly away from the base. A wrong merge (wrong scaling, transposed delta, a skipped shard) sits as close to the base as to the adapter. In the recipe: merged NLL 0.647 against 0.644 on the platform, mean absolute log-probability difference 0.07, against 0.14 to the base.

Then run the behaviour probe against the server.

## Publish only when asked

Publishing is an outward action. Upload only when the user asks, start private, check the file list and sizes against the base, then let the user make it public. A model card names the base model and its license, what changed (which tensors), the inference settings to run at, the system prompt and tool expectations, the context window, the hardware, and evaluation numbers with the harness and the base measured on the same harness.

## Serve

- Use the base model's serving recipe (parsers for reasoning and tool calls, parallelism, context length).
- Size concurrency to the KV-cache pool. Speculative decoding speeds each stream but takes memory; wide batches of long sessions can thrash.
- Hosted context caps often count prompt plus output. Agent harnesses with large tool sets overflow small caps on the first request; set the harness's max context, max output, and compaction threshold below the cap.
- Warm a scale-to-zero server before a benchmark.
