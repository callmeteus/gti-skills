# Project MCP servers

This file documents the MCP servers this project owns, so an agent can pick the right tool without discovering it by trial and error. List each server by name and purpose, then one table of its tools. Mark whether a tool is read-only and whether it reuses a session; those two facts decide whether an agent should prefer it. Keep the "Do not use for" column honest, because a tool used for the wrong job is how access paths get replaced. This file is committed and holds no secret values.

## `project-mcp` (example server)

Purpose: read and change state on this project's hosts and services through one authenticated entry point.

| Tool | Read-only | Reuses session | Inputs | Use for | Do not use for |
|---|---|---|---|---|---|
| `read_log` | yes | yes | `target`, `grep` | Reading logs on one target with a server-side filter | Writing files or scanning a fleet |
| `read_file` | yes | yes | `target`, `path` | Reading one known file | One call per host in a loop |
| `exec_write` | no | no | `target`, `script` | One reviewed script on one target | A simple grep, or bulk work across hosts |

Add a server below with the same table. When you confirm that a tool's read-only or session behaviour differs from this table, correct it here and record the correction in `learnings.md`.
