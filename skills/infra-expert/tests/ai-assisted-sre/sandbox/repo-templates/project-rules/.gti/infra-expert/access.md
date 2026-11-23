# Access paths and secrets

Use the highest path that works and do not invent another address when it fails.

| Target type | Path | Notes |
|---|---|---|
| Production VM | `acme-prod` MCP: `prod_list_hosts`, then `prod_exec`, `prod_read_file` | `prod_exec` is read-only and refuses pipes |
| Production VM, change | `prod_ssh_exec` | Auto-approved here; every call is logged. Use it only for changes |
| MiniStack API | `http://ministack.acme.test:4566` | SigV4 client credentials come from the environment, never from this repository |
| Terraform leaf | `pipeline plan <leaf>` then `pipeline apply <leaf>` | A workstation `terraform apply` is not the pipeline apply |

## Where secrets live

| Secret | Store | How to reference it |
|---|---|---|
| Service secrets | ACME secret store, path `/<service>` | Key names only; read with `secret list <path>` or `secrets_list` |
| Guest env files | `/var/www/.env`, `/opt/app/.env` | Report key names, never values |

Reading a guest `.env` file during diagnosis is allowed. A value pasted into chat lands in the transcript, so do not paste one.

## Zero downtime

Every change is rolling or zero-downtime. A step that stops a service is listed as pending until the user accepts a window. Send `notify "start: <what>"` before a change and `notify "end: <what>"` only after a command on the target returned success.
