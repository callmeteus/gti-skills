# Area: Terraform and OpenTofu

Checks and fixes for Terraform, OpenTofu, and Terragrunt repositories. `terraform_scan.py` finds most leads; this file says what each one usually means and the fix that keeps the plan quiet. Everything here applies to `tofu` with the same commands.

## State boundaries

- **One state per service, one per shared layer per environment.** A plan should touch only what one change should touch. Check the backend `key` of every root: two roots sharing a key, or one root holding unrelated services, is a finding.
- **Roots that only call one module** (`one_call_roots`) come in two kinds. Several tenants or environments of one product, each with its own state on purpose, keep their states; remove the boilerplate instead (shared `versions.tf` through a symlink or a generator, shared `*.auto.tfvars`, Terragrunt, or a smaller variable surface). Several small publications of the same kind (proxies, DNS records, dashboards) usually belong in one root with a `for_each` map; that root already exists when one stack does it with a local map.
- **Placeholder roots** (`placeholder_roots`: a backend, no resources) reserve a state key for something not built yet, or for something that no longer exists. Ask which; remove the second kind.
- **Local state** (`local_state`): a root with no backend keeps state on one machine. Move it to the shared backend unless it is a deliberate local sandbox, and say so in its README.
- **`terraform_remote_state` coupling**: reading another root's whole state ties the two together. Prefer a data source lookup by tag or name, or a small published output.

## Bases and helpers

- **Missing base** (`copied_blocks`, plus reading): when three or more services repeat the same group of resources (instance, IP, security group, DNS, secret), extract a base. The base has typed variables with `description` and `validation`, no `provider` or `backend` blocks, outputs with descriptions, and `sensitive = true` on secrets.
- **Copies that disagree**: list every difference before writing the base. Each one becomes a variable with the common value as default, or a bug fix the user approves.
- **Misnamed helpers**: a module that creates nothing but is named after a resource (`modules/ec2` returning tags) should be renamed to what it returns (`helpers/tags`), with `moved` blocks not needed since it has no resources.
- **Bases that reach into other bases** through relative paths (`${path.module}/../other/script.py`) are hidden links; move the shared file into a helper both use.
- **Extract with `moved` blocks**: moving `aws_instance.host` into `module.host.aws_instance.this` is a `state-move` when the base produces the same arguments. Diff the old block against the base's rendered arguments before claiming that.

## Values and lookups

- **Repeated hardcoded values** (`repeated_hardcoded_values`): an ID typed in many files belongs in one place. In order of preference: a `data` lookup by tag or name (`data "aws_vpc" "main" { tags = { Name = "main" } }`), an output of the stack that owns it, or one shared values file.
- **Account IDs and ARNs**: build them from `data "aws_caller_identity"` and `data "aws_region"`, or look up the resource (`data "aws_kms_alias"`).
- **IDs in `import` blocks** are correct; leave them.
- **AMI owners and similar public constants** typed in several files go in a helper.

## Network rules in code

- **Mixed rule styles** (`mixed_rule_styles`): a security group with inline `ingress` or `egress` blocks that separate rule resources also target produces a plan that never settles. Pick one style per group; prefer separate `aws_vpc_security_group_ingress_rule` and `egress_rule` resources. Converting is a `state-move` only with `import` blocks for the new rule resources; otherwise rules are briefly removed and re-added, which is a `live-change`.
- **One owner per attachment**: `aws_network_interface_sg_attachment` in one stack plus `vpc_security_group_ids` in another fight each other. Keep the attachment with the stack that owns the instance.
- **Open ingress** (`open_ingress`): see [aws.md](aws.md) for what to replace it with.
- **Names**: one naming scheme for groups (`org/area/role`), a description that says why, and renames with `create_before_destroy`.

## Versions and guard rails

- `required_version` and `required_providers` with `~>` constraints in every root (`unpinned_providers`); commit `.terraform.lock.hcl` with hashes for every platform that runs plans (`terraform providers lock -platform=linux_amd64 -platform=darwin_arm64`).
- Registry modules pinned with `version`, git modules with `?ref=` (`unpinned_modules`).
- `default_tags` in each AWS provider (`no_default_tags`) built from one tags helper, so every resource gets owner, service, and environment tags.
- CI runs `terraform fmt -check`, `validate`, a linter such as tflint, a scanner such as trivy or checkov, and a plan on every pull request. Missing checks are a `code-only` candidate.

## Kinds that drift

- **Temporary services** (`temporary_without_expiry`): one configuration, one state key per instance, every resource tagged with an expiry, and a documented destroy path (script or workflow). Leftover local data folders of destroyed instances are a cleanup finding.
- **Delivery inside Terraform**: `terraform_data` or `null_resource` with `local-exec` that builds or deploys application code belongs in the pipeline. Moving it out is usually `code-only` plus a `removed` block.
- **Large embedded programs**: heredoc scripts of more than a few lines inside `.tf` files belong in a file next to them, or in a provider.
- **Half-done renames**: resource names, state keys, and files that still carry an old product name. Fix the names with `moved` blocks; changing a state key is a migration the user runs.

## Verification

```bash
terraform fmt -check -recursive
terraform -chdir=<root> init -backend=false -input=false
terraform -chdir=<root> validate
```

A plan reads state and the cloud; run it only when the user allows it, ideally through the repository's own pipeline. For a `state-move` candidate the plan summary must read `0 to add, 0 to change, 0 to destroy` plus moved, imported, or removed counts.
