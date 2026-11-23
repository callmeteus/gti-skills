# Project infrastructure knowledge

This folder is ACME's committed instruction set for agents doing infrastructure work. It lives at the repository root and is read before the first remote command. It holds access paths and conventions, never secret values.

| File | Read it when |
|------|--------------|
| `access.md` | You need a host, an access path or a secret location |
| `mcp.md` | You need to know which `acme-prod` tool to call |
| `cli.md` | A tool cannot do the job and you need the documented fallback |
| `hosts.md` | A nickname must be resolved to a target |
| `learnings.md` | You want lessons from earlier work |
| `mcp-gaps.md` | You want to know which capabilities are still missing |
| `records.md` | You need an inventory entry or a runbook |
| `conventions.md` | You need to provision a VM or name a new service |

Correct a fact in the file where you found it when you confirm it is wrong. Never write a password, token or key here; use a key name or a store path.
