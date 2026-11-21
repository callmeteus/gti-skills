# Export, exact merge, upload, serve

Training leaves an adapter in Tinker storage. Getting a model anyone can run is:
download the adapter, download the base, merge exactly, verify, upload, serve.

## 1. Download the adapter

```
tinker checkpoint download tinker://<run-id>:train:0/weights/final -o ./adapters
```

- Use the **training** path (`weights/<name>`). Sampler checkpoints cannot be
  downloaded. The CLI exports through a temporary external-weights checkpoint
  (it briefly starts a training session on the base) and deletes it afterwards.
- Periodic checkpoints expire after 7 days; `final` does not. Pick by probe and
  eval, then download promptly.
- The directory holds `adapter_model.safetensors` (fp32, PEFT names) and
  `adapter_config.json` (`r`, `lora_alpha`). Files of an age-encrypted checkpoint keep
  a `.age` suffix: decrypt with `age -d` first.

Check it before downloading 394 GB of base:

```
hf download thinkingmachines/Inkling-2-Small model.safetensors.index.json --local-dir ./base
python <skill-dir>/scripts/inkling-2-small/merge/merge_lossless.py check --adapter-dir ./adapters/<dir> --base-index ./base/model.safetensors.index.json
```

`check` exits non-zero if any module has no exact BF16 target (an expert adapter).

## 2. Publish the adapter alone (optional, minutes)

```
tinker checkpoint push-hf tinker://<run-id>:train:0/weights/final --repo you/my-model-LoRA
```

A PEFT repo (ours: 327 MB) for people who already serve Inkling 2 Small and want to
switch adapters per request, or re-merge themselves. Private unless `--public`.

## 3. Download the base and merge

Pin the base commit so the merge is reproducible:

```
hf download thinkingmachines/Inkling-2-Small --revision <commit> --local-dir ./base
python <skill-dir>/scripts/inkling-2-small/merge/merge_lossless.py merge --base-dir ./base --adapter-dir ./adapters/<dir> --out-dir ./merged
```

Resources: ~790 GB of disk (base + merged), RAM for one shard plus its copy (96 GB
was comfortable), CPUs only. Our merge: 289 tensors in all 24 shards, 8 minutes on
16 CPUs; the base download was the long pole (24 minutes at ~270 MB/s inside a cloud
region; plan for hours on a home line). The script resumes shard by shard, writes
`MERGE_REPORT.json` (per-tensor relative delta and changed-element fraction), copies
every other file byte for byte, and fails if any shard changed size.

No 800 GB box? `<skill-dir>/scripts/inkling-2-small/merge/modal_app.py` runs download, merge and upload inside Modal
next to a persistent volume (this is how we shipped). Delete the base copy from the
volume afterwards; storage is billed monthly.

## 4. Verify before you publish (<skill-dir>/scripts/inkling-2-small/merge/merge_check.py)

Serve the merged checkpoint (step 6), then score the same rendered validation rows on
both sides:

```
python <skill-dir>/scripts/inkling-2-small/merge/merge_check.py render --dataset my-run --rows 16 --out val.jsonl
python <skill-dir>/scripts/inkling-2-small/merge/merge_check.py tinker --rows val.jsonl --model tinker://<run-id>:train:0/sampler_weights/final --out tinker.jsonl
python <skill-dir>/scripts/inkling-2-small/merge/merge_check.py tinker --rows val.jsonl --model thinkingmachines/Inkling-2-Small --out base.jsonl
python <skill-dir>/scripts/inkling-2-small/merge/merge_check.py sglang --rows val.jsonl --url http://<server>:30000 --out merged.jsonl
python <skill-dir>/scripts/inkling-2-small/merge/merge_check.py compare tinker.jsonl merged.jsonl --rows val.jsonl
python <skill-dir>/scripts/inkling-2-small/merge/merge_check.py compare base.jsonl merged.jsonl --rows val.jsonl
```

Ours, on 897K held-out tokens: merged NLL 0.647 vs Tinker adapter 0.644, mean |delta
logprob| 0.07 between them against 0.14 to the base. Then run `probe.py` against the
server with `--base-url`. A wrong merge (wrong scaling, a transposed delta, a skipped
shard) shows up here as a merged model that sits as close to the base as to the
adapter.

## 5. Upload

```
hf upload you/my-model ./merged . --exclude "MERGE_REPORT.json"
```

or `HfApi().upload_folder(...)` from Python (`upload_large_folder` was removed in
recent `huggingface_hub`). With `hf_xet` installed the Hub deduplicates chunks
against the base repository: our 394 GB went up in about five minutes because only
the patched tensors were new. Start private, check the file list and sizes against
the base, then flip to public.

Model card essentials: base model and its license (Apache 2.0), what changed (which
tensors), the reasoning effort to run at, the system prompt shape and tool
expectations, the context window, hardware, and benchmark numbers with the harness
and the base measured on the same harness.

## 6. Serve

The merged checkpoint has the base's layout, so the base's recipes apply unchanged.

**SGLang** (`lmsysorg/sglang:dev-inkling-2-small` until support is in a release):

```
sglang serve --model-path you/my-model \
  --tp 2 --ep 2 --attention-backend fa4 --bf16-gemm-backend torch --dtype bfloat16 --page-size 128 \
  --grammar-backend xgrammar --reasoning-parser inkling --tool-call-parser inkling2 \
  --context-length 1048576 --host 0.0.0.0 --port 30000 \
  --speculative-algorithm DSPARK
```

TP2/EP2 on two B300; use `--tp 4 --ep 4` on four B200 and `--tp 8 --ep 8` on eight H200.

**vLLM** (`vllm/vllm-openai:inkling-2-small`):

```
vllm serve you/my-model --tensor-parallel-size 4 --max-model-len 262144 \
  --reasoning-parser inkling --enable-auto-tool-choice --tool-call-parser inkling \
  --speculative-config '{"method":"dspark","num_speculative_tokens":7,"draft_sample_method":"probabilistic"}'
```

What we measured (SGLang):

- Four B200 (TP4): ~1,310 output tokens/s aggregate across 25 concurrent ~175K-token
  agent sessions, ~52 per stream.
- Two B300 hold ~2.2M tokens of KV cache: about two full 1M-token sessions, or many
  shorter ones.
- DSpark speculative decoding proposed ~5 draft tokens per step and roughly doubled
  per-stream decode, but the draft and its CUDA graphs shrink the KV pool: 16 long
  agent sessions on two B300 filled it to 92% and thrashed with nothing finishing.
  Size concurrency to the pool that is left, or turn DSpark off for wide batches.
- Cold start on a serverless GPU platform: finding B300 capacity took up to ~27
  minutes, loading 394 GB ~4.5 minutes, graph capture ~6 minutes. Warm the server
  with `GET /health` before a benchmark.

**PEFT adapter instead of a merge**: SGLang (`--lora-paths`) and vLLM
(`--enable-lora --lora-modules`) can apply the `-LoRA` repo on top of the base when
one deployment serves several fine-tunes. Check your serving version supports LoRA
for inkling2 first; the merged checkpoint has no such dependency.

**On Tinker**: the sampler path is a model name on the OpenAI- and
Anthropic-compatible endpoints (`references/recipes/inkling-2-small/model-facts.md`), up to 256K with a
transplant. No GPUs needed.
