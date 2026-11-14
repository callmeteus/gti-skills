# Harness adapters

Maestro must spawn workers and re-enter their chats in whatever harness it runs in. This file is the adapter reference. Read it before the first spawn.

## Detection order

1. **Native agent tools in the session.** A create-agent tool plus a prompt-agent tool, or a subagent tool that returns a resumable id.
2. **A worker CLI on PATH.** Try in this order: `paseo`, `claude`, `codex`, `opencode`, `kilo`, `cline`, `command-code`, `pi`, `agent`, `cursor-agent`, `hermes`, `agy`, `muse`. Confirm with `--version` and `--help` before using a flag.
3. **Nothing.** Stop and report that Maestro needs a worker runtime. Do not do the work yourself.

If Paseo is installed, prefer it for any provider it lists. It is the shortest path to Claude, Codex, OpenCode, Pi, Cline, Cursor, Kilo, Hermes, Antigravity, Muse, and the ACP catalog.

Record the chosen adapter in `run.json` and in every worker record.

## Capability matrix

| Harness | Spawn | Reuse the same chat | Model selection | Resumable |
|---|---|---|---|---|
| Paseo MCP tools | `create_agent` | `send_agent_prompt` with the same `agentId` | Profiles, then `list_providers` and `list_models` | Yes |
| Paseo CLI | `paseo run --no-wait --json` | `paseo send <agentId>` | `--provider` and `--model` | Yes |
| Claude / Claude Code | `claude -p --session-id <uuid>` | `claude -p --resume <uuid>` | `--model` | Yes |
| Claude Code native Task | Task or Agent tool | Only if the tool returns a resumable id | Subagent type or settings | Depends |
| Codex | `codex exec --json` | `codex exec resume <session-id>` | `-m` | Yes |
| OpenCode | `opencode run --session <id>` | Same `--session <id>` | `--model provider/model` | Yes |
| Kilo | `kilo run --session <id>` | Same `--session <id>` | `-m provider/model` | Yes |
| Cline | `cline "<brief>" --json --auto-approve true` | `cline --id <session-id> "<review>"` | `-P` and `-m` | Yes |
| Command Code | `command-code -p -n <worker> --output-format json` | `command-code -p -r <worker>` or `--session <id>` | `-m`, `--list-models` | Yes |
| Pi | `pi --print --session-id <id> --model <model>` | `pi --print --session <id>` | `--provider`, `--model`, `--list-models` | Yes |
| Hermes | Paseo `create_agent({provider: "hermes"})` | `send_agent_prompt` | Paseo `list_models` | Yes via Paseo or ACP |
| Cursor | `agent -p` | `agent --resume="<chat-id>"` | `--model` | Yes |
| Antigravity | Paseo `create_agent({provider: "antigravity"})` | `send_agent_prompt` | Paseo `list_models` | Yes via Paseo |
| Muse Code | Paseo `create_agent({provider: "muse"})` | `send_agent_prompt` | Paseo `list_models` | Yes via Paseo |
| Any ACP provider | Paseo ACP catalog | `send_agent_prompt` | Paseo `list_models` | Yes via Paseo |
| Generic fallback | Worker CLI from the list | Per its adapter | Per its adapter | Depends |

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

## Paseo as the universal adapter

When Paseo is available, it can launch the provider directly, and Maestro does not need a separate CLI adapter for each tool. Paseo has native providers for Claude, Codex, OpenCode, Pi, Antigravity, and Muse Code, and an ACP catalog that includes Cline, Cursor, Kilo, Hermes, Gemini CLI, GitHub Copilot, Goose, Amp, Auggie, Qwen, Kimi, Junie, and others.

Use it this way:

1. `list_providers` to get the exact provider id and availability.
2. `list_models({provider})` to get the model ids and capabilities.
3. `create_agent({title, provider: "<id>", initialPrompt, notifyOnFinish: true})`.
4. `send_agent_prompt({agentId, prompt})` for the review and every fix.
5. `get_agent_activity` or `get_agent_status` for progress, and `cancel_agent` for a stall.

Do not hardcode provider ids or assume a provider is installed. If `list_providers` does not show it, install its CLI on the daemon host or use a direct adapter. Paseo is also the recommended path for Hermes, Cline, Cursor, Kilo, Antigravity, and Muse when Maestro runs outside those tools.

## Claude and Claude Code

Claude is the provider; Claude Code is the CLI. The same adapter covers both, and Paseo's provider id is `claude`.

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

