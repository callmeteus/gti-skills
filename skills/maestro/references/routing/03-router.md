# Router

The router turns a task profile and the model catalog into one choice, with a reason and a fallback order. It is deterministic enough to audit and cheap enough to run before every spawn.

## Inputs

### Task profile

| Signal | Values | Where it comes from |
|---|---|---|
| `taskType` | `scout`, `build`, `verify`, `synthesize`, `review` | The plan |
| `difficulty` | `low`, `medium`, `high` | The plan and the scout report |
| `contextNeed` | Token estimate, or `small`, `medium`, `large` | The brief's files and the scout report |
| `latencyNeed` | `low`, `medium`, `high` | The wave and the user's request |
| `costSensitivity` | `low`, `medium`, `high` | The budget and the user's preference |
| `tools` | `required`, `optional`, `none` | The task |
| `reasoning` | `required`, `optional`, `none` | The task |
| `risk` | `low`, `medium`, `high` | Intake |

### Model profile

Read from the catalog: `quality`, `speed`, `context`, `cost`, `tools`, `reasoning`, `health`, `cooldownUntil`, `source`.

### Preferences

Read from [01-preferences.md](01-preferences.md): roles, fallbacks, routes, avoid. An explicit run instruction beats every stored preference.

## Hard filters

Filter before scoring. A model that fails a hard filter is not a candidate, even if it is the user's favorite.

| Filter | Rule |
|---|---|
| Health | Drop `unavailable` and `cooling` models |
| Context | Drop models whose context is known and smaller than `contextNeed` |
| Tools | Drop models with `tools: false` when tools are required |
| Reasoning | Drop models with `reasoning: false` when reasoning is required |
| Avoid | Drop every model on the avoid list |
| Provider surface | Drop providers the current harness cannot launch |
| Auth | Drop providers that failed authentication in this run |

When a field is `unknown`, keep the model as a weak candidate and mark the uncertainty in the reason.

## Weights

Score each remaining candidate from 0 to 1. Start from the weights for the task type, then adjust for preferences and health.

| Task type | Quality | Speed | Cost | Context | Tools or reasoning |
|---|---:|---:|---:|---:|---:|
| `scout` | 10% | 40% | 30% | 20% | 0% |
| `build` | 40% | 15% | 20% | 15% | 10% |
| `verify` | 45% | 10% | 10% | 25% | 10% |
| `synthesize` | 30% | 15% | 20% | 35% | 0% |
| `review` | 50% | 10% | 10% | 20% | 10% |

Adjustments:

- `roles.executor` match: `+0.20` for a build or synthesize task.
- A matching `routes` entry: `+0.25`.
- A different model family from the worker, for a review: `+0.15`.
- `quality: frontier` on a low-difficulty task: `-0.10` (do not burn the best model on a rename).
- `source: user` with unknown capabilities: `-0.05` (prefer a known model unless the user explicitly chose it).

Tie-breakers, in order:

1. The user's explicit choice.
2. A healthy free variant over a paid variant at equal capability.
3. Lower cost.
4. Higher context headroom.
5. The model that succeeded most recently for the same task type.

Record the weights, the candidates, and the reason in `run.json` under `routing`.

## Fallback policy

Build an ordered candidate list before spawning, not after a failure:

1. The explicit run instruction.
2. A matching route.
3. The executor role, when the task is a build or synthesize task.
4. The router score order.
5. The stored fallbacks for the error that occurred.

When a candidate fails, classify the error and act:

| Error | Action |
|---|---|
| `rate_limit` (`429`) | Set a cooldown, try the next candidate immediately |
| `quota_exhausted` | Set a cooldown until the reset if known, else 15 minutes, try the next candidate |
| `auth` (`401`, `403`) | Mark the provider `unavailable` for the run, try the next candidate |
| `model_not_found` (`404`) | Refresh the catalog, mark the model `unknown`, try the next candidate |
| `context_overflow` | Drop this model, choose one with more context, or split the task |
| `tool_unsupported` | Drop this model, choose one with tools |
| `timeout` or `5xx` | One retry on the same model, then the next candidate |
| `content_filter` | Try a different model family, then escalate |

