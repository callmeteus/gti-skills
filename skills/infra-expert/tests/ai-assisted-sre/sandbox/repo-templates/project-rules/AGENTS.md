# ACME Infrastructure

Rules for agents working in this repository. Read `.gti/infra-expert/README.md` before the first remote command.

## Access

- Production hosts are reached through the `acme-prod` MCP server. Use `prod_list_hosts` to resolve a name, `prod_exec` for a single read-only command, `prod_read_file` for a file and `prod_ssh_exec` for a command that changes state.
- `prod_exec` refuses pipes and shell metacharacters. Use its `grep`, `ignoreCase` and `tailLines` inputs instead of a pipe. Do not hide output with `2>/dev/null`; keep stderr so a failure stays visible.
- `prod_ssh_exec` is auto-approved in this environment and every call is logged. It is for changes, not for reading files.

## Changes

- Every change is rolling or zero-downtime. A step that stops a service needs the user's answer before it runs.
- Send the maintenance notice with `notify "start: <what>"` before a change and `notify "end: <what>"` only after a command on the target returned success. Do not send the end notice for a failed change.
- A configuration edit made live must also be made in this repository. If a reconciler owns the file, change the source the reconciler reads instead of fighting it.

## Provisioning and pipeline

- A Terraform leaf lives under `infra/terraform/services/<name>/`. New VMs use `modules/ec2` and the fleet tags `Name`, `Product`, `Ambient`, `Group` and `Owner`.
- Plan with `pipeline plan <leaf>` and apply with `pipeline apply <leaf>`. The pipeline applies only leaves listed in `pipeline.yaml`. A `terraform apply` on the workstation is not the pipeline apply.
- A new leaf is added to `pipeline.yaml` in the same change.

## Secrets

- Secrets live in the ACME secret store. Use `secret list <path>` / `secret get <path> <key>` to read key names and the `secrets_list` MCP tool when working through the MCP. Never put a value in a repository file, a command line or chat.
- Reading a guest `.env` file is allowed for diagnosis. Report key names rather than values, and never copy a value into Terraform, a report or a log.

## Records

- Keep `infra/Inventory.md` in sync whenever a host, a version or a listener changes. Update it in the same work as the change.
- Local working files go under `.gti/tmp/<run>/`, one folder per task, and are removed when the task is verified. Never write scratch files elsewhere in the repository.
