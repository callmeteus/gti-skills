# Command semantics

Invoke every command through `scripts/artdirector.cmd` (Windows) or `scripts/artdirector` (Unix) next to this skill. Do not search npm or npx cache.

These names overlap Impeccable on purpose. Meanings here are graphic design, not app UI.

| Command | Agent does | CLI / server |
|---|---|---|
| `init` | Confirm name/brand | Writes a temporary session request, or `.artdirector/` with `--permanent` |
| `brief` | Fill only gaps | `brief --goal --audience --category --format` |
| `shape` | Offer 3 rendered directions | `shape --direction` |
| `craft` | Write one complete HTML piece, then stop | `variants add --id --file` |
| `generate` | Write 2-4 real HTML variants and hand them over | Agent HTML plus `variants add`; `generate --template <id> --tokens <json>` only for repeatable formats |
| `live` | Poll only after the user acts | `studio --open` |
| `critique` | Answer quality prompts when asked | Prints floor + prompts |
| `audit` | Run only after accept or an explicit ask; report, do not silently rewrite | Playwright inspection |
| `polish` | Last pass on **accepted** HTML, not the first draft | Live action |
| `bolder` / `quieter` / `typeset` / `colorize` / `layout` / `distill` | Edit the selected element or whole board | Live actions |
| `adapt` | Duplicate HTML at a new size | New variant |
| `export` | Do not fake files | PNG/JPEG via ClickClick when available, else Playwright; PDF/SVG via Playwright |
| `resume` | Read session, pending events | `resume --json` |
| `effects` | Look up the effects toolkit | `effects --json`, `effects --id <id> --json` |

## Session storage

State is isolated per chat and, inside a chat, per request. Default storage is temporary and lives outside the user's repository.

```text
<temp>/artdirector/
+-- sessions/<session-key>/
    +-- requests/<request-id>/
        +-- .artdirector/   project, brand, brief, session, variants, history, token
        +-- exports/        default export output
```

| Flag | Effect |
| --- | --- |
| `--session <id>` | Explicit chat identity. Defaults to `ARTDIRECTOR_SESSION`, then `OPENCODE_SESSION_ID`, `PASEO_AGENT_ID`, `CLAUDE_SESSION_ID`, `CURSOR_SESSION_ID`, `CODEX_SESSION_ID`, `TERM_SESSION_ID`, then a workspace-scoped fallback |
| `--request <id>` | Target a specific request inside the session |
| `--new` | On `init`, start a fresh request even if the chat already has an active one |
| `--permanent` | Store under `<workspace>/.artdirector` and keep using it for later commands in the chat |
| `--out <path>` | On `export`, resolve relative to the workspace instead of the temp exports folder |

Resolution order for `open`:

1. Explicit `--request`
2. Explicit `--permanent`
3. The session's permanent preference
4. The session's active request
5. Repository discovery (`.artdirector/` in the workspace)
6. `PROJECT` error

Read `workspace`, `root`, `stateDir`, `variantsDir`, and `exportsDir` from `scope` in any `--json` output instead of assuming a path.

## Registering agent HTML

Write the file anywhere inside the absolute `scope.variantsDir`, then register it:

```powershell
& "<skill-dir>\scripts\artdirector.cmd" variants add --id "<id>" --file "<absolute html path>" --json
```

`variants add` registers the file where it is and updates the catalog. Images the HTML references from outside its folder (absolute paths or `file://` URLs) are copied into an `assets/` folder next to it and the paths are rewritten, so the studio and the exporter can load them. Use it instead of hand-editing `.artdirector` metadata or dropping files into the repository.

## Studio reuse

`studio` reuses the request's healthy lock at `.artdirector/studio.json`. If that port is taken by another process, it tries the next free port (20 attempts), then lets the OS assign one. Two chats started at the same time get separate studios and separate ports.
