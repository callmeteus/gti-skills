# Preferences

Preferences are the user's durable choices about which models to use and how to route work. They are not run state, and they are not model health. They live outside the run so the next run starts with the same choices.

## Scopes

| Scope | Path | Use |
|---|---|---|
| User | `~/.maestro/preferences.json` | Every project on this machine |
| Project | `.maestro/preferences.json` | This project, overrides user |

If `MAESTRO_HOME` is set, use `$MAESTRO_HOME/preferences.json` for the user scope. Create the folder when writing.

Precedence, highest first:

1. An explicit instruction in the current request.
2. Project preferences.
3. User preferences.
4. The router default from [03-router.md](03-router.md).

An explicit instruction is run-scoped unless the user says "always", "from now on", or "default", in the user's language.

## Schema

```json
{
  "version": 1,
  "updated": "2026-11-14T15:00:00Z",
  "roles": {
    "orchestrator": {"provider": "claude", "model": "claude-opus-5.5", "note": "user preference"},
    "executor": {"provider": "opencode", "model": "deepseek-v4.1-flash", "note": "user preference"}
  },
  "fallbacks": [
    {"when": "rate_limit", "provider": "opencode", "model": "deepseek-v4.1-flash-free", "note": "same family, free tier"}
  ],
  "routes": [
    {"when": {"taskType": "scout", "latency": "high"}, "provider": "opencode", "model": "deepseek-v4.1-flash-free"},
    {"when": {"context": ">128000"}, "provider": "claude", "model": "claude-opus-5.5"}
  ],
  "avoid": [
    {"provider": "some-provider", "model": "some-model", "note": "user preference"}
  ]
}
```

| Field | Meaning |
|---|---|
| `roles.orchestrator` | Preferred model for planning and review agents |
| `roles.executor` | Preferred default worker model |
| `fallbacks` | Ordered replacements when a condition matches, for example `rate_limit` |
| `routes` | Rules that map a task profile to a model |
| `avoid` | Models the user does not want, with an optional reason |

Model IDs are the provider's real IDs, not marketing names. Store the alias in `note` when the user uses a display name.

The sample names above are illustrative. Replace them with the IDs returned by discovery in [02-catalog.md](02-catalog.md). Never assume a model exists because it appears in an example.

## Learning from the user

Persist a preference when the user says any of these, in the user's language:

| Signal | Example | Write |
|---|---|---|
| Role | "prefer Opus 5.5 as orchestrator" | `roles.orchestrator` |
| Role | "use DeepSeek Flash as executor" | `roles.executor` |
| Always | "always use X for tasks" | `roles.executor` or a route |
| Fallback | "when the limit runs out, use the free model" | `fallbacks` |
| Route | "for quick tasks use the smaller model" | `routes` |
| Route | "use the large-context model for the whole repository" | `routes` |
| Avoid | "do not use model X" | `avoid` |

When the user switches the model manually and says "keep this", "use this from now on", or "this is the new default", persist it.

Do not persist:

- "use X for this task" with no "always" or "from now on". That is run-scoped.
- A single success or a single failure. That is a health signal, not a preference.
- A rate limit. That goes to `providers.json` as a cooldown, not to preferences.
- A guess about a model's quality. Ask, or record `unknown`.

## Suggestions from repeated use

Maestro can notice a pattern without writing it:

- If the same model is chosen for the same task type three times and passes review, say once: "You have used X for scouts three times. Make it the route?"
- If the user keeps switching away from a model, say once: "You switched away from X twice. Add it to the avoid list?"
- Do not write the change until the user confirms, or until they state a durable preference.

Stats live in the catalog and the audit log. They are not preferences.

## Orchestrator honesty

The model that runs Maestro is chosen by the harness, not by this skill. The `roles.orchestrator` preference is recorded and used for spawned planner, reviewer, and second-opinion agents. It cannot change the model Maestro is currently running on.

At intake, compare the current model with the preference when the harness exposes it. If they differ, say so once and give the relaunch command for the harness, for example `claude --model <model>` or `paseo run --provider <provider>/<model>`. Do not claim to have switched the main model.

## Commands

| Command | Action |
|---|---|
| `/maestro preferences` | Show the effective roles, fallbacks, routes, and avoid list, with sources |
| `/maestro preferences set orchestrator <provider>/<model>` | Write `roles.orchestrator` |
| `/maestro preferences set executor <provider>/<model>` | Write `roles.executor` |
| `/maestro preferences set fallback <when> <provider>/<model>` | Add or replace a fallback |
| `/maestro preferences set route <when> <provider>/<model>` | Add or replace a route rule |
| `/maestro preferences avoid <provider>/<model>` | Add an avoid entry |
| `/maestro preferences forget <key>` | Remove one entry |
| `/maestro preferences --project` | Write to the project scope instead of the user scope |

`<when>` is a short condition the router understands, for example `rate_limit`, `context>128000`, `task=scout`, or `latency=high`.

## Writing rules

- Write atomically: write a temporary file and rename it over the target.
- Preserve fields you do not understand.
- Bump `updated`.
- Keep a short `note` with the user's words when useful.
- Never store API keys, tokens, or account credentials. Store provider and model IDs only.
- Report the exact change at the end of the run.

## Debugging

If a preference is not applied:

1. Run `/maestro preferences` and check the source and scope.
2. Check the model ID against `/maestro providers`. A marketing name is not an ID.
3. Check the precedence. A project preference overrides a user preference.
4. Check health. A cooling or unavailable model is skipped even when it is preferred.
5. Check the adapter. A provider that cannot be launched from this harness is not routable here.

If the model is not in the catalog, add it with `source: user` and `quality`, `speed`, and `context` set to `unknown` until discovery or the user fills them.
