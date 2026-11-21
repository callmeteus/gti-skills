# Lessons from shipping Tess-4.5-594B-A17B on Inkling 2 Small

Each one cost us time, money or a run. The scripts encode the fix.

1. **A silent tokenizer is the worst tokenizer.** An old `tml-renderers` rendered
   Inkling 2 with the o200k vocabulary of earlier Inklings, without an error. Rows
   that "fit" 64K overflowed by up to 16K tokens once rendered correctly. Pin the
   packages and assert the tokenizer class (`<skill-dir>/scripts/inkling-2-small/inkling2.py` does).

2. **Decide the adapter shape before you train, not after the weights ship.** Our
   first run trained all linear layers (better NLL). When the open checkpoint
   arrived with 4-bit experts, that adapter could not be merged exactly; we
   retrained attention + unembed only for another $70. If you might ever release
   weights, train `--adapter release` from the start.

3. **Agent data teaches "start working".** 112 of 113 sessions opened with a tool
   call. A self-distilled conversational slice (~12% of rows, a few dollars) and a
   probe on every checkpoint kept the model conversational. A different base model
   without them answered "Hey there!" with a tool-call spiral at step 20 while its
   loss fell.

4. **Probe with the real tool set.** With one tool declared, even the base model
   called `ls` on a greeting half the time. With the full set, never. Declare in
   training and in probes what you will declare in production.

5. **Train at 64K, transplant to 256K.** Same adapter, half the training price, 19
   seconds to move. Agents need the 256K variant: the cap includes output, and a
   large tool set plus 16K of output room overflowed 64K on the first request.

6. **Effort is part of the model you ship.** Rows at 0.9; the fine-tune scored 70.6%
   at `high` and 88.2% at `xhigh` on the same 51 tasks while the base did not move.
   Sweep effort before you conclude anything.

7. **Exact means exact.** A merge that only touches BF16 tensors, computed in FP32,
   keeps every shard the same size; the Hub then deduplicates the upload against the
   base (394 GB in five minutes) and every serving recipe still applies. Prove it
   token by token against the Tinker adapter before you publish.

8. **Speculative decoding is not free.** DSpark roughly doubles per-stream decode
   but takes KV memory; a wide batch of long agent sessions thrashed until we sized
   concurrency to the remaining pool.

9. **Benchmark the base on your own harness.** The card said 86.3%, our harness
   78.4%. Report both.

10. **Clean the harness noise.** Claude Code logs API errors ("529 Overloaded",
    safeguard notices) as tool messages without a call id. `prepare_dataset.py`
    drops those and reports how many; it keeps the genuine oddities (parallel tool
    results interleaved with the next assistant turn) that the renderer handles.

11. **Long benchmarks need long serving.** Tinker's 256K ceiling ended agentic
    benchmark tasks mid-run. Plan self-hosted GPU time for long-horizon evals, and
    a budget: GPU capacity, cold starts and timeouts add up fast.