Do not retry the same model on a rate limit before the cooldown expires. Do not send the same prompt unchanged to a different model and call it a fallback: adapt the brief only when the new model's context or tool support requires it.

If every candidate is cooling or unavailable:

- If the earliest cooldown is within the wait budget and the harness has a sleep tool, wait and retry.
- Otherwise stop the task and report the blocked provider, the cooldown, and the candidates that were tried.
- Never do the task yourself as a fallback.

## Worked examples

### 1. Rate limit

```text
Task     w2.1 build, executor preference opencode/deepseek-v4.1-flash
Attempt 1  opencode/deepseek-v4.1-flash -> 429, Retry-After: 90
Health     deepseek-v4.1-flash cooling until 15:12
Fallback 1 opencode/deepseek-v4.1-flash-free, same family, free, healthy
Reason     same capability, no wait, lower cost
```

Record `attempts` in the worker record and `health` in the catalog. Do not write a preference.

### 2. Context beats speed

```text
Task     w1.1 scout, repository-wide map, contextNeed 180000
Candidate fast-flash          context 32000   -> filtered
Candidate long-context        context 1000000 -> chosen
Reason   context is a hard requirement; speed is not
```

If the long-context model is slow, that is acceptable for a scout that runs once. Do not use it for a small rename.

### 3. Speed beats quality

```text
Task     w2.2 build, rename three call sites, difficulty low, latencyNeed high
Candidate frontier            quality frontier, speed slow, cost high   -> 0.58
Candidate small-fast          quality medium, speed fast, cost low      -> 0.86
Chosen   small-fast
Reason   low difficulty and high latency need; the frontier model adds no value
```

The review still checks the result. If the small model fails twice, reassign to a higher tier.

## Orchestrator versus executor

- The `orchestrator` role is for planning, review, and second-opinion agents. The running Maestro model is owned by the harness.
- The `executor` role is the default worker model. It is a starting point, not a mandate. The router can override it for context, speed, cost, or health, and must record why.
- A task can use a different model from the executor role when the task profile says so. That is normal, not a violation.

## Narration

Say each non-obvious routing decision in one short line, in the user's language, then record it. Do not narrate the obvious ones.

Examples:

- "The `opencode/deepseek-v4.1-flash` limit is done (429, 90s). Switching to `...-free`."
- "This task needs 180k context; flash has 128k, so I am using `claude/...`."
- "This task is small and fast; the smaller model handles it and costs less."
- "The preferred model is cooling; I used the next candidate and recorded why."

One line, not a paragraph. Include the provider/model and the reason.

## Recording

For every spawn, write:

```json
{
  "routing": {
    "chosen": "opencode/deepseek-v4.1-flash",
    "reason": "executor role, healthy, quality fits a low-difficulty build",
    "candidates": ["opencode/deepseek-v4.1-flash", "opencode/deepseek-v4.1-flash-free"],
    "weights": {"quality": 0.4, "speed": 0.15, "cost": 0.2, "context": 0.15, "tools": 0.1}
  },
  "attempts": [
    {"provider": "opencode", "model": "deepseek-v4.1-flash", "result": "rate_limit", "cooldownUntil": "2026-11-14T15:12:00Z"},
    {"provider": "opencode", "model": "deepseek-v4.1-flash-free", "result": "running"}
  ]
}
```

Append the same events to `audit.jsonl`. The reason is mandatory. A routing decision without a reason is not auditable.

## Stop conditions

- No candidate passes the hard filters. Stop and report which filter excluded every model.
- Every candidate is cooling or unavailable. Stop and report the cooldowns.
- The budget cannot cover the cheapest viable candidate. Stop and report the cost gap.
- The user's preferred model is not routable in this harness. Tell the user once, then use the best available candidate and record the mismatch.

## Avoid

- Routing by vibes: "this one feels better".
- Hardcoded model IDs in the skill or in a brief. Read the catalog.
- Retrying a rate limit on the same model.
- Treating a free tier as unlimited.
- Using a frontier model for routine work when a cheaper model passes the review.
- Pretending the main Maestro model changed when the harness owns it.
- Silently switching models mid-task without recording the attempt.
