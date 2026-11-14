# Harness adapters

Maestro must spawn workers and re-enter their chats in whatever harness it runs in. This file is the adapter reference. Read it before the first spawn.

## Detection order

1. **Native agent tools in the session.** A create-agent tool plus a prompt-agent tool, or a subagent tool that returns a resumable id.
2. **A worker CLI on PATH.** Try in this order: `paseo`, `claude`, `codex`, `opencode`, `kilo`, `agent`, `cursor-agent`. Confirm with `--version` and `--help` before using a flag.
3. **Nothing.** Stop and report that Maestro needs a worker runtime. Do not do the work yourself.

Record the chosen adapter in `run.json` and in every worker record.

## Capability matrix

| Harness | Spawn | Reuse the same chat | Model selection | Resumable |
|---|---|---|---|---|
| Paseo MCP tools | `create_agent` | `send_agent_prompt` with the same `agentId` | Profiles, then `list_providers` and `list_models` | Yes |
| Paseo CLI | `paseo run --no-wait --json` | `paseo send <agentId>` | `--provider` and `--model` | Yes |
| Claude Code CLI | `claude -p --session-id <uuid>` | `claude -p --resume <uuid>` | `--model` | Yes |
| Claude Code native Task | Task or Agent tool | Only if the tool returns a resumable id | Subagent type or settings | Depends |
| Codex CLI | `codex exec --json` | `codex exec resume <session-id>` | `-m` | Yes |
| OpenCode | `opencode run --session <id>` | Same `--session <id>` | `--model provider/model` | Yes |
| Kilo | `kilo run --session <id>` | Same `--session <id>` | `-m provider/model` | Yes |
| Cursor CLI | `agent -p` | `agent --resume="<chat-id>"` | `--model` | Yes |
| Command Code | `agent` tool | `agent_output`; no resume in this session | `model` when offered | No |
| Antigravity, Cline, Kiro, Copilot, Muse | Native surface if it returns an id | Only with an id | Varies | Often no |
| Generic fallback | Worker CLI from the list | Per its adapter | Per its adapter | Yes |

## Paseo MCP tools

Paseo is the cleanest adapter because the chat is the agent.

Spawn:

```text
create_agent({
  title: "w2.1 Add the CSV serializer",
  provider: "<provider>/<model>",
  initialPrompt: "<the brief>",
  workspaceId: "<optional>",
  notifyOnFinish: true
})
```

It returns `agentId` and `workspaceId`. Record both.

Reuse:

```text
send_agent_prompt({ agentId: "<agentId>", prompt: "<review or fix>" })
```

Check progress with `get_agent_status` or `get_agent_activity`. Cancel a stalled turn with `cancel_agent`, and keep the agent for a follow-up. Do not detach or archive it.

Model selection:

1. Call `list_profiles` and read every profile's notes.
2. Pick the profile the user named, or the one whose notes best fit the task.
3. Materialize it into `provider` and `settings` for `create_agent`.
4. If no profile fits, use `list_providers` and `list_models`, and say that you fell back.

Paseo defaults `notifyOnFinish` to true for agent-scoped calls. Finish the turn and wait for the notification instead of polling.

## Paseo CLI

Spawn without waiting:

```bash
paseo run --no-wait --json --title "w2.1 Add the CSV serializer" --provider <provider> --model <model> "<brief>"
```

The JSON result contains the agent id. Record it.

Reuse:

```bash
paseo send <agentId> --prompt-file .maestro/tasks/w2.1/review-prompt.md
```

Discover ids with `paseo ls --json`. Use `--host` for a remote daemon, and `--workspace` or `--new-workspace worktree` for isolation.

## Claude Code CLI

Spawn with a session id you control:

```bash
claude -p --session-id 550e8400-e29b-41d4-a716-446655440000 --model sonnet --output-format json "<brief>"
```

`--session-id` must be a valid UUID. Alternatively, omit it and read `session_id` from the JSON output.

Reuse:

```bash
claude -p --resume 550e8400-e29b-41d4-a716-446655440000 --model sonnet "Review your work. <review prompt>"
```

Model aliases include `haiku`, `sonnet`, `opus`, and `fable`, or a full model name. Use `--worktree <name>` when the worker needs isolation. Use `--max-turns` and `--max-budget-usd` when the run needs a hard cap.

Native Claude Code subagents run through the Task or Agent tool. If the tool does not return an id you can prompt again, treat the chat as not resumable and use the CLI path for tasks that need a review loop.

## Codex CLI

Spawn:

```bash
codex exec --json -m <model> "<brief>"
```

The JSON event stream includes the session or thread id. Record it.

Reuse:

```bash
codex exec resume <session-id> "<review or fix>"
```

`codex exec resume --last` continues the most recent session in the current directory. Use `--cd` to set the workspace, `--sandbox workspace-write` for edits, and `--worktree` for isolation.

## OpenCode

Spawn:

```bash
opencode run --session <id> --title "w2.1 Add the CSV serializer" --model <provider>/<model> --format json "<brief>"
```

`--session` continues the session if it exists and creates it if it does not, so Maestro can choose the id. Record it.

Reuse:

```bash
opencode run --session <id> --model <provider>/<model> "<review or fix>"
```

Use `--agent <name>` when the project defines a worker agent. `--format json` makes the result machine-readable.

## Kilo

Kilo uses the same CLI shape as OpenCode.

Spawn:

```bash
kilo run --session <id> -m <provider>/<model> "<brief>"
```

Reuse:

```bash
kilo run --session <id> "<review or fix>"
```

`kilo session` manages sessions, and `kilo export <sessionID>` exports one. Use `--worktree <name>` for isolation.

## Cursor CLI

