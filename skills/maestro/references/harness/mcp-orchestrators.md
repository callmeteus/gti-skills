# MCP orchestrators

Maestro delegates through agents, and many harnesses expose those agents over the Model Context Protocol. When an orchestration MCP server is available, Maestro connects to it at intake and uses it, instead of asking the user or falling back to a weaker adapter. This file defines the sweep, the capability contract, the OpenAgents integration, and the safety rules.

## Three roles

Not every MCP server can spawn a worker. Classify every server before using it.

| Role | What it exposes | Maestro uses it for |
|---|---|---|
| Spawner | A tool that creates a thread, agent, or run from a task prompt, plus a tool that continues it by id | Delegation and review in the same chat |
| Coordination | Workspace state: history, agents, files, todos, approvals, notifications | Shared context, published briefs, status, and evidence |
| Read-only | Docs, models, prices, account identity | Provider discovery and documentation lookups |

A coordination server is not a spawner. A read-only server is not an orchestrator. Do not use a `get_history` tool as if it delegated work, and do not invent a `send_message` tool that the server does not list.

## Automatic sweep

Run this once at intake, and again on `/maestro orchestrators --refresh`. Do not ask the user which servers to use.

1. **Session-native MCP tools.** The harness has already loaded servers, so their tools are visible to Maestro. This is the fastest path and needs no configuration.
2. **Configured servers.** Ask the harness for its MCP inventory:
   - Claude Code: `claude mcp list`
   - Codex: `codex mcp list --json`
   - OpenCode: `opencode mcp list` (1.x and 2.x)
   - Paseo: `list_providers` and the session's MCP tools
   - Cursor, Cline, Kilo, Copilot, Kiro: read the harness MCP config, or use the session tools when present
3. **Known local servers, when the CLI is installed.** These are safe to probe because they are read-only until a tool is called:
   - OpenAgents Workspace: `agn mcp-server` (stdio)
   - OpenAgents Coder: `openagents mcp serve` (stdio, read-only)
4. **Known remote servers.** Probe only when the harness already allows network access:
   - `https://openagents.com/mcp/docs` (no login)
   - `https://openagents.com/mcp` (account, OAuth or login key)
5. **Nothing.** Record that no orchestration MCP is available and continue with the native tools or CLI adapter from [adapters.md](adapters.md).

Probe a server with `initialize` and `tools/list`. A probe is a read, not a task. Never call a tool that spends money, posts a message, or starts work during discovery.

Do not hand-write a JSON-RPC client. The harness owns the MCP connection. Inspect the tools the harness exposes, or load a configured server with the harness's own MCP flag. If the harness has no MCP client, the server is not available to Maestro for that run; use the CLI adapter and record the reason.

## Capability contract

Map by schema, not by name. Two servers can use different names for the same operation.

| Capability | What the tool schema must show |
|---|---|
| `spawn` | Creates an agent, thread, task, or run; takes a prompt or task string; returns an id |
| `send` | Takes a thread, agent, task, or run id plus a prompt; continues the same context |
| `status` | Takes the id and returns running, done, blocked, or failed |
| `cancel` | Takes the id and stops the run |
| `list` | Lists agents, threads, tasks, or models |
| `models` | Lists model ids or capabilities |
| `read` | Reads workspace history, files, or state |
| `write` | Writes files, todos, status, or notifications |
| `approve` | Requests or checks a human approval |

A server qualifies as a spawner only when it has `spawn` and `send`. Without `send`, the chat cannot be re-entered for review, so record `resumable: false` and use the written-result review path.

If two servers qualify, prefer the one with model selection and a resumable chat. If neither has model selection, use the CLI adapter that does.

## Adapter contract

Record these fields for every server in `.maestro/orchestrators.json`:

| Field | Meaning |
|---|---|
| `name` | Server name in the harness config |
| `transport` | `stdio` or `http` |
| `source` | `session`, `harness-config`, `known-local`, or `remote` |
| `role` | `spawner`, `coordination`, or `read-only` |
| `tools` | Capability to exact tool name |
| `auth` | Env var, OAuth, or the harness session |
| `resumable` | Whether `send` exists |
| `status` | `ready`, `auth-required`, `read-only`, `unavailable`, or `error` |
| `notes` | Limits and version caveats |

