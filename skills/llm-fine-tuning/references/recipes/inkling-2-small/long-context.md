# Long context: train at 64K, transplant to 256K, self-host for 1M

## Three windows, three places

| Window | Where | Notes |
|---|---|---|
| 65,536 | Tinker, `thinkingmachines/Inkling-2-Small` | prompt + output; cheapest to train ($1.50/M) |
| 262,144 | Tinker, `...:peft:262144` | prompt + output; $3.00/M to train |
| 1,048,576 | your own SGLang or vLLM | the model's native window; Tinker does not serve it |

## Train at 64K

Our rows were all at most 64K tokens. Training on the 256K variant costs twice as
much per token and is only worth it if your rows are longer than 64K.

## Transplant to 256K (<skill-dir>/scripts/inkling-2-small/transplant_256k.py)

`ServiceClient.create_training_client_from_state(path, base_model=...)` loads a
saved training checkpoint onto a *compatible* base model, which the SDK documents as
"e.g. a different context length". Save sampler weights from that client and you
have the same adapter on the 256K variant:

```
python <skill-dir>/scripts/inkling-2-small/transplant_256k.py --run-dir <run> --checkpoint final --needle 130000 250000
```

Loading took 19 seconds. Needle recall (a codename at 12% depth, "reply with just
the codename"):

| Prompt | Transplant | Base 256K |
|---|---|---|
| ~134K tokens | found | found |
| ~251K tokens | found | found |

The transplant passed the behaviour probe like the 64K adapter (12/12 text on a
greeting). The input must be a training checkpoint (`.../weights/<name>`); the
output sampler path is TTL-free.

Honest caveat: with rows of at most 64K, behaviour from 64K to 256K is the base
model's long-context competence carrying the adapter. The needle test says it reads
that far; your long sessions say whether it still works the way you trained it.

## Configure the agent harness for the cap

The cap is prompt plus output. A coding agent with a large tool set sent an 84,019
token first request with 16,384 tokens of output room; on the 64K variant that is
rejected outright. For agents use the 256K transplant and set:

- max context 262,144, max output 16,384 (or what you need);
- compaction well below the cap minus output (we used 200,000 at 256K and 48,000 at
  64K) so the harness summarizes before the server refuses.

Long agent benchmarks hit the 256K ceiling too: a DeepSWE run on Tinker failed 18 of
47 finished tasks with 400 errors after ~140 steps. Run those on a self-hosted
server with the full window.

## 1M on your own hardware

The merged checkpoint keeps the base's 1,048,576-token window; serve with
`--context-length 1048576` (SGLang) or `--max-model-len` (vLLM). On LongBench v2 at
1M our fine-tune scored 70.2% against the base card's 70.6%: the adapter costs
nothing at length. KV memory, not the flag, decides how many such sessions fit
(`references/recipes/inkling-2-small/export-merge-serve.md`).
