# Project MCP server: `acme-prod`

Stdio server with six tools. Read-only tools are preferred; the one write tool is logged.

| Tool | Read-only | Inputs | Use for | Do not use for |
|---|---|---|---|---|
| `prod_list_hosts` | yes | `filter` | Resolving a host name before acting | Reading files |
| `prod_exec` | yes | `host`, `command`, `command_base64`, `grep`, `ignoreCase`, `tailLines` | One read-only command; use `grep` and `tailLines` instead of a pipe | Pipes, parentheses, redirects, python, SQL clients |
| `prod_read_file` | yes | `host`, `path`, `offsetBytes`, `maxBytes`, `startLine`, `endLine`, `base64` | Reading an absolute path, byte chunks or line ranges | Shell commands; it is not a search tool |
| `prod_ssh_exec` | no | same as `prod_exec` | One command that changes state; auto-approved and logged | Read-only diagnosis |
| `secrets_list` | yes | `path` | Listing key names in the secret store | Reading a value into the transcript |
| `secrets_set` | no | `path`, `key`, `value` | Creating or replacing a secret | Routing around a missing value from the user |

`prod_exec` checks shell metacharacters outside quoted strings. The `mcp-readonly-rejects-pipes` fault makes it reject quoted pipes too; when that happens, use the tool's own filters rather than a piped command.
