# The layout model

Every piece of infrastructure code has two coordinates: its **kind** (what it is for) and its **layer** (what it manages). Naming both is how you see what is wrong: a "service" that is really a copy of three other services, a network rule owned by two stacks, a helper that creates resources.

## Kind

| Kind | What it is | Terraform shape | Grafana shape |
|------|------------|-----------------|---------------|
| **Helper** | Computes values and creates nothing: names, tag maps, CIDR math, lookups of existing resources | A module with only `variable`, `locals`, `data`, and `output` blocks | A shared vars file, a Jsonnet library, a generator script |
| **Base** | An extensible building block with sane defaults. Callers change size and names, not shape. It plays the role of an abstract class | A local module with typed, validated variables, no `provider` blocks, used by two or more callers | An alert model other rules extend (`$extends`), a dashboard template with variables, a library panel |
| **Service** | One concrete, long-lived thing, built from bases | A root (leaf) with its own state: provider, backend, and calls to bases with values | A rule or dashboard file that only sets variables on a base |
| **Temporary service** | Something meant to disappear: previews, experiments, dev VMs, load tests | One configuration with one state key per instance, created and destroyed by a script or workflow; every resource carries an expiry tag | A preview folder or test contact point with an owner and an end date |
| **Generated** | Output of a script | Never edited by hand. Lives outside the hand-written tree, or is marked and checked in CI for freshness | Same |
| **Environment values** | The numbers and names that differ per environment or tenant | `terraform.tfvars`, shared `*.auto.tfvars`, or a map in one root | A vars object, a tenants list |

Signs of a wrong kind:

- A "module" that creates nothing but is named like a resource (`modules/ec2` that only returns tags) is a helper with a misleading name.
- Five services that repeat the same 60 lines are missing a base.
- A base that callers must read to use (no descriptions, no validation, provider blocks inside) is a copy, not a base.
- Temporary resources with no expiry and no destroy path become permanent by accident.
- Generated files edited by hand, or committed next to the script that makes them with no freshness check, drift.

## Layer

From the bottom up. A layer may read outputs of the layers below it, never above.

| Layer | Holds |
|-------|-------|
| **Foundation** | Accounts, organizations, state backends, budgets, provider and version settings |
| **Identity** | IAM roles and policies, KMS keys, secrets, machine identities |
| **Network** | VPCs, subnets, routes, NAT, security groups and their rules, load balancers, DNS, certificates, VPN and overlay networks |
| **Storage** | Files and objects: S3, EFS, EBS, backups, container registries (the "filesystem" layer) |
| **Data** | Databases, caches, queues, streams |
| **Compute** | VMs, containers, functions, Kubernetes workloads |
| **Observability** | Metrics, logs, traces, dashboards, alert rules, contact points |
| **Delivery** | CI and CD pipelines, deploy scripts, image builds |

`scripts/scan/layers.py` maps Terraform resource types to these layers; the scan reports per folder and per file.

## Rules

- **One owner per resource.** Each resource, and each attachment between two resources (a security group on an instance, a policy on a role), is managed by exactly one stack. Two stacks writing the same attachment produce flapping plans and comments like "or the next apply drops it".
- **Refer, don't copy.** A stack gets an ID from the layer below through a lookup (`data` source by tag or name), a remote output, or one shared values file. An ID typed into many files is a copy that goes stale.
- **Dependencies point down.** Network does not know which services exist. A service attaches itself to network groups; a network stack listing every service's instance is upside down.
- **State boundaries follow blast radius.** One state per layer per environment for shared layers, one per service for services. A plan touches only what one change should touch. Merging states to remove boilerplate trades a small annoyance for a large risk; remove the boilerplate instead.
- **Delivery is not infrastructure.** Building and deploying application code from Terraform (`local-exec`, `terraform_data` running deploy scripts) ties app releases to infra plans. Move it to the pipeline.

## Target layouts

These are pictures to name problems against, not folder structures to impose. Keep the repository's existing names when they already express the same split (`modules/` for bases, `services/` for leaves). Move a folder only when the move removes a real problem, and remember that the backend key often equals the folder path, so moving a root means migrating its state.

```text
infra/terraform/
├── bootstrap/                 foundation: state bucket and lock, applied once
├── helpers/                   naming, tags, lookups; no resources
├── bases/                     vm-host, security-group, bucket, service-publication, ...
└── stacks/
    ├── foundation/            accounts, budgets
    ├── identity/              shared roles, keys
    ├── network/               VPC, shared security groups, DNS
    ├── storage/               shared buckets, backups
    ├── services/<name>/       one state per service, calls bases
    └── temporary/<kind>/      one configuration, one state key per instance
```

```text
grafana/
├── datasources/               provisioned with fixed, readable UIDs
├── models/                    bases: alert models, dashboard templates, panel libraries
├── alerting/<product>/        concrete rules: variables only
├── dashboards/<product>/      concrete dashboards, or template instances
├── contact-points/  notification-policies/  mute-timings/  templates/
└── generated/                 script output, gitignored or checked for freshness
```

## Naming

- Use the names the repository already uses. When it has several, pick the most common one and list the others as the inconsistency.
- A resource name says role, not instance: `org/area/role` for security groups (`app/db/clients`), not `sg-for-server-3`.
- A base is named after what callers get (`vm-host`, `service-publication`), not after the provider resource it wraps.