Use the template at [../../assets/templates/orchestrator-registry.json](../../assets/templates/orchestrator-registry.json).

## OpenAgents

Two products share the name. Check which CLI is installed before writing a command.

| Product | CLI | MCP surface | Maestro role |
|---|---|---|---|
| OpenAgents Workspace | `agn` | `agn mcp-server` (stdio) | Coordination |
| OpenAgents Coder | `openagents` | `openagents mcp serve`, `openagents.com/mcp`, `openagents.com/mcp/docs` | Read-only MCP, CLI spawner |

### OpenAgents Workspace

The Launcher CLI is `agn`. Its MCP server exposes workspace tools over stdio:

```bash
agn mcp-server --workspace-id <id> --channel-name <name> --agent-name <name> --endpoint <url>
```

The workspace token is read from `OA_WORKSPACE_TOKEN`. The current CLI reference uses `--workspace-id`, `--channel-name`, `--agent-name`, and `--endpoint`; older versions used `--network` and `--token`, so verify the flags with `agn mcp-server --help` before recording the command. `--endpoint` also accepts `OPENAGENTS_ENDPOINT` for a self-hosted workspace.

The verified tool set is coordination and workspace state:

| Group | Tools |
|---|---|
| Core | `workspace_get_history`, `workspace_get_agents`, `workspace_status` |
| Files | `workspace_list_files`, `workspace_read_file`, `workspace_write_file`, `workspace_delete_file`, `workspace_publish_project` |
| Knowledge | `workspace_list_knowledge`, `workspace_read_knowledge`, `workspace_write_knowledge`, `workspace_delete_knowledge` |
| Todos | `workspace_get_todos`, `workspace_put_todos` |
| Approvals | `workspace_request_approval`, `workspace_check_approval` |
| Notifications | `workspace_send_notification`, `workspace_get_notifications` |
| Routines and timers | `workspace_list_routines`, `workspace_create_routine`, `workspace_update_routine`, `workspace_cancel_routine`, `workspace_create_timer`, `workspace_list_timers`, `workspace_cancel_timer` |
| Browser and web | `workspace_fetch_url`, `workspace_browser_*`, `workspace_image_search`, `workspace_image_save` |
| Tunnels | `tunnel_expose`, `tunnel_list`, `tunnel_close` |

This server has no message-post or mention tool in the verified build. Do not pretend it can delegate. Use it this way:

1. Read `workspace_get_agents` and `workspace_get_history` to learn who is in the workspace and what the thread already knows.
2. Write the brief and the plan into shared files with `workspace_write_file`, and post progress with `workspace_status`.
3. Delegate through a surface that can actually start a turn:
   - Run Maestro as the workspace's thread leader or a member agent, so the workspace routes messages to it and the connector posts its reply.
   - Use the OpenAgents Coder CLI below for coding work.
   - Use a post or mention tool if, and only if, `tools/list` shows one in the installed version.
4. Read completion from `workspace_get_history` and the shared files, then review the evidence before accepting.

Do not use `workspace_delete_file` or `workspace_cancel_routine` without permission. A workspace write is outward-facing when the workspace has other members.

`agn tool-mode <agent|--all> <mcp|skills>` selects how a workspace agent receives its tools. If the workspace is set to `skills`, Maestro's MCP sweep will not see the workspace tools; record that and use the skill path.

### OpenAgents Coder

The CLI is `openagents` (Coder ships as `coder`). It runs the coding agents already installed on the machine and can delegate to them.

Spawn:

```bash
openagents coder delegate --to codex --task "<brief>" --json
openagents coder chat -p "<brief>" --session <id> --json
```

Reuse:

```bash
openagents coder chat -p "<review or fix>" --session <id> --json
```

Flags and surfaces:

| Flag or command | Use |
|---|---|
| `--to claude-code`, `codex`, `opencode`, `coder`, `auto`, or an agent id | Pick the worker agent |
| `--model` | Pick its model |
| `--task` | The full instruction for `delegate` |
| `--session <id>` | Attach the delegation to a Coder chat that can be continued |
| `--read-only` | Use it for a scout or a reviewer |
| `--approvals stdin` | Require approval for non-read-only commands |
| `--json` | One JSON object per line, ending with `finished` or `error` |
| `openagents coder agents list` | Agents installed and enabled on this machine |
| `openagents coder models list` | Models available to Coder |
| `openagents coder sessions list` | Saved chats, with ids |

