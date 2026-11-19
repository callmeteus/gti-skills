# Project conventions

This file records how this project builds and changes infrastructure. Read it before creating, bringing up, or deploying anything: it tells you the provisioning path, the closest example to copy, the naming pattern, the tag and label set, the network and access defaults, and the inventories that must change with the resource. Fill each section from the repository and write the source file for every fact in Sources. Never write a secret value here, only a variable name or a secret-store path.

## Provisioning path

| Item | Value |
|------|-------|
| Tool | <Terraform, OpenTofu, Pulumi, CDK, Helm, Compose, or Ansible> |
| Where stacks live | <folders that hold roots and modules> |
| How they are applied | <CI workflow or pipeline that plans and applies, and the commit or branch it pins> |

This path is the default method for any request that says create, bring up, or deploy, even when the user does not name a tool. Create resources through this path and its pipeline, not by hand in a console or with a vendor CLI.

## New resource recipes

| Kind of request | Closest example to copy | Steps |
|-----------------|-------------------------|-------|
| <one service on its own machine> | <stack closest in shape that is already applied and stable (in the default branch for some time, not created or rewritten in the last few days, not marked for removal)> | <copy module calls, variables files, user data, network attachments, outputs, and secrets wiring> |
| <add a service to an existing machine> | <closest existing service stack> | <steps> |
| <another recurring request> | <path to its stack> | <steps> |

Copy the shape of the closest example instead of writing a new structure. Prefer a stack that is already applied and stable over one created or rewritten in the last few days or marked for removal. When the only close example is very recent, say so and ask whether it is the reference. When no example exists, say so and ask only for the values the repository cannot answer that change the result.

## Naming

| Resource kind | Pattern | Example |
|---------------|---------|---------|
| <VM or host> | <pattern from existing code and live resources of the same kind> | <real example> |
| <network or security group> | <pattern> | <real example> |
| <other kind> | <pattern> | <real example> |

Use the pattern already in the code. Never invent a new one, and take examples from live resources of the same kind only through a read-only read.

## Tags and labels

| Key | Applies to | Value rule | Defined in |
|-----|------------|------------|------------|
| <key> | <resource kinds> | <how the value is derived> | <tags module, provider default tags, or locals block, and its file> |

Apply the full set that the kind of resource expects, not a subset, and add the keys that this kind of resource contributes.

## Network and access defaults

| Setting | Default from the closest example |
|---------|----------------------------------|
| <network or VPC> | <value or lookup> |
| <subnet> | <value or lookup> |
| <security group or firewall> | <value or lookup> |
| <key or access method> | <value or secret-store reference> |

## Inventories to update

- <inventory or catalog file to change in the same change, and what to add>
- <another inventory or catalog, when the new resource must appear there>

## Secrets

| Item | Value |
|------|-------|
| Canonical manager | <the manager that holds application secrets, with the project rule or code that makes it canonical> |
| Role | <application secrets: generated passwords, API keys, and tokens the user provides> |
| Path convention | <project or vault per product and folder per service or tenant, with the real slug and environment strings copied from a list call> |
| Host identity and read | <one least-privilege identity per host or service, read-only to its own folder; how it reads at boot or deploy: agent, CLI, or SDK> |
| Bootstrap credential location | <where the credential that lets a host reach the canonical manager is kept, and nothing else lives there> |
| Other managers present | <each other manager and its single role, for example bootstrap only, and that it is not a home for application secrets> |

A value goes to the canonical manager at this path convention, never only to a host file, a variables file in git, or a chat message. Terraform state holds a value only when this project already accepts that; say so when it does. Read only key names and metadata, and never pass a value through the agent. Record a source for each row in Sources below. The full rules live in the skill's `references/operate/07-secrets.md`.

## Sources

- <path to the provisioning pipeline or CI workflow> - what it proves
- <path to the closest example stack> - which recipe it supports
- <path to the file that defines the naming or tag set> - which rule it defines
- <path to the project rule or code that names the canonical manager> - why it is canonical and what the other managers do
- <path to the provider, data source, script, or env file> - the path convention and the real slugs and environment names
