# Access paths and secrets

This file is the single answer to "how do I reach target X?" for this project. Keep one row per target type and use the highest path that works. Agents must not invent a connection method, sweep for keys, or try other addresses when the documented path fails; they stop and report the error. This file is committed, so it contains no secret values, only names and paths. Update a row as soon as a better path or a permanent constraint is confirmed.

## Access ladder by target type

| Target type | Path | Command or tool | Notes |
|---|---|---|---|
| Example virtual machine | Project MCP read tool | `project-mcp read --target <host> --grep <pattern>` | Reuses one connection; prefer its own filter parameters |
| Example virtual machine | Project CLI stdin | `project-cli <host> execute --stdin < script.sh` | Use for scripts longer than three lines |
| Example cloud account | Vendor CLI with a profile | `vendor-cli --profile <profile> <service> <action>` | Profile and region come from this file, never inline credentials |
| Example device behind NAT | Documented jump host only | `ssh <jump-host> <target>` | No alternative route unless it is added here |

## Where secrets live

| Secret | Store or file | How to reference it |
|---|---|---|
| Example provider key | `<secret-store-path>/example-provider` | env var `EXAMPLE_PROVIDER_KEY` |
| Example local env file | `.private/example.env` | load with `set -a; . .private/example.env; set +a` |

Never paste a value into this file, a command, or a URL. Store a pasted secret in the location above and refer to it by name.

## Session reuse

- The project MCP's read-only tools reuse an existing connection; the first read opens it for later reads.
- Write tools open a new connection per call. Send one reviewed script rather than many single-line calls.
- A confirmed alias or multiplex setting belongs in `hosts.md` or here, with the date it was checked.
