# Area: other stacks

Kubernetes, Docker Compose, Ansible, and CI pipelines. There is no scanner for these; read the files with the checks below and sort what you find into the layout model in [../concepts/layers.md](../concepts/layers.md).

## Kubernetes (manifests, Helm, Kustomize)

- **Bases and overlays**: environments as Kustomize overlays on one base, or one chart with values files. Copied manifests per environment are a missing base.
- **Pinned versions**: chart versions and image tags pinned (no `latest`), CRDs installed by one owner.
- **One owner per object**: an object applied by both a GitOps tool and a script, or by two charts, fights itself.
- **Secrets**: references to an external secret store, never values in the repository.
- **Requests and limits**, probes, and `PodDisruptionBudget` on every long-running workload; namespaces per team or product with network policies.

## Docker Compose

- **One service, one file or one profile**: a base `compose.yaml` with `extends` or `include`, and overrides per environment, instead of copied files.
- **Images pinned by tag or digest**, volumes named, ports bound to `127.0.0.1` or a private interface unless public on purpose.
- **Secrets** through environment files that are gitignored, with an example file committed.
- **Reference copies**: a compose file kept "for reference" in another repository drifts from the one that runs; name the source of truth.

## Ansible

- **Roles as bases** with defaults, playbooks as services, inventories as environment values.
- **Idempotent tasks**: `shell` and `command` without `creates`, `removes`, or `changed_when` are a finding.
- **Collections and roles pinned** in `requirements.yml`.

## CI pipelines

- **Reusable workflows or templates** instead of copied jobs.
- **Plan on pull request, apply from the default branch** through one job, with the apply policy in the project rules.
- **Checks before apply**: format, validate, lint, and security scans.
- **Pinned actions** by version or commit, and least-privilege credentials per job (OIDC roles over long-lived keys).
- **Project lists** that the pipeline uses to find stacks must match the folders; a stack missing from the list is never planned.

## Cross-repository ownership

When one system is split across repositories (a host in one, its config in another, its dashboards in a third), write down who owns what in the report. The fix is usually a short ownership table in each repository's README and one source of truth per file, not moving everything into one repository.
