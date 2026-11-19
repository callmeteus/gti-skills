# Project infrastructure knowledge

This folder is the project's own instructions for any agent doing infrastructure work: SSH, cloud CLIs, deploys, Terraform, secret stores, dashboards, local model servers, or network devices. It lives at the nearest git root of this repository, so in a workspace with several repositories each project keeps its own folder. It is committed and shared like code, so changes are reviewed and travel with the repository. It holds no secret values, only variable names and secret-store paths. Read the file for the task at hand before the first remote command, and keep every file short.

| File | Read it when |
|------|--------------|
| `conventions.md` | You are about to create, bring up, or deploy anything, or you need the project's provisioning path, naming, tags, network defaults, or closest example |
| `access.md` | You need an access path, a profile, a secret location, or session reuse notes |
| `mcp.md` | You need to know which project MCP tool to call and whether it reuses a connection |
| `cli.md` | The MCP cannot do the job and you need the documented fallback command |
| `hosts.md` | A user nickname must be resolved to a target, or you need an address or owner |
| `learnings.md` | You want the lessons from earlier work in this project |
| `mcp-gaps.md` | You want to know which capabilities the team is adding to its MCP |
| `records.md` | You need to find or write a security record, inventory, or runbook |

When you confirm a fact that is missing or wrong here, correct the file in the same change. Never write a password, token, or key into any file in this folder; refer to it by its variable name or path.

Local scratch files of a task live in `.gti/tmp/<run>/` at the same git root, one folder per run created by `knowledge.py tmp`. The `.gti/.gitignore` file ignores `tmp/`, so these folders are never committed. They hold scripts sent to hosts, parameter files, long output, fleet JSON, and rendered configs. Their non-database files are removed when the task is verified; database dumps stay until the user confirms.
