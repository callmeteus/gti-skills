# Step 1: scope the fine-tune

Settle five things before any data work. Write them into `~/.gti/llm-fine-tuning/<project>/plan.md`.

## 1. Is fine-tuning the right tool?

Fine-tuning changes how a model behaves by default: its format, its tool habits, its voice, its domain reflexes. It is a poor way to add facts that change, and an expensive way to fix something a prompt could fix.

| The user wants | Try first | Fine-tune when |
|----------------|-----------|----------------|
| New or changing facts | Retrieval (RAG) or tools | Never for facts alone |
| A fixed output format | A system prompt with examples, structured output | The prompt is long, costly per call, or still fails often |
| A style, persona, or habit | A system prompt | The habit must hold over long sessions or many turns |
| Better results on a narrow task with many examples | Few-shot prompting | There are hundreds of good examples and a measurable gap |
| A smaller, cheaper model that does what a big one does | Prompting the small model | Distilling the big model's outputs into rows |
| Agent behaviour from real transcripts | Prompting with the harness | Transcripts exist and the base model's habits are wrong |

If a prompt or retrieval would do, say so and stop. Record the reason either way.

## 2. The target behaviour and how to measure it

Write the evaluation before the data: what the fine-tune must do better, on which held-out tasks, with which harness, and at which inference settings. A fine-tune without an evaluation is a guess. Reserve the held-out set now; it never enters training.

## 3. The base model

- Pick the smallest model that can do the task when prompted well; fine-tuning sharpens an ability, it rarely creates one.
- Read its model card: license, context window, chat template, tokenizer, whether it is a thinking model and how thinking is controlled, how its released weights are stored (BF16, FP8, 4-bit), and which serving stacks support it.
- If a recipe exists for the model in `references/recipes/`, use it. Today there is one: Inkling 2 Small on Tinker.

## 4. Where it trains and where it will run

Decide both now, because the second constrains the first (see the adapter shape in step 3).

| Option | Kind | Notes |
|--------|------|-------|
| Tinker (Thinking Machines) | Managed LoRA training and sampling, pay per token | The Inkling 2 Small recipe runs here |
| Hosted fine-tuning APIs (OpenAI, Together, Fireworks, and others) | Upload a dataset, get a hosted model | Little control over adapter shape; the model often cannot leave the platform |
| Hugging Face TRL with PEFT | Your own GPUs or cloud GPUs | Full control; you own the weights |
| Unsloth, Axolotl, torchtune | Training frameworks on your GPUs | Faster setup for common models |
| MLX-LM | Apple silicon | Small models, local |

Check the current documentation of the chosen platform for model names, prices, limits, and flags before quoting any of them. Never invent a flag.

Ask the user: will the weights ever need to leave the platform (self-hosting, publishing)? Which system prompt, tool set, and reasoning settings will the model be served with? Training rows must carry exactly those.

## 5. Budget

Estimate the cost before spending: training tokens times epochs times the price per million tokens, plus sampling for probes, plus storage, plus GPU time for evaluation and serving. Show the estimate to the user and get a yes before any step that costs money.

## Using a recipe

When `references/recipes/<model>/` exists, its scripts replace the generic ones from step 2 on, and its reference files hold the model-specific facts. Read the recipe's model facts first.