## Cline

The Cline CLI is the `cline` binary. It runs a prompt in act mode and auto-approves tools by default, so treat it as a privileged worker and prefer a worktree.

Spawn:

```bash
cline "<brief>" --json --auto-approve true -m <model>
```

Reuse:

```bash
cline --id <session-id> "<review or fix>"
```

Read the session id from the `--json` output or `cline history`. `-P/--provider` selects the provider, `-m/--model` selects the model, `--thinking` sets reasoning effort, `--worktree` isolates the run, and `-z/--zen` runs it in the background. `--acp` starts an ACP server.

There is no documented `--list-models` flag in the current CLI. Read the provider's model list or declare the id in the catalog. Cline skills live in `.cline/skills/` and `~/.cline/skills/`; `cline skill` wraps `npx skills`.

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

The CLI is `command-code` (aliases `cmd` and `cmdc` on Windows). The current session may also expose an `agent` tool; use the CLI when the chat must be resumed.

Spawn:

```bash
command-code -p -n <worker-id> --output-format json -m <model> "<brief>"
```

`-p/--print` runs non-interactively, `--output-format json` emits NDJSON events plus a final result, `-n/--name` gives the session a resumable name, and `-m/--model` selects the model.

Reuse:

```bash
command-code -p -r <worker-id> "<review or fix>"
```

or `command-code -p --session <id> "<review>"`. `--list-models` lists models, `--max-turns` caps the run, `--permission-mode` and `--worktree` control the environment, and `--skill <path>` loads extra skills.

If only the `agent` tool is available, use it and record `resumable: false`. Make the worker write its full output contract and diff to `.maestro/tasks/<id>/result.md` so a fresh reviewer can read it.

## Pi

The Pi CLI is the `pi` binary.

Spawn:

```bash
pi --print --session-id <worker-id> --model <provider>/<model> "<brief>"
```

`--print` runs once and exits, `--session-id` creates or opens the session, `--model` accepts `provider/id` plus an optional `:thinking` suffix, and `--provider` restricts the model lookup. `--mode json` emits events instead of text.

Reuse:

```bash
pi --print --session <worker-id> "<review or fix>"
```

`--session` opens a session by path or id, `--continue` continues the latest session in the current directory, and `--resume` opens the picker. `--list-models [search]` discovers models. `--skill <path>` loads a skill; Pi skills live in `~/.pi/agent/skills/` and `.pi/skills/`.

Use `-a/--approve` only when the project is trusted; it loads project-local configuration and resources for that process.

## Native host subagents

Claude Code, Cursor, Codex, OpenCode, Cline, Pi, Command Code, and some IDE hosts expose a task or subagent tool. Use it when:

- It returns an id that can be prompted again, or
- The task is fire-and-forget and the review can use the written result.

Do not assume resume. If the tool returns no id, record `resumable: false`.

## Hermes

Hermes is an ACP server, not a one-shot CLI. The preferred path is Paseo: `create_agent({provider: "hermes"})`, then `send_agent_prompt` for reviews. Paseo exposes `list_models` and the agent id for the chat.

Direct:

- `hermes acp` or `hermes-acp` starts the ACP server.
- `hermes acp --check` and `hermes status` are health checks.
- `hermes model` configures the provider and model; ACP clients receive the model list.
- Sessions persist in `~/.hermes/state.db` and can be listed, resumed, or forked with `hermes sessions`.
- Skills live in `~/.hermes/skills/`, project `.hermes/skills/`, and `.agents/skills/`.

Do not parse the ACP JSON-RPC stream by hand. Use Paseo or an ACP client.

## Antigravity and Muse Code

Both are Paseo native providers.

- **Antigravity:** install the `agy` CLI and sign in; Paseo launches `agy` with full access. The provider id is `antigravity`. Paseo MCP tools and steering are unavailable, and every tool call runs without asking, so use it only where that is acceptable.
- **Muse Code:** the provider id is `muse`; Paseo exposes its model list and chat.

Use `list_models({provider: "antigravity"})` or `list_models({provider: "muse"})` and `create_agent`.

## Any ACP provider

Paseo's ACP catalog covers Cline, Cursor, Kilo, Hermes, Gemini CLI, GitHub Copilot, Goose, Amp, Auggie, Qwen, Kimi, Junie, and many more. Use `list_providers` for the exact id, `list_models({provider})`, and `create_agent`. If a provider is not in Paseo, install its CLI and use a direct adapter; if it only exposes ACP, run it behind an ACP host.

