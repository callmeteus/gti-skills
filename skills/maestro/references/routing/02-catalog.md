# Model catalog

The catalog is a cache of the providers and models this machine can run, with the capabilities, limits, and health the router needs. Discovery is the source of truth; the catalog is what lets Maestro compare models without calling every provider on every task.

## Storage

| Scope | Path | Use |
|---|---|---|
| User | `~/.maestro/providers.json` | Models and limits that apply to this machine |
| Project | `.maestro/providers.json` | Project-specific overrides and user-declared entries |

If `MAESTRO_HOME` is set, use `$MAESTRO_HOME/providers.json` for the user scope.

The catalog is machine-specific. Do not commit it. Keep it out of git with the run directory.

## Schema

```json
{
  "version": 1,
  "updated": "2026-11-14T15:00:00Z",
  "providers": {
    "opencode": {
      "surface": "opencode-cli",
      "healthy": true,
      "models": [
        {
          "id": "deepseek-v4.1-flash-free",
          "aliases": ["DeepSeek v4.1 Flash Free"],
          "context": 128000,
          "quality": "medium",
          "speed": "fast",
          "cost": "free",
          "tools": true,
          "reasoning": false,
          "limits": {"rpm": 20, "rpd": null, "tpm": null},
          "health": "healthy",
          "cooldownUntil": null,
          "source": "user",
          "lastChecked": "2026-11-14T15:00:00Z"
        }
      ]
    }
  }
}
```

| Field | Values |
|---|---|
| `context` | Token count, or `unknown` |
| `quality` | `low`, `medium`, `high`, `frontier`, or `unknown` |
| `speed` | `slow`, `medium`, `fast`, or `unknown` |
| `cost` | `free`, `low`, `medium`, `high`, or `unknown` |
| `tools` | `true`, `false`, or `unknown` |
| `reasoning` | `true`, `false`, or `unknown` |
| `vision` | `true`, `false`, or `unknown` |
| `limits` | `rpm`, `rpd`, `tpm`, or `null` |
| `health` | `healthy`, `cooling`, `unavailable`, or `unknown` |
| `cooldownUntil` | ISO timestamp or `null` |
| `source` | `discovered`, `user`, or `docs` |
| `lastError` | Short string or `null` |

Never invent a value. If discovery does not provide it and the user did not declare it, use `unknown` and let the router treat it as a weak signal.

## Normalization

- Key a model as `<provider>/<model-id>`.
- Keep the provider's real ID in `id`, and the display name in `aliases`.
- Map a user's marketing name to the real ID before writing a preference.
- One model can appear under several aliases; the router uses the canonical key.

Example: the user says "DeepSeek v4.1 Flash Free". The catalog maps it to `opencode/deepseek-v4.1-flash-free`. If the real ID differs, use the real one and keep the alias.

## Discovery

Run discovery at intake and when `/maestro providers --refresh` is requested. Use the provider's own surface. Record the command and the timestamp in the catalog.

### Paseo

MCP tools:

```text
list_providers
list_models({ provider })
list_profiles
inspect_provider({ provider })
```

CLI:

```bash
paseo provider ls --json
paseo provider models <provider> --json
paseo provider diagnostic <provider> --json
paseo usage ls --json
```

`paseo usage ls` reports account quotas and balances, which are useful for free tiers and daily limits. Use the profile notes before choosing a model, as described in [../harness/adapters.md](../harness/adapters.md).

### OpenCode

```bash
opencode models
```

If the output does not include context, cost, or limits, record those fields as `unknown` unless the user declared them.

### Kilo

```bash
kilo models --verbose --refresh
kilo models <provider> --verbose
```

`--verbose` includes metadata such as costs. Use `--refresh` when the cache looks stale.

### Codex

```bash
codex debug models
codex debug models --bundled
```

Use `--bundled` when you want the catalog bundled with the installed binary without a refresh.

### Claude Code

There is no documented model-list command in every version. `--model` accepts aliases such as `haiku`, `sonnet`, `opus`, and `fable`, or a full model ID. Record the aliases the installed version documents, and use user-declared entries for anything else.

### Cursor

The model list lives in the app and the CLI model flag. Check `agent --help` for the installed version, and use user-declared entries when the CLI does not enumerate models.

### Cline

Cline configures models in its own extension settings. There is no standard model-list command across versions. Declare the model in the catalog with `source: user`, and route to it only when the host or a worker surface can actually launch it.

### Command Code

Use the model list in the app settings, or the `model` field of the agent tool when it is offered. Declare anything else with `source: user`.

### Generic fallback

If the harness cannot enumerate models, ask the user for the provider and model IDs, or read the provider's documented IDs. Do not guess. Mark the entry `source: user` or `source: docs`.

## Free and paid variants

Free tiers usually have lower limits and may be slower. Record them as separate models, not as one model with a note. The router can then prefer the free variant for cheap, low-difficulty work and keep the paid variant for harder work or as a fallback.

## Health and cooldowns

Health is not a preference. It is runtime state.

- `healthy`: a recent call succeeded, or no failure is known.
- `cooling`: the provider returned a rate limit or quota error. Set `cooldownUntil`.
- `unavailable`: auth, permission, or provider installation failed. Do not retry in this run.
- `unknown`: no recent evidence.

When a call fails, update the model's `health`, `cooldownUntil`, and `lastError`, and append the attempt to `audit.jsonl`. Do not write a preference from a failure.

Cooldown defaults when the provider gives no reset time:

| Error | Default |
|---|---|
| `429` with `Retry-After` | Use the header |
| `429` without a header | 2 minutes |
| Quota exhausted | 15 minutes, or the next reset if known |
| Daily limit | 1 hour, or the next reset if known |
| Auth or permission | No cooldown; mark `unavailable` for the run |
| Timeout or `5xx` | No cooldown; one retry, then the next candidate |

## Refresh rules

- Refresh at intake when the catalog is older than one day.
- Refresh after a `model_not_found` or a provider update.
- Keep discovered fields when the user has not declared an override.
- Keep user-declared fields when discovery does not provide them.
- Record `lastChecked` on every refresh.

## Example

[../../assets/templates/model-catalog.json](../../assets/templates/model-catalog.json) is a valid sample. Its model names are illustrative; replace them with discovered or user-declared IDs.
