# CLI fallbacks

Prefer the `acme-prod` MCP tools. These commands exist for the cases a tool cannot cover.

| Need | Command | Notes |
|---|---|---|
| Read a remote file when the MCP is down | `acmectl read <host> <path>` | One path per call; no pipes |
| List hosts when the MCP is down | `acmectl hosts --format=json` | Same rows as `prod_list_hosts` |
| Run a reviewed change script | `acmectl exec <host> --stdin < script.sh` | Send one reviewed script; log the result |
| Plan or apply a leaf | `pipeline plan <leaf>` / `pipeline apply <leaf>` | Only leaves in `pipeline.yaml` |
| Read or write a secret | `secret list <path>` / `secret set <path> <key> <value>` | Use key names in reports |

Record a fallback here as an MCP gap so the missing capability can become a tool.