## IDE-only hosts

Kiro, Copilot, and some IDE hosts do not expose a standard resumable CLI session in every version. Use the host's own background or subagent surface if it returns a chat id, or run a worker CLI from the detection list. If neither is available, stop and report that the run needs a worker runtime. Do not do the work yourself.

## Generic fallback

When the host is unknown, look for any CLI that can run a prompt non-interactively and resume a named session. Require both. A worker that cannot be re-entered cannot be reviewed in place, and Maestro must fall back to a written result plus a fresh reviewer.

Record the exact command and the help output version in `run.json`, so the adapter is reproducible.

## Session id capture

Record the id before the first prompt. Common ways:

- Paseo MCP: the `agentId` returned by `create_agent`.
- Paseo CLI: the id in `paseo run --json`.
- Claude / Claude Code: the UUID passed to `--session-id`, or `session_id` in the JSON output.
- Codex: the thread or session id in the `--json` events.
- OpenCode and Kilo: the value passed to `--session`.
- Cline: the session id in the `--json` output or in `cline history`.
- Command Code: the `-n/--name` you set, or the id in `--output-format json`; resume with `-r` or `--session`.
- Pi: the `--session-id` you set; resume with `--session`.
- Cursor: the chat id from `--output-format json` or `agent ls`.
- Hermes: the Paseo `agentId`; direct ACP sessions live in `~/.hermes/state.db` and `hermes sessions`.
- Antigravity and Muse Code: the Paseo `agentId`.

Write it to `workers.jsonl` immediately. A worker without a chat id is not reviewable.

## Model discovery

Discover the catalog before the first spawn, and refresh when `/maestro providers --refresh` is requested. Use the provider's own surface.

| Harness | Discover | Notes |
|---|---|---|
| Paseo MCP | `list_providers`, `list_models`, `list_profiles`, `inspect_provider` | Profiles carry the human's notes; prefer a matching profile |
| Paseo CLI | `paseo provider ls --json`, `paseo provider models <provider> --json`, `paseo provider diagnostic <provider> --json`, `paseo usage ls --json` | Usage reports quotas and balances |
| Claude / Claude Code | `--model` aliases and documented IDs | No standard list command in every version |
| Codex | `codex debug models`, `codex debug models --bundled` | Use `--bundled` for the installed catalog |
| OpenCode | `opencode models` | The output lists the provider and model IDs |
| Kilo | `kilo models --verbose --refresh`, `kilo models <provider> --verbose` | `--verbose` includes costs |
| Cline | `cline --help`, `cline config`, `cline auth` | No documented `--list-models` in the current version |
| Command Code | `command-code --list-models` | Lists the models available to the installed CLI |
| Pi | `pi --list-models [search]` | Accepts exact, fuzzy, and glob patterns |
| Hermes | Paseo `list_models({provider: "hermes"})`, `hermes model` | ACP clients receive the model list |
| Cursor | `agent --help` and the app model picker | Use user-declared IDs when the CLI does not enumerate |
| Antigravity | Paseo `list_models({provider: "antigravity"})` | Direct `agy` is provider-managed |
| Muse Code | Paseo `list_models({provider: "muse"})` | Paseo exposes the native provider |
| Any ACP provider | Paseo `list_models({provider: "<id>"})` | Get the id from `list_providers` |

Record the command, the timestamp, and the catalog source. Never invent a model ID or a context size. Use `unknown` when discovery does not provide it.

## Model selection

The exact ID comes from discovery or the user's declared catalog, not from this table.

| Harness | Flag or field |
|---|---|
| Paseo MCP | `provider`, `settings` from a profile |
| Paseo CLI | `--provider`, `--model` |
| Claude / Claude Code | `--model haiku`, `--model sonnet`, `--model opus`, or a full id |
| Codex | `-m <model>` |
| OpenCode | `--model provider/model` |
| Kilo | `-m provider/model` |
| Cline | `-P/--provider`, `-m/--model`, `--thinking` |
| Command Code | `-m/--model` |
| Pi | `--provider`, `--model provider/id[:thinking]`, `--thinking` |
| Hermes | Paseo `provider: "hermes"` plus `settings` |
| Cursor | `--model <model>` |
| Antigravity | Paseo `provider: "antigravity"` plus `settings` |
| Muse Code | Paseo `provider: "muse"` plus `settings` |
| Any ACP provider | Paseo `provider: "<id>"` plus `settings` |

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