Delegation shows up as a child chat in the parent Coder chat. Review it there, and send fixes with `--session` so the worker keeps its context.

Its MCP surfaces are read-only and are used for discovery, not delegation:

- `openagents mcp serve` serves the CLI's read-only commands over stdio.
- `openagents.com/mcp/docs` serves `list_docs`, `search_docs`, `read_doc`, `list_models`, and `list_payment_methods` with no login.
- `openagents.com/mcp` adds `whoami` and requires OAuth or a login key (`oa_...`). An `oak_...` API key is refused there.

Do not treat `openagents mcp serve` as a spawner. Use `openagents coder delegate` or `openagents coder chat --session` for that.

### Other orchestrators

Paseo is both an orchestrator and an MCP host: `create_agent`, `send_agent_prompt`, `get_agent_status`, `cancel_agent`, `list_providers`, and `list_models` are the contract. It is the preferred adapter when present.

Any other MCP server qualifies when it satisfies the capability contract. This includes A2A bridges, multi-agent frameworks that expose spawn and send tools, and hosted orchestration services. Do not maintain a list of names; probe and classify.

## Session-scoped loading

Prefer a session-scoped MCP configuration over editing the user's global config. A global edit is a durable environment change and, in autonomous mode, becomes pending.

| Harness | Session-scoped path |
|---|---|
| Claude Code | `claude -p --mcp-config <file-or-json> "<brief>"`; add `--strict-mcp-config` only when the run must ignore every other server |
| Codex | `-c 'mcp_servers.<name>.command="..."'` and `-c 'mcp_servers.<name>.args=[...]'`; or a trusted project `.codex/config.toml` |
| OpenCode | `OPENCODE_CONFIG=<file> opencode run ...`; `opencode mcp add` writes a config and `opencode mcp list` verifies it |
| Paseo | Use the native tools; MCP servers live in Paseo's settings, not in the run |
| Cursor, Cline, Kilo, Copilot, Kiro | Read the harness config; do not edit a global file without permission |

Configuration shapes differ by version. Codex uses `[mcp_servers.<name>]` in `config.toml`. OpenCode 1.x uses `mcp.<name>`, and OpenCode 2.x uses `mcp.servers.<name>`. Verify with the installed CLI before writing.

Never put a token in a brief or in a committed config. Reference an environment variable or an existing login. OAuth belongs to the harness: start the login and hand off to the user when a browser step is required.

## Review gate for nested orchestrators

An orchestrator that spawns its own workers is still a worker from Maestro's point of view.

- Give it a bounded task, the output contract, and the evidence requirements.
- Require per-task evidence, not a single blended summary.
- Review in the same orchestrator thread or the same child chat that produced the work.
- Never let the orchestrator approve its own work, and never accept its PASS as the verdict.
- Keep nesting to two levels. If the orchestrator cannot return per-task evidence, flatten the plan and use direct workers.

## Failure handling

| Failure | Action |
|---|---|
| `tools/list` fails | Record `unavailable`, try the next server, then the CLI adapter |
| `401` or `auth-required` | Start the harness OAuth flow, or ask the user for the login step; do not type a token into a brief |
| Server is coordination-only | Use it for shared state and continue to a spawner |
| Server is read-only | Use it for discovery and continue to a spawner |
| `spawn` exists but `send` does not | Record `resumable: false`, use the written-result review path |
| Tool call times out | One retry, then record the error and move to the next adapter |
| Server version lacks a tool the doc names | Use `tools/list`, record the version gap, and never call the missing tool |
| The orchestrator returns one summary for five tasks | Send it back for per-task evidence, or reassign to direct workers |

## Record and narrate

Append the selected server, role, transport, and capability mapping to `.maestro/orchestrators.json`, and the choice to `decisions.jsonl`. Add an `orchestrator` field to every worker record.

Say a non-obvious choice in one short line in the user's language, for example:

- "OpenAgents Workspace is available, so I will publish the brief there and run the build through OpenAgents Coder."
- "That server only reads workspace history, so it cannot spawn; I am using Paseo for the worker."
- "OpenAgents Coder is on this machine, so I will use its Codex delegation instead of a raw Codex session."

Do not narrate a server that was simply already configured, and do not claim an integration that the capability probe did not confirm.
