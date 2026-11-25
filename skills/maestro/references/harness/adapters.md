# Harness adapters

Maestro must spawn workers and re-enter their chats in whatever harness it runs in. This file is the adapter reference. Read it before the first spawn.

## Detection order

1. **An orchestration MCP server.** A server that exposes a spawn tool and a send tool, discovered from the session, the harness MCP config, or a known local or remote server. Classify it with [mcp-orchestrators.md](mcp-orchestrators.md) before using it.
2. **Native agent tools in the session.** A create-agent tool plus a prompt-agent tool, or a subagent tool that returns a resumable id.
3. **A worker CLI on PATH.** Run `python3 <skill-dir>/scripts/agent/agent_run.py list` to see which are installed, with versions. Prefer them in this order: `paseo`, `claude`, `codex`, `opencode`, `kilo`, `cline`, `command-code`, `pi`, `openagents`, `cursor`. `hermes`, `agy`, and `muse` are reached through Paseo. Start and resume them with the runner below.
4. **Nothing.** Stop and report that Maestro needs a worker runtime. Do not do the work yourself.

If Paseo is installed, prefer it for any provider it lists. It is the shortest path to Claude, Codex, OpenCode, Pi, Cline, Cursor, Kilo, Hermes, Antigravity, Muse, and the ACP catalog. Reach Paseo through the first access path that works, in the order in [Paseo access order](#paseo-access-order): MCP, then CLI, then API.

Detection lists every usable path; it does not pick one by itself when several exist. The user picks the final path, as described in [Choosing the final path](#choosing-the-final-path).

If OpenAgents is installed, separate its two products: `agn` is the Workspace launcher and its MCP server is coordination, while `openagents` is Coder and its CLI can delegate to Claude Code, Codex, OpenCode, and Coder.

Record the chosen adapter in `run.json` and in every worker record.

## Paseo access order

Paseo is one runtime with three access paths. Probe them in this order and use the first one that works. Stop probing at the first success.

| Order | Adapter | Available when | Probe |
|---|---|---|---|
| 1 | `paseo-mcp` | The session has the Paseo tools (`create_agent`, `send_agent_prompt`, `list_providers`), injected by Paseo or loaded from the harness MCP config | Call `list_providers`. Success means the daemon answers |
| 2 | `paseo-cli` | `paseo` is on PATH (`paseo.cmd` on Windows) | `paseo --version`, then `paseo daemon status`; the daemon must be running |
| 3 | `paseo-api` | Node.js 22 or newer and a reachable daemon WebSocket, with no MCP tools and no CLI | Read the `listen` address from `paseo daemon status` or `PASEO_HOST` (default `127.0.0.1:17000`), then connect with `@getpaseo/client` |

- A path that fails its probe is skipped, with the reason in `decisions.jsonl`. A daemon that is not running fails every path; report it instead of starting the daemon for the user.
- If no path works, Paseo is not available on this machine. Do not use it, do not install it, and continue with the other runtimes.
- All three paths reach the same daemon, agents, and catalog. An agent id from one path works on the others, so a run that loses its MCP tools can continue the same chats through the CLI or the API.
- Never store the daemon password. Read it from `PASEO_PASSWORD` or the host string at run time.

## Other machines

Paseo and OpenCode can run workers on other machines, so one Maestro run can use a cluster.

- **Paseo:** the daemon keeps connected hosts. List them with `paseo host ls --json` or the `list_hosts` tool, then pass the host's `serverId` to `create_agent`, `send_agent_prompt`, `get_agent_status`, and `get_agent_activity`. Both daemons must allow it in `daemon.remoteAccess`, which is off by default; if it is off, say so and keep the work on this machine. With the CLI, `--host <target>` (or `PASEO_HOST`) points one command at another daemon.
- **OpenCode:** the other machine runs `opencode serve --hostname <address> --port <port>`, and this machine connects with `--server <url>` on each command (verified on OpenCode 2.3.2; `serve` is not in the subcommand list but `opencode serve --help` documents it).

Record every machine in `~/.gti/maestro/hosts.json` at intake and put its id in each worker record's `host` (see [run-state.md](run-state.md#hostsjson)). Route by machine the same way as by model: drop machines that are offline or cannot launch the chosen provider, prefer the machine the user named, and say in one line when work moves to another machine. Never put a password, token, or key in the registry or in a brief.

## Choosing the final path

Several runtimes are often installed at once: Paseo, OpenCode, Kilo, Cline, Cursor, Claude Code, Codex, and others. The final path is the one runtime Maestro spawns workers through. Choose it this way:

1. **Detect every usable path.** Run the MCP sweep, check the session's native agent tools, and probe each worker CLI with `--version`. For Paseo, record only the first access path that works. Drop anything that fails its probe.
2. **Use a saved choice.** If the run kind's profile or `defaults` has an `adapter`, and that adapter is usable now, use it without asking. If it is saved but not usable, say so and ask.
3. **Ask when more than one is usable.** In interactive mode, ask the user once which final path to use. List only the usable paths, recommended first, with a short note each, for example:

   ```text
   Which runtime should run the workers?
   1. Paseo through MCP (recommended: launches Claude, Codex, OpenCode, Kilo, Cline, Cursor, and more, with resumable chats)
   2. Claude Code CLI
   3. OpenCode CLI
   4. Kilo CLI
   Reply with a number. Say "only this run" if it should not become the default.
   ```

   Recommend in this order: a saved adapter, Paseo, an MCP spawner, the native agent tools of the session, then the CLIs in the detection order above.
4. **Use the only one without asking.** When exactly one path is usable, use it and say which one in the run header.
5. **Stop when none is usable.** Report that Maestro needs a worker runtime. Do not do the work yourself.

Save the answer to `defaults.adapter` with `source: user`, or to the run kind's profile when the user names the kind, unless the user said "only this run". `/maestro preferences forget defaults.adapter` brings the question back.

The final path decides how workers are spawned. The model can still come from another provider when the path supports it: Paseo and OpenAgents Coder launch many providers, while a single-provider CLI such as `codex` runs only its own models. When the router picks a model the final path cannot launch, take the best model the path can launch and say so in one line.

## The bundled agent runner

Every CLI worker goes through `scripts/agent/agent_run.py` (shared with Skill Distill, source in `packages/python/agent-runner`). Its registry `scripts/agent/harnesses.json` encodes the spawn, resume, model, permission, and isolation flags in this file. The runner checks optional flags against the installed CLI's `--help`, assigns or captures the chat id, keeps the raw log, and writes one result JSON. Use `python` or `py -3` on Windows.

```bash
# spawn in the background; the result JSON appears when the worker finishes
python3 <skill-dir>/scripts/agent/agent_run.py spawn --harness claude --model sonnet \
  --cwd <repo> --prompt-file ~/.gti/maestro/<project>/tasks/w2.1/brief.md \
  --trace ~/.gti/maestro/<project>/tasks/w2.1/session.jsonl \
  --result ~/.gti/maestro/<project>/tasks/w2.1/spawn.json --background

# review or fix in the same chat
python3 <skill-dir>/scripts/agent/agent_run.py resume --harness claude --session <chat id> \
  --cwd <repo> --prompt-file ~/.gti/maestro/<project>/tasks/w2.1/review-prompt.md \
  --result ~/.gti/maestro/<project>/tasks/w2.1/review-1.json
```

- **Chat id:** `session` in the result JSON is the `chat` field of the worker record. Claude Code, Pi, Kilo, and Command Code get an id assigned before the first prompt; Cursor gets one from `agent create-chat`; Codex, OpenCode, Cline, Paseo, and OpenAgents report theirs in the JSON output. `resumable: false` means no id was found: use the written-result review path.
- **Before a new adapter:** `--dry-run` prints the exact command without running it; record it in `decisions.jsonl`. `dropped_flags` in the result lists optional flags the installed version does not have.
- **Models:** `agent_run.py models --harness <id>` runs the harness's own listing command from the discovery table below.
- **Permissions:** `--yolo` skips the worker's permission prompts. Use it only in a worktree or throwaway folder, never on the user's main checkout without their consent. `--isolate` turns off the user's global context where the harness allows it.
- **Paseo** returns at once with the agent id (`--no-wait`); OpenAgents needs `--agent <name>`. The MCP paths below do not use the runner.
- **Not in the registry:** a harness the registry does not know runs as `--harness script:<path>` with an adapter script, or by hand with the flags below. Add it to `packages/python/agent-runner/scripts/agent/harnesses.json` when it proves out.

The sections below document each harness for reading and for the MCP paths; the runner applies the same flags.

## Capability matrix

| Harness | Spawn | Reuse the same chat | Model selection | Resumable |
|---|---|---|---|---|
| MCP spawner | Its spawn tool | Its send tool with the same id | Its model tool or parameter | When `send` exists |
| Paseo MCP tools | `create_agent` | `send_agent_prompt` with the same `agentId` | Profiles, then `list_providers` and `list_models` | Yes |
| Paseo CLI | `paseo run --no-wait --no-notify --json` | `paseo send <agentId>` | `--provider` and `--model` | Yes |
| Paseo ephemeral | `create_agent({ephemeral: true})` or `paseo run --ephemeral` | Not possible: it archives itself after its result | Same as the Paseo rows | No |
| Paseo API | `client.agents.create({config, cwd, prompt})` | `client.agents.ref(id).run(prompt)` | `config.provider` as `provider/model`, `client.providers.listModels` | Yes |
| OpenAgents Coder | `openagents coder delegate --to <agent> --task "<brief>" --json` | `openagents coder chat -p "<review>" --session <id> --json` | `--model`, `openagents coder models list` | Yes, with `--session` |
| OpenAgents Workspace | No spawn tool in the verified MCP build | Not applicable | Workspace agent config | Coordination only |
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
  notifyOnFinish: true,
  notifyUser: false
})
```

It returns `agentId` and `workspaceId`. Record both. `notifyUser: false` keeps the worker from pinging the user while `notifyOnFinish` still wakes Maestro; see [Quiet and ephemeral Paseo workers](#quiet-and-ephemeral-paseo-workers).

Reuse:

```text
send_agent_prompt({ agentId: "<agentId>", prompt: "<review or fix>" })
```

Check progress with `get_agent_status` or `get_agent_activity`. Cancel a stalled turn with `cancel_agent`, and keep the agent for a follow-up. Do not detach or archive it; only an ephemeral agent archives itself.

Model selection:

1. Call `list_profiles` and read every profile's notes.
2. Pick the profile the user named, or the one whose notes best fit the task.
3. Materialize it into `provider` and `settings` for `create_agent`.
4. If no profile fits, use `list_providers` and `list_models`, and say that you fell back.

Paseo defaults `notifyOnFinish` to true for agent-scoped calls. Finish the turn and wait for the notification instead of polling.

## Paseo CLI

Spawn without waiting:

```bash
paseo run --no-wait --no-notify --json --title "w2.1 Add the CSV serializer" --provider <provider> --model <model> "<brief>"
```

The JSON result contains the agent id. Record it.

Reuse:

```bash
paseo send <agentId> --prompt-file ~/.gti/maestro/<project>/tasks/w2.1/review-prompt.md
```

Discover ids with `paseo ls --json`. Use `--host` for a remote daemon, and `--workspace` or `--new-workspace worktree` for isolation.

Wait for a turn with `paseo wait <agentId> --timeout <seconds>`, read it with `paseo logs <agentId> --tail 20`, and check the provider environment with `paseo provider diagnostic <provider> --json`.

## Quiet and ephemeral Paseo workers

Paseo has two spawn options that fit Maestro. Both work on the MCP tool and the CLI, and both follow `serverId` to another machine.

| Option | MCP `create_agent` | CLI (`paseo run` and `paseo agent run`) | What it does |
|---|---|---|---|
| Quiet | `notifyUser: false` | `--no-notify` | No push and no unread mark for the user. `notifyOnFinish` to the calling agent still fires, so Maestro is still woken |
| Ephemeral | `ephemeral: true` | `--ephemeral` | An internal agent: not persisted, not listed, never notifies. It runs the task, delivers the result through the usual paths, and archives itself at its first terminal event |

### Quiet is the default for workers

Spawn every worker with `notifyUser: false` (`--no-notify`). The user follows the run through Maestro and the central, not one notification per worker. Leave notifications on only when the user asks to be pinged by a worker, or when the worker is expected to stop for the user's own permission answer.

### Ephemeral is for one-shot work only

An ephemeral agent cannot be prompted again: it is gone after its first result. Maestro's review goes back to the chat that did the work, so use `ephemeral: true` only for a task that needs no review round in that chat:

- Use it for a read-only scout, an inventory, a catalog or health probe, a classification, a summary, or an independent second opinion whose answer Maestro verifies on its own.
- Never use it for a build, a fix, an integration, or any task that may need a fix round. Those stay normal, resumable agents.

For an ephemeral worker:

1. Write the brief so the whole result arrives in one turn, in the output contract.
2. Spawn it and get the result in the same step: on the CLI, run `paseo run --ephemeral --json ...` in the foreground (no `--no-wait`), which waits and returns the result; on MCP, keep `notifyOnFinish: true` and read the result when Maestro is woken.
3. Save the result to `~/.gti/maestro/<project>/tasks/<id>/result.md` at once, because the chat will not be there later.
4. Record the worker with `ephemeral: true` and `resumable: false`. It still goes into `workers.jsonl` and `audit.jsonl`, so the central shows it even though Paseo does not list it.
5. If the answer is not good enough, do not try to reach the same chat. Reassign: spawn a new worker (ephemeral again only if the task is still one-shot) from the brief and the saved result.

### Check support before use

Both options are recent and gated per host. Before the first spawn on a host:

- Read the host's `server_info` features: `agentNotificationControl` allows `notifyUser`, and `ephemeralAgents` allows `ephemeral`. On the CLI, confirm that `paseo run --help` lists `--no-notify` and `--ephemeral`.
- A host without the feature answers with an error that asks to update the host. Do not retry the same call. Spawn again without that option: drop `notifyUser` (the user will see notifications, which is acceptable), and replace `ephemeral` with a normal agent spawned with `notifyUser: false` when that is supported. Record the fallback in `decisions.jsonl` and say it in one line.
- Never upgrade a host yourself. A host that needs an update is a pending item for the user.

## Paseo API

Use the API only when the session has no Paseo MCP tools and `paseo` is not on PATH, but the daemon is reachable. It is the TypeScript client `@getpaseo/client` over the daemon WebSocket, and it needs Node.js 22 or newer.

Install the client outside the user's repository, in `~/.gti/maestro/tools/paseo-client/`, and run the script from there:

```bash
npm install --prefix ~/.gti/maestro/tools/paseo-client @getpaseo/client
```

Spawn, wait, and reuse the same agent:

```ts
import { createPaseoClient } from "@getpaseo/client";

