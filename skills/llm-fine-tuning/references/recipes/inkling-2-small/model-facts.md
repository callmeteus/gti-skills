# Inkling 2 Small: the facts that change how you fine-tune it

Checked against the model card, the cookbook and our own runs in November 2026.
Prices and service limits move; re-check the linked pages before quoting them.

## The model

| | |
|---|---|
| Name | `thinkingmachines/Inkling-2-Small` (Thinking Machines Lab), Apache 2.0 |
| Shape | Mixture of Experts, 594B total / 17B active parameters, 48 layers, 384 routed experts (top-8), hidden size 4608 |
| Context | 1,048,576 tokens natively |
| Thinking | Effort-conditioned. `reasoning_effort` takes a preset (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`) or a float; `high` is 0.9, the renderer's default |
| Inputs | Text and images. This skill covers text fine-tuning only |
| Extras | A bundled DSpark draft model for speculative decoding |

## Tokenizer and renderer

- Renderer: `tml_v0`, from the `tml-renderers` package that `tinker-cookbook` pulls in.
  Resolve it with `model_info.get_recommended_renderer_name(model)`; never hardcode it.
- Tokenizer: **H200K** (`H200kBaseChatTokenizer`). Inkling and Inkling-Small use the
  older o200k vocabulary. `tml-renderers` 0.1.0 rendered Inkling 2 with o200k
  *without any error*; rows chunked to 64K came out shorter than reality and 77 of
  834 overflowed when rendered correctly (the longest was 81,460 tokens). Pin
  `tml-renderers>=0.4.0` and `tinker-cookbook>=0.6.0`; `<skill-dir>/scripts/inkling-2-small/inkling2.py` refuses
  to render with any tokenizer but H200K.
- What a rendered row looks like: system prompt, then a zero-loss `tool_declare`
  system message carrying the tool JSON, then a system line `Thinking effort level:
  0.9`, then the conversation. Assistant turns are `<|message_model|>` messages with
  `<|content_thinking|>`, text and `<|content_invoke_tool_json|>` parts.
- There is no special think token, so literal `<think>` text in your data is just
  text (unlike Qwen and Nemotron, where it tokenizes as control tokens).
- The renderer keeps earlier-turn thinking in history (the "extension property"), so
  the cookbook trains a whole multi-turn row as one example. No preserve-thinking
  variant is needed.

## On Tinker

| Tinker model name | Hard cap (prompt + output) | Train price per 1M tokens |
|---|---|---|
| `thinkingmachines/Inkling-2-Small` | 65,536 | $1.50 |
| `thinkingmachines/Inkling-2-Small:peft:262144` | 262,144 | $3.00 |

Sampling: $0.30 per 1M prompt tokens, $0.03 cached, $1.00 per 1M output tokens.
Prices: https://tinker-docs.thinkingmachines.ai/tinker/models/models_and_pricing/

- No Tinker endpoint serves the 1M window. A client configured for 1M against the
  plain model name only *appears* to work until a request crosses 65,536.
- The cap counts output. A 50K prompt with `max_tokens` 16,384 is rejected on the
  64K variant ("rejected the request as invalid").
- Tinker's OpenAI-compatible (`.../oai/api/v1`) and Anthropic-compatible
  (`.../anthropic/api/v1`) endpoints rendered our requests identically (prompt token
  counts within 12) and both keep earlier-turn thinking for Inkling, so no proxy is
  needed to serve the way you trained. Sampler paths (`tinker://.../sampler_weights/<name>`)
  work as model names.
- `hyperparam_utils.get_lr` raises `NotImplementedError` for Inkling models. You
  choose the learning rate (`references/recipes/inkling-2-small/training.md`).
- Periodic checkpoints carry the cookbook's TTL (7 days); `final` is kept. Point
  long-lived clients at a TTL-free sampler path (`final`, or a transplant you saved).
  Sampler checkpoints cannot be downloaded; download `weights/<name>`.

## The released checkpoint

Open weights came out after the model had been on Tinker for about a week. What
matters for fine-tuners is the storage format:

| Tensors | Format |
|---|---|
| Routed experts, layers 0-39 | NVFP4 |
| Routed experts, layers 40-47 | MXFP8 |
| Attention projections (`wq_du`, `wk_dv`, `wv_dv`, `wo_ud`, `wr_du`, `gate_attn`), router, embeddings, unembedding head | BF16 |

About 394 GB in 24 safetensors shards (`model_type: inkling2`). Serving needs at
least ~500 GB of aggregate GPU memory: two B300, four B200, four H200 (an eight-H200
recipe also exists). An MXFP8-everywhere sibling needs ~800 GB.

This table is why `references/recipes/inkling-2-small/adapter-shape.md` exists: a LoRA on the experts cannot
be merged into 4-bit weights without requantizing them.

## No GGUF yet

llama.cpp has no Inkling 2 architecture support at the time of writing, so the
llama.cpp/GGUF route of the general `tinker-ai-skill` does not apply. Serve with
SGLang or vLLM (`references/recipes/inkling-2-small/export-merge-serve.md`) or on Tinker.
