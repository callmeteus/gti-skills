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

## Sources

- <path to the provisioning pipeline or CI workflow> - what it proves
- <path to the closest example stack> - which recipe it supports
- <path to the file that defines the naming or tag set> - which rule it defines