The current docs call the binary `agent`; older installs expose `cursor-agent`. Check `--version` first.

Spawn:

```bash
agent -p "<brief>" --model <model>
```

Record the chat id from `agent ls`. Use `--output-format json` when your version supports it.

Reuse:

```bash
agent --resume="<chat-id>" "<review or fix>"
```

`agent --continue` continues the previous session. `--mode=plan` or `--mode=ask` is useful for a read-only scout. Use `--sandbox enabled` when the project needs it.

## Command Code

In this session, use the `agent` tool to spawn a worker and `agent_output` to collect the result. The tool accepts a `subagent_type` and, when offered, a `model`.

There is no chat resume in this adapter. Record `resumable: false` and make the worker write its full output contract and diff to `.maestro/tasks/<id>/result.md` so a fresh reviewer can read it.

## Native host subagents

Claude Code, Cursor, Codex, OpenCode, Command Code, and some IDE hosts expose a task or subagent tool. Use it when:

- It returns an id that can be prompted again, or
- The task is fire-and-forget and the review can use the written result.

Do not assume resume. If the tool returns no id, record `resumable: false`.

## Antigravity, Cline, Kiro, Copilot, Muse

These hosts do not expose a standard resumable CLI session in every version. Two paths:

1. Use the host's own background or subagent surface if it returns a chat id.
2. Otherwise run a worker CLI from the list above and manage the session there.

If neither is available, Maestro stops and reports that the run needs a worker runtime. It does not do the work itself.

## Generic fallback

When the host is unknown, look for any CLI that can run a prompt non-interactively and resume a named session. Require both. A worker that cannot be re-entered cannot be reviewed in place, and Maestro must fall back to a written result plus a fresh reviewer.

Record the exact command and the help output version in `run.json`, so the adapter is reproducible.

## Session id capture

Record the id before the first prompt. Common ways:

- Paseo MCP: the `agentId` returned by `create_agent`.
- Paseo CLI: the id in `paseo run --json`.
- Claude Code: the UUID passed to `--session-id`, or `session_id` in the JSON output.
- Codex: the thread or session id in the `--json` events.
- OpenCode and Kilo: the value passed to `--session`.
- Cursor: the chat id from `--output-format json` or `agent ls`.

Write it to `workers.jsonl` immediately. A worker without a chat id is not reviewable.

## Model discovery

Discover the catalog before the first spawn, and refresh when `/maestro providers --refresh` is requested. Use the provider's own surface.

| Harness | Discover | Notes |
|---|---|---|
| Paseo MCP | `list_providers`, `list_models`, `list_profiles`, `inspect_provider` | Profiles carry the human's notes; prefer a matching profile |
| Paseo CLI | `paseo provider ls --json`, `paseo provider models <provider> --json`, `paseo provider diagnostic <provider> --json`, `paseo usage ls --json` | Usage reports quotas and balances |
| OpenCode | `opencode models` | The output lists the provider and model IDs |
| Kilo | `kilo models --verbose --refresh`, `kilo models <provider> --verbose` | `--verbose` includes costs |
| Codex | `codex debug models`, `codex debug models --bundled` | Use `--bundled` for the installed catalog |
| Claude Code | `--model` aliases and documented IDs | No standard list command in every version |
| Cursor | `agent --help` and the app model picker | Use user-declared IDs when the CLI does not enumerate |
| Cline | The extension settings | Use user-declared entries; route only if the Cline surface can launch it |
| Command Code | App settings or the `agent` tool model field | Use user-declared IDs otherwise |

Record the command, the timestamp, and the catalog source. Never invent a model ID or a context size. Use `unknown` when discovery does not provide it.

## Model selection

The exact ID comes from discovery or the user's declared catalog, not from this table.

| Harness | Flag or field |
|---|---|
| Paseo MCP | `provider`, `settings` from a profile |
| Paseo CLI | `--provider`, `--model` |
| Claude Code | `--model haiku`, `--model sonnet`, `--model opus`, or a full id |
| Codex | `-m <model>` |
| OpenCode | `--model provider/model` |
| Kilo | `-m provider/model` |
| Cursor | `--model <model>` |
| Command Code | `model` on the agent tool, when offered |

If the harness cannot select a model, record `default`. Do not pretend a tier was applied when it was not.

## Provider limits

- A `429` sets a cooldown and moves to the next candidate. Do not retry the same model before the cooldown.
- A quota or daily limit sets a longer cooldown, until the reset when the provider reports it.
- A free tier is a separate model entry, not an unlimited version of the paid model.
- Use `paseo usage ls --json` when the provider reports account quotas.
- Record `health`, `cooldownUntil`, and `lastError` in `~/.maestro/providers.json`.
- Never turn a rate limit into a preference. It is health, not a user choice.

## Waiting and completion

- Use the harness notification when it exists.
- Do not run a polling loop. One status check after a long silence is allowed.
- A worker that never reports is a failed worker. Cancel and reassign.
- A worker that reports `blocked` needs a decision, not a retry.

## Failure handling

| Failure | Action |
|---|---|
| Spawn fails | Check the command with `--help`, fix the flag, retry once |
| Auth missing | Stop and report; do not type credentials into a brief |
| Chat id missing | Record `resumable: false` and switch to written-result review |
| Worker stalls | One status prompt, then cancel and reassign |
| Worker fails twice | Reassign to a higher tier or another model family |
| Review finds a blocker | Send a numbered FIX to the same chat |
| Chat is gone | Reassign with the previous result and review files |

## Do not invent flags

Every CLI changes. Before a new adapter is used in a run, run `--version` and `--help`, and record the exact command in `decisions.jsonl`. If a flag in this file no longer exists, use the help output and update the run record, not the brief.
