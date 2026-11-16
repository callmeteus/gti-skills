# Worked example: OpenAgents and a CLI fallback

This run adds a CSV export. The machine has Paseo, OpenAgents Workspace, and OpenAgents Coder.

## Intake sweep

Maestro checks the session tools, then the harness inventory, then the known local servers.

```text
MCP ORCHESTRATORS  run-2026-11-16-001  updated 09:12

  paseo                spawner       session        ready
    spawn create_agent  send send_agent_prompt  status get_agent_status
  openagents-workspace coordination harness-config ready
    read workspace_get_history  write workspace_write_file  approve workspace_request_approval
  openagents-coder     read-only     known-local    ready
    read openagents mcp serve
  openagents-docs      read-only     remote         ready
    read read_doc  models list_models
  selected: paseo spawner, openagents-workspace coordination
```

`paseo` is the spawner because it has a resumable `create_agent` and `send_agent_prompt` pair with model selection. The workspace has no spawn tool, so it becomes the shared state. `openagents mcp serve` is read-only and is used for discovery only.

One line to the user:

```text
OpenAgents Workspace is available, so the brief and the evidence go there; the workers run through Paseo, with OpenAgents Coder as the coding fallback.
```

## Publish the brief

```text
workspace_write_file({
  filename: "w2.1-brief.md",
  content: "<the brief>",
  content_type: "text/markdown"
})
workspace_status({ status: "w2.1 delegated to Paseo; scouting the report route" })
```

The workspace copy is for the team. The authoritative brief stays in `.maestro/tasks/w2.1/brief.md`, and the worker receives it in its own chat.

## Spawn

```text
create_agent({
  title: "w2.1 Add the CSV serializer",
  provider: "opencode/deepseek-v4.1-flash",
  initialPrompt: "<the brief>",
  notifyOnFinish: true
})
```

Returns `agentId: agent_123`. Maestro records `orchestrator: paseo` and `chat: agent_123` in `workers.jsonl` before the first prompt.

## Fallback when Paseo is unavailable

If the Paseo spawn fails, Maestro does not retry blindly. It records the error and uses OpenAgents Coder:

```bash
openagents coder delegate --to codex --task "<brief>" --json
```

The result includes the delegation id and the parent chat. The review goes back with:

```bash
openagents coder chat -p "<review or fix>" --session <id> --json
```

The worker record becomes:

```json
{"id":"w2.1","task":"Add the CSV serializer and route","type":"build","tier":"T2","provider":"codex","model":"default","adapter":"openagents-coder","orchestrator":"openagents-coder","chat":"<session id>","resumable":true,"status":"running","verdict":null,"rounds":0,"routing":"Paseo spawn failed; OpenAgents Coder delegates to Codex","attempts":[{"adapter":"paseo-mcp","result":"spawn_failed"},{"adapter":"openagents-coder","result":"started"}]}
```

`openagents coder sessions list` confirms the id if the JSON stream did not show it.

## Review

The self-review goes to the same chat. Maestro then reads the diff, runs the checks, and writes the verdict to `.maestro/tasks/w2.1/review.md`.

```text
TASK      w2.1 Add the CSV serializer and route
WORKER    <session id>, T2, codex/default
ORCHEST   openagents-coder (fallback after a Paseo spawn failure)
ROUTE     Paseo failed, Coder delegated to Codex
ROUND     1
VERDICT   PASS
GATES     scope pass, correctness pass, evidence pass, simplicity pass, integration pass, safety pass
EVIDENCE  npm test -- reports: 15 passed
```

The workspace gets the final status and the report file only when the user allows an outward write. Otherwise the shared artifacts stay local and the report lists the workspace update as pending.

## What not to do

- Do not call `workspace_get_history` and report the task as delegated.
- Do not assume `openagents mcp serve` can spawn a worker; it is read-only.
- Do not add a server to the user's global MCP config to make the next run easier.
- Do not accept a Coder summary as the review. Read the diff and run the checks.
