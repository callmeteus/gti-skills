# Fine-tune report: <name>

Date: <YYYY-MM-DD>. Base model: <id and revision>. Platform: <where it trained>. Recipe: <recipe or generic>.

## Goal and decision

- **Target behaviour:** <what must improve>
- **Why fine-tuning:** <why a prompt or retrieval was not enough>
- **Where it will run:** <training platform only, self-hosted, published>

## Data

| Item | Value |
|------|-------|
| Sources | <files and where they came from> |
| Rows (train / val) | <n / n> |
| Tokens (train / val) | <n / n>, exact or estimated |
| Groups held out | <n> |
| Rows opening with a tool call | <n/n> |
| Assistant turns with thinking | <n/n> |
| Conversational slice | <n rows, cost> |
| System prompt, tools, inference settings | <what every row carries> |

## Training

| Item | Value |
|------|-------|
| Adapter | <modules, rank, alpha>, mergeable exactly: <yes/no> |
| Learning rate, schedule, batch, epochs | <values> |
| Steps | <n> |
| Validation loss | <start> to <best> at step <n> |
| Cost | <estimated> vs <billed> |
| Run folder | <path> |

## Behaviour probes

| Checkpoint | Greeting (text) | No-tool question (text) | Task (tool) | Verdict |
|------------|-----------------|-------------------------|-------------|---------|
| Base | | | | |
| <step> | | | | |

Chosen checkpoint: <name>, because <reason>.

## Export and verification

<Skipped, or: merge method, tensors changed, token-level comparison (NLL merged vs adapter vs base, mean absolute log-probability difference), probe on the server.>

## Evaluation

| Benchmark | Setting | Fine-tune | Base (same harness) | Base (card) |
|-----------|---------|-----------|---------------------|-------------|
| | | <n/N> | <n/N> | |

Task overlap with the base: <both, only fine-tune, only base, neither>.

## Spend

<Training, sampling, storage, GPU time.>

## Pending and not verified

- <Outward steps not taken (uploads, deployments), checks not run, and why>