const client = createPaseoClient({
  url: "ws://127.0.0.1:17000/ws",
  password: process.env.PASEO_PASSWORD,
});
await client.connect();

// Catalog: installed providers, then the model IDs of one provider
await client.providers.waitForReady({ cwd: process.cwd() });
const models = await client.providers.listModels("<provider>", { cwd: process.cwd() });

const agent = await client.agents.create({
  config: { provider: "<provider>/<model>" },
  cwd: "<project root>",
  title: "w2.1 Add the CSV serializer",
  prompt: "<the brief>",
});
const result = await agent.waitForFinish();

// Review or fix in the same chat, in this run or a later one
const same = client.agents.ref("<agentId>");
await same.refresh();
const review = await same.run("<review or fix>");

await client.close();
```

- Take the URL from the `listen` address of `paseo daemon status`, `PASEO_HOST`, or the user. `127.0.0.1:17000` is only the documented default.
- `waitForFinish()` returns `idle`, `permission`, `error`, or `timeout`. `permission` means a person must answer in Paseo: record it as pending. `timeout` does not cancel the agent.
- `close()` leaves the agent running and visible in Paseo. Record the agent id; it is the chat id for every later review.
- Use provider and model IDs returned by the daemon, never IDs copied from an example.

## Paseo as the universal adapter

When Paseo is available, it can launch the provider directly, and Maestro does not need a separate CLI adapter for each tool. Paseo has native providers for Claude, Codex, OpenCode, Pi, Antigravity, and Muse Code, and an ACP catalog that includes Cline, Cursor, Kilo, Hermes, Gemini CLI, GitHub Copilot, Goose, Amp, Auggie, Qwen, Kimi, Junie, and others.

Use it this way:

1. `list_providers` to get the exact provider id and availability.
2. `list_models({provider})` to get the model ids and capabilities.
3. `create_agent({title, provider: "<id>", initialPrompt, notifyOnFinish: true, notifyUser: false})`, adding `ephemeral: true` only for one-shot work.
4. `send_agent_prompt({agentId, prompt})` for the review and every fix.
5. `get_agent_activity` or `get_agent_status` for progress, and `cancel_agent` for a stall.

Do not hardcode provider ids or assume a provider is installed. If `list_providers` does not show it, install its CLI on the daemon host or use a direct adapter. Paseo is also the recommended path for Hermes, Cline, Cursor, Kilo, Antigravity, and Muse when Maestro runs outside those tools.

## MCP orchestrators and OpenAgents

An MCP server can be a spawner, a coordination plane, or a read-only catalog. Read [mcp-orchestrators.md](mcp-orchestrators.md) for the sweep, the capability contract, and the safety rules. In short:

- Use a server only when its own `tools/list` shows a spawn tool and a send tool. Record the exact tool names.
- A coordination server without `send` cannot start work and cannot be reviewed in place.
- Prefer a session-scoped MCP config over a user-global edit.

OpenAgents has two surfaces:

```bash
# Workspace: coordination tools over stdio; token from OA_WORKSPACE_TOKEN
agn mcp-server --workspace-id <id> --channel-name <name> --agent-name <name> --endpoint <url>

