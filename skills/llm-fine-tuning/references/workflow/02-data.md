# Step 2: build, check, and split the data

## Row format

One JSON object per line:

```json
{"messages": [...], "tools": [...], "group": "<session id>"}
```

- **messages:** OpenAI-style `system`, `user`, `assistant`, `tool`. Assistant thinking goes in a `reasoning_content` field or a leading `{"type": "thinking", "thinking": "..."}` content part.
- **tools:** OpenAI function definitions. Optional for plain chat data.
- **group:** the session a row came from. Windows of one session share a group so they never land on both sides of the split.

## The data rules

1. **One rendering path.** The row budget, the trainer, and every check must render rows with the target model's own chat template and tokenizer. A row measured with another tokenizer can overflow by thousands of tokens once rendered correctly, and some libraries fall back to the wrong tokenizer without an error. Assert the tokenizer you expect.
2. **Rows fit the training context.** Measure every row with the target tokenizer. Rows chunked for another model must be re-chunked.
3. **Train with what you serve.** Every row carries the system prompt and the full tool set of the harness the model will run in. Rows without tool definitions regress tool use while the loss still improves, and declaring a single tool changes even the base model's behaviour.
4. **Thinking on every assistant turn** for a thinking model. Turns without thinking teach it to skip reasoning. If the source has none, generate grounded first-person reasoning for each step first, or drop those rows.
5. **One set of inference settings.** If the model takes a reasoning effort or a thinking budget, render every row at one value and remember it; it is part of the model you ship.
6. **Split by session, with a fixed seed,** so rebuilds hold out the same sessions.
7. **Loss on assistant messages,** thinking included, unless the user decides otherwise.
8. **Clean harness noise.** Agent logs often record API errors ("529 Overloaded") as tool messages with no call id. Drop those; keep real oddities such as parallel tool results.
9. **No secrets or personal data.** Scan rows for keys, tokens, and personal data before they go to any service.

## Check the data

```bash
python3 <skill-dir>/scripts/data/check_dataset.py --input rows.jsonl --name my-run --tokenizer <hf-model-id> --max-tokens <context> --price-per-million <usd> --batch-size 8
```

Use `python` or `py -3` on Windows. Without `--tokenizer` the counts are estimates (characters / 4); say so and do not size rows or quote costs from them. With a recipe, use the recipe's dataset script instead: it renders with the exact training path.

Read every `ADVICE` line in the output and act on it:

| Advice | Action |
|--------|--------|
| Most rows open with a tool call | Add a conversational slice (step 4) before training |
| Assistant turns without thinking | Generate thinking or drop the rows |
| Rows without a system prompt | Add the serving system prompt |
| Several tool sets | Declare the full serving tool set everywhere |
| Few optimizer steps | More data, a second epoch, or a smaller batch |

## Size

Aim for at least about 100 optimizer steps (rows divided by batch size, times epochs). About 1,000 good rows was enough for a strong agentic fine-tune in the Inkling 2 Small recipe. Quality and coverage of the serving conditions matter more than volume.

## Try the pipeline for free

The Inkling 2 Small recipe ships `make_synthetic_rows.py`, which writes fake agent sessions to `~/.gti/llm-fine-tuning/<project>/data/`. Use it to dry-run every offline step. Never train on it.
