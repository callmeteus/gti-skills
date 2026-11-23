# Project MCP server: `acme-prod`

Stdio server with six tools: five read-only tools and `prod_ssh_exec` as the write tool. Every call is logged.

| Tool | Read-only | Inputs | What it does |
|---|---|---|---|
| `prod_list_hosts` | yes | `filter` | Lists hosts; the filter matches host, label and hint |
| `prod_exec` | yes | `host`, `command`, `command_base64`, `grep`, `ignoreCase`, `tailLines` | Runs one read-only command; refuses pipes and shell metacharacters outside quotes |
| `prod_read_file` | yes | `host`, `path`, `offsetBytes`, `maxBytes`, `startLine`, `endLine`, `base64` | Reads an absolute path, a byte range or a line range |
| `prod_ssh_exec` | no | same as `prod_exec` | Runs one command that can change state |
| `secrets_list` | yes | `path` | Lists the key names at a store path |
| `secrets_set` | no | `path`, `key`, `value` | Creates or replaces a key |

`prod_exec` checks shell metacharacters outside quoted strings.