# Coder: read-only MCP tools over stdio
openagents mcp serve

# Coder: the actual delegation
openagents coder delegate --to codex --task "<brief>" --json
openagents coder chat -p "<brief>" --session <id> --json
openagents coder chat -p "<review or fix>" --session <id> --json
```

OpenAgents Workspace exposes workspace state, files, todos, approvals, and notifications, but no message-post tool in the verified build. Use it for shared context and publish the brief there; delegate through Coder, through a workspace thread that routes to Maestro, or through a post tool only if the installed version lists one. Verify `agn mcp-server --help`, because older builds used `--network` and `--token`.

The hosted docs server needs no login: `https://openagents.com/mcp/docs` lists `list_docs`, `search_docs`, `read_doc`, `list_models`, and `list_payment_methods`. The account server at `https://openagents.com/mcp` requires OAuth or a login key and adds `whoami`.

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

If only the `agent` tool is available, use it and record `resumable: false`. Make the worker write its full output contract and diff to `~/.gti/maestro/<project>/tasks/<id>/result.md` so a fresh reviewer can read it.

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
- MCP spawner: the id returned by its spawn tool, and the same id on its send tool.
- OpenAgents Coder: the id printed by `openagents coder delegate --json` or `openagents coder chat --json`; continue with `--session <id>`. `openagents coder sessions list` shows saved chats.
- OpenAgents Workspace: the workspace agent name and channel from `workspace_get_agents`; the workspace MCP server does not create per-task chats.

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
| MCP spawner | Its model tool, or the model parameter on its spawn tool | Record `default` when it has neither |
| OpenAgents Coder | `openagents coder models list`, `openagents coder agents list` | Lists Coder models and the agents installed on the machine |
| OpenAgents Workspace | `workspace_get_agents` | Lists workspace agents and their types, not model capabilities |
| OpenAgents docs MCP | `list_models` at `openagents.com/mcp/docs` | Docs and prices only |

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
| MCP spawner | The model field in its spawn tool, or its model switch tool |
| OpenAgents Coder | `--model` on `delegate` or `chat`; `openagents coder models set <slug>` for its own loop |
| OpenAgents Workspace | The agent's configured model; Maestro cannot change it through the workspace MCP server |

If the harness cannot select a model, record `default`. Do not pretend a tier was applied when it was not.

## Provider limits

- A `429` sets a cooldown and moves to the next candidate. Do not retry the same model before the cooldown.
- A quota or daily limit sets a longer cooldown, until the reset when the provider reports it.
- A free tier is a separate model entry, not an unlimited version of the paid model.
- Use `paseo usage ls --json` when the provider reports account quotas.
- Record `health`, `cooldownUntil`, and `lastError` in `~/.gti/maestro/providers.json`.
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
| MCP server has no spawn tool | Record `coordination`, use it for shared state, and pick another spawner |
| MCP server has no send tool | Record `resumable: false` and use the written-result review path |
| MCP auth required | Start the harness OAuth flow or hand off the login; never put a token in a brief |
| MCP tool name missing | Use `tools/list`; record the version gap and do not call the missing tool |

## Do not invent flags

Every CLI changes. Before a new adapter is used in a run, run `--version` and `--help`, and record the exact command in `decisions.jsonl`. If a flag in this file no longer exists, use the help output and update the run record, not the brief.
