# Step 1: decide the area and scope

## Take the area

Read the area from the request: an argument (`/infra-expert aws`), a path-like name (`infra-expert/terraform`), or plain words ("review our Grafana alerts"). With none, the area is `general`. Read the area's file in `references/areas/` now; the general review reads an area file only for each stack it finds below.

For the aws area, settle before any call:

- **Account and profile:** which AWS CLI profile, and confirm the account ID with `aws sts get-caller-identity`.
- **Regions:** the ones the user names; otherwise the profile region. Offer `--all-regions` when the user is unsure where things run.
- **Terraform states:** whether you may read them to find resources no code manages. State files contain secrets; see [../quality/safety.md](../quality/safety.md).

In Autonomous Mode use the default profile and its region, and do not read state.

## Detect the stacks

List what the repository holds before reading code:

| Sign | Stack |
|------|-------|
| `*.tf`, `.terraform.lock.hcl`, `terragrunt.hcl` | Terraform, OpenTofu, Terragrunt |
| JSON with `panels`, alert JSON, `provisioning/` folders, `*.jsonnet`, `grafana_*` resources | Grafana |
| `prometheus.yml`, `rules/*.yml` with `expr:` | Prometheus |
| `Chart.yaml`, `kustomization.yaml`, manifests with `apiVersion:` | Kubernetes |
| `docker-compose*.yml`, `compose*.yaml` | Docker Compose |
| `playbook*.yml`, `roles/`, `inventory` | Ansible |
| `.github/workflows`, `.forgejo/workflows`, `.gitlab-ci.yml` | CI |

A named area skips the stacks outside it, but still notes where they touch it (a Grafana host defined in the Terraform repository, a scrape config in another repository).

## Read the project rules

Read the files listed in [../concepts/project-docs.md](../concepts/project-docs.md). Note in one line each:

- the apply policy (who applies, through what), which bounds step 6;
- required companion updates (inventories, catalogs, docs);
- conventions worth keeping: file layout per leaf, naming, tag scheme, variable style, comment style. Candidates must follow them.

## Find the hot spots

```bash
python3 <skill-dir>/scripts/explore/hotspots.py . --commits 300
python3 <skill-dir>/scripts/explore/hotspots.py . --json > <tmp>/hotspots.json
```

On Windows use `python` or `py -3`. Infrastructure repositories churn in docs and inventories as much as in code; look at the code folders in the list, and treat a hand-written inventory near the top as a lead for step 3.

## Output of this step

One or two sentences for the report's `scope` field: the area, what was reviewed, why, and what was left out. Example: "Reviewed the Terraform under `infra/terraform` (39 folders) and the AWS account `prod` in `us-east-2`. Kubernetes manifests were not reviewed."
