# ACME Infrastructure

Facts about this repository. The committed project knowledge folder is `.gti/infra-expert/`.

## Access

- Production hosts are listed by the `acme-prod` MCP server: `prod_list_hosts` lists hosts, `prod_exec` runs a read-only command, `prod_read_file` reads a path and `prod_ssh_exec` runs a command that changes state.
- `prod_exec` refuses shell metacharacters outside quoted strings. Its inputs are `host`, `command`, `command_base64`, `grep`, `ignoreCase` and `tailLines`.
- `prod_ssh_exec` is the write tool. It is auto-approved in this environment and every call is recorded in the run's `mcp.jsonl`.

## Changes

- The `notify` command is on PATH and appends maintenance notices to the run directory.
- The nginx configuration is at `/etc/nginx/conf.d/app.conf`.

## Provisioning and pipeline

- Terraform leaves live under `infra/terraform/services/<name>/`. `modules/ec2` defines the tags `Name`, `Product`, `Ambient`, `Group` and `Owner` and creates one `aws_instance`.
- The pipeline commands are `pipeline plan <leaf>` and `pipeline apply <leaf>`. `pipeline.yaml` lists the leaves the pipeline knows: `shop` and `warehouse`.

## Secrets

- Secrets live in the ACME secret store at paths such as `/shop`. The CLI is `secret list|get|set <path> <key>` and the MCP tools are `secrets_list` and `secrets_set`.
- Guest env files are at `/var/www/.env` and `/opt/app/.env`.
- Secret values are not stored in this repository.

## Records

- The host, version and listener inventory is `infra/Inventory.md`. The version column records what the binary printed on the machine.
