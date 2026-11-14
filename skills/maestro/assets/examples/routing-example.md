# Worked example: routing with preferences

This example uses the user's choices: a strong orchestrator and a cheap executor, with several providers available.

## Preferences

```json
{
  "roles": {
    "orchestrator": {"provider": "claude", "model": "claude-opus-5.5"},
    "executor": {"provider": "opencode", "model": "deepseek-v4.1-flash"}
  },
  "fallbacks": [
    {"when": "rate_limit", "provider": "opencode", "model": "deepseek-v4.1-flash-free"}
  ]
}
```

The names are illustrative. In a real run, Maestro replaces them with the IDs from discovery.

## Catalog

```text
opencode/deepseek-v4.1-flash       128k, medium quality, fast, low cost, healthy
opencode/deepseek-v4.1-flash-free  128k, medium quality, fast, free, healthy
cline/beam-1.0                     unknown context and speed, declared, host-only
claude/claude-opus-5.5             1M, frontier quality, slow, high cost, healthy
```

`cline/beam-1.0` is routable only if the current harness can launch the Cline surface. Otherwise it stays in the catalog as `unavailable` with a note.

## Task 1: small build, fast executor

```text
Task     w2.2 rename three call sites
Profile  build, low difficulty, latency high, cost sensitivity high
Weights  quality 40, speed 15, cost 20, context 15, tools 10
Score    opencode/deepseek-v4.1-flash      0.84
         opencode/deepseek-v4.1-flash-free 0.86
         claude/claude-opus-5.5            0.61
Chosen   opencode/deepseek-v4.1-flash-free
Reason   free tier, fast, capability fits a low-difficulty edit
```

Maestro spawns in the free model's chat and records the choice. It does not write a new preference; the executor role stays the paid model, which is the default for harder tasks.

## Task 2: rate limit fallback

```text
Task     w2.1 build, default executor
Attempt 1  opencode/deepseek-v4.1-flash -> 429, Retry-After 90
Health     deepseek-v4.1-flash cooling until 15:12
Fallback 1 opencode/deepseek-v4.1-flash-free
Attempt 2  running in the free model's chat
```

The fallback is recorded in `attempts` and `audit.jsonl`. The preference is unchanged. The worker chat id is the free model's chat, so the review returns there.

## Task 3: context beats speed

```text
Task     w1.1 map the repository, context need 180k
Profile  scout, context large, latency low
Filter   opencode models at 128k -> excluded
Chosen   claude/claude-opus-5.5
Reason   context is a hard requirement; speed is not
```

The orchestrator-class model is used for a read-only scout because it is the only candidate with enough context. That is a routing decision, not a role violation.

## Task 4: user changes a preference

User: "from now on, use the free model as executor."

```text
Write  ~/.maestro/preferences.json
       roles.executor = opencode/deepseek-v4.1-flash-free
Note   "from now on, use the free model as executor"
Report "Executor preference updated. Next runs start on the free model."
```

Do not write that preference from a single successful run. Only an explicit "from now on" does that.

## What Maestro does not do

- It does not claim to have switched its own main model. The harness owns it.
- It does not retry a rate-limited model before the cooldown.
- It does not invent a model ID, a context size, or a price.
- It does not use a frontier model for a rename because it "feels safer".
- It does not treat a free tier as unlimited.
