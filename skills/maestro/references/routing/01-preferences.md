# Preferences

Preferences are the user's durable choices about which models to use, how to route work, and how to set up a run. They are not run state, and they are not model health. They live in the GTI home (`~/.gti`, or `GTI_HOME`), outside the run and outside the repository, so the next run starts with the same choices.

The file holds three layers of run configuration:

- **Defaults:** the settings every run starts from (roles, harness, adapter, budget, tier, verifier).
- **Profiles:** settings for one kind of run that Maestro detects, for example `security`, `frontend`, or `tests`. A profile overrides the defaults for that kind only.
- **Routing:** `fallbacks`, `routes`, and `avoid`, which apply to every task.

## Scopes

| Scope | Path | Use |
|---|---|---|
| User | `~/.gti/maestro/preferences.json` | Every project on this machine |
| Project | `~/.gti/maestro/<project>/preferences.json` | This project, overrides user |

If `MAESTRO_HOME` is set, use `$MAESTRO_HOME/preferences.json` for the user scope. Create the folder when writing.

Precedence, highest first, field by field:

1. An explicit instruction in the current request.
2. The project profile for the detected run kind.
3. The user profile for the detected run kind.
4. Project `defaults` and `roles`.
5. User `defaults` and `roles`.
6. The router default from [03-router.md](03-router.md).

