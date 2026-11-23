# Access paths and secrets

| Target type | Path | Notes |
|---|---|---|
| Production VM | `acme-prod` MCP: `prod_list_hosts`, `prod_exec`, `prod_read_file` | `prod_exec` is read-only and refuses pipes |
| Production VM, change | `prod_ssh_exec` | Auto-approved here; every call is logged |
| MiniStack API | `http://ministack.acme.test:4566` | SigV4 client credentials come from the environment |
| Terraform leaf | `pipeline plan <leaf>`, `pipeline apply <leaf>` | Leaves are listed in `pipeline.yaml` |

## Where secrets live

| Secret | Store | Store and CLI |
|---|---|---|
| Service secrets | ACME secret store, path `/<service>` | `secret list <path>`, `secrets_list` |
| Guest env files | `/var/www/.env`, `/opt/app/.env` | `secret get <path> <key>` |

Secret values are not stored in this repository.
