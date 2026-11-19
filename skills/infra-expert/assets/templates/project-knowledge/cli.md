# Project CLI wrappers

This file lists the project's own CLI wrappers, which are rung 2 of the access ladder: use them when the project MCP cannot do the job and before calling a vendor CLI directly. For each command, record its purpose, its flags, and the reason the MCP could not be used, so the gap can become an MCP tool. Examples show real flags with placeholders, never secret values. Update the flags when you confirm a change.

## `project-cli` (example wrapper)

Purpose: run a reviewed script on a target and export state in bulk.

| Flag | Meaning |
|---|---|
| `<host>` | Target name as listed in `hosts.md` |
| `--stdin` | Read the script from stdin; use this for scripts longer than three lines |
| `--execute` | Run the given script on the target |
| `--format json` | Emit one JSON object, for batch work |

When the MCP cannot do it: bulk export across many dashboards or hosts, and long scripts that need a hostname guard.

Examples:

```bash
project-cli app-host-02 execute --stdin < preflight.sh
project-cli dashboards export --all --format json > /tmp/dashboards.json
```

When you use a vendor CLI instead because this wrapper also cannot do the job, open an MCP gap with `knowledge.py gap` and add the missing capability here once it exists.