A profile sets only the fields it names; every other field falls through to the next layer. An explicit instruction always wins for this run, and is also remembered for its run kind (see [Learning from the user](#learning-from-the-user)).

## Schema

```json
{
  "version": 2,
  "updated": "2026-11-14T15:00:00Z",
  "roles": {
    "orchestrator": {"provider": "claude", "model": "claude-opus-5.5", "note": "user preference"},
    "executor": {"provider": "opencode", "model": "deepseek-v4.1-flash", "note": "user preference"}
  },
  "defaults": {
    "adapter": "paseo-mcp",
    "budget": {"workers": 12, "fixRounds": 2, "waves": 6},
    "tier": "T2",
    "verifier": true,
    "source": "repeated",
    "note": "asked for the Paseo adapter in 3 runs in a row"
  },
  "profiles": {
    "security": {
      "match": ["security", "segurança", "audit", "vulnerability", "pentest", "security-audit"],
      "executor": {"provider": "codex", "model": "gpt-5.5", "note": "asked in run-2026-11-14-002"},
      "orchestrator": {"provider": "claude", "model": "claude-opus-5.5"},
      "adapter": "codex-cli",
      "tier": "T3",
      "skills": ["security-audit"],
      "source": "run",
      "lastRun": "run-2026-11-14-002",
      "uses": 1
    }
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
| `defaults` | Run settings every run starts from: `adapter`, `budget`, `tier`, `verifier`, `autonomous`, `skills` |
| `profiles.<kind>` | Settings for one run kind: `match`, `orchestrator`, `executor`, `adapter`, `budget`, `tier`, `verifier`, `autonomous`, `skills`, `routes`, `fallbacks` |
| `profiles.<kind>.match` | Words and skill IDs that select this profile, in any language |
| `source` | `user` (stated as durable), `run` (remembered from a run of this kind), or `repeated` (promoted after repeated requests) |
| `fallbacks` | Ordered replacements when a condition matches, for example `rate_limit` |
| `routes` | Rules that map a task profile to a model |
| `avoid` | Models the user does not want, with an optional reason |

Model IDs are the provider's real IDs, not marketing names. Store the alias in `note` when the user uses a display name.

The sample names above are illustrative. Replace them with the IDs returned by discovery in [02-catalog.md](02-catalog.md). Never assume a model exists because it appears in an example.

A version 1 file has no `defaults` or `profiles`. Read it as is and add the new keys on the next write.

`provider` is the harness surface that launches the model (`claude`, `codex`, `opencode`, `cline`, and so on), so "model XY in harness Z" is `{"provider": "Z", "model": "XY"}`. `adapter` is how Maestro spawns the worker chat, from [../harness/adapters.md](../harness/adapters.md), for example `paseo-mcp`, `paseo-cli`, `paseo-api`, `claude-cli`, or `opencode-cli`. When several runtimes are usable and none is saved, Maestro asks the user once and writes the answer to `defaults.adapter` with `source: user`.

## Run kinds

At intake, detect the kind of run before resolving anything else. Check, in order:

1. A kind the user names ("security run", "uma run de segurança").
2. The `match` list of every stored profile, user and project. Match words in any language and skill IDs the request invokes.
3. The built-in kinds below.

| Kind | Typical signals |
|---|---|
| `security` | security, audit, vulnerability, CVE, pentest, `security-audit` |
| `frontend` | UI, page, screen, component, CSS, design, `frontend-design-review`, `unslop-interface` |
| `backend` | API, route, service, database, migration, worker |
| `tests` | tests, coverage, flaky, mutation, `better-tests` |
| `refactor` | refactor, architecture, split, untangle, `improve-codebase-architecture` |
| `bugfix` | bug, fix, error, crash, regression |
| `infra` | deploy config, CI, Docker, Terraform, Kubernetes, `infra-expert`, `fast-ci` |
| `docs` | README, docs, guide, ADR |
| `research` | research, compare, investigate, read-only question |

Pick one kind. When two match, take the one the user named, then the more specific profile (more `match` hits), then `feature` as the fallback kind. Record the kind and the reason in `decisions.jsonl` and show it in the run header.

## Learning from the user

### Per-run settings

When the user sets anything for a run (a model, a harness, an adapter, a budget, a tier, a skill to load, autonomous mode), Maestro uses it for this run and remembers it for the run's kind:

- Write the stated fields to `profiles.<kind>` with `source: run`, `lastRun`, and the user's words in `note`. Leave the other fields of the profile alone.
- Write to the user scope unless the user said "only in this project", or the setting names something that exists only in this project.
- The next run of that kind starts from the profile. Say so once in the run header, for example `profile security (codex/gpt-5.5, saved from run-2026-11-14-002)`, so the user can change it.
- If the user says the setting is for this run only ("só desta vez", "just this once"), do not write it.
- A field with `source: user` is never overwritten by a `run` value. Ask, or keep the user value and note the difference in the report.

### Repeated requests

Maestro also keeps a short history of the effective settings of each run in `~/.gti/maestro/history.jsonl` (one line per run: date, project, kind, and the fields the user set explicitly). At finish, read the last runs:

- If the user set the same value for the same field in the last 3 runs of a kind, write it to that profile with `source: repeated`.
- If the user set the same value in the last 3 runs of any kind, write it to `defaults` with `source: repeated`.
- Report each promotion in the final report with the old and new value, and how to undo it (`/maestro preferences forget <key>`).

Keep only the last 50 lines of `history.jsonl`.

### Durable model choices

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

Durable choices like these go to `roles`, `fallbacks`, `routes`, or `avoid` with `source: user`. A choice stated for one run without "always" or "from now on" goes to that run's profile instead, as described in [Per-run settings](#per-run-settings).

Do not persist:

- A setting the user marked as this run only.
- A choice Maestro made on its own. Only what the user stated is remembered.
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
| `/maestro preferences default <field> <value>` | Write one field of `defaults`, for example `adapter paseo-mcp` or `budget.workers 6` |
| `/maestro preferences profile <kind>` | Show one profile with the source of each field |
| `/maestro preferences profile <kind> <field> <value>` | Write one field of a profile, for example `security executor codex/gpt-5.5` |
| `/maestro preferences profile <kind> match <word>` | Add a word or skill ID that selects the profile |
| `/maestro preferences forget <key>` | Remove one entry, for example `profiles.security.executor` or `defaults.adapter` |
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

1. Run `/maestro preferences` and check the source and scope. Check which run kind was detected (`decisions.jsonl`) and whether that profile overrides the field.
2. Check the model ID against `/maestro providers`. A marketing name is not an ID.
3. Check the precedence. A project preference overrides a user preference.
4. Check health. A cooling or unavailable model is skipped even when it is preferred.
5. Check the adapter. A provider that cannot be launched from this harness is not routable here.

If the model is not in the catalog, add it with `source: user` and `quality`, `speed`, and `context` set to `unknown` until discovery or the user fills them.
