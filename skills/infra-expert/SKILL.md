---
name: infra-expert
description: >-
  Reviews and reorganizes infrastructure that lives in version control
  (Terraform or OpenTofu, Grafana as code, Kubernetes, Docker Compose, CI)
  and the AWS account behind it. Sorts every piece into helpers, extensible
  bases, services, temporary services, and layers (network, storage, data,
  identity, compute, observability), finds copied blocks, hardcoded IDs,
  split ownership, and leftovers with read-only scans, presents three to six
  candidates in an HTML report, then works through the chosen one with the
  user and changes the code so the plan shows only the agreed changes.
  Areas: general (default), terraform, aws, grafana, other stacks. The aws
  area audits a live account read-only and untangles security groups, VPCs,
  duplicate buckets, and hand-made resources. Use when the user
  asks to review, organize, clean up, or untangle infrastructure code, an
  AWS account, or Grafana dashboards and alerts, or invokes /infra-expert
  with or without an area. Do not use to apply changes, debug an outage, or
  build a new service.
license: MIT, see LICENSE
compatibility: >-
  Git and Python 3.8+, standard library only. The aws area needs the AWS CLI
  v2 with read-only credentials. Terraform or OpenTofu is optional, for fmt,
  validate, and plan. The report loads Mermaid from a CDN; without network
  the diagram source stays readable as text.
metadata:
  display-name: Infra Expert
---

# Infra Expert

## Core Rule

Always respond in the user's language, regardless of the language used in this skill or any content you analyze. The HTML report also uses the user's language for its prose; keep resource names, paths, and code exactly as they are.

## Autonomous Mode

When the user says to work on your own, for example "do it yourself", "faz você mesmo", "you don't need to ask me", "não precisa me chamar", or "just do it", or when the request runs unattended:

- **Do not stop for input.** Skip questions, confirmations, and pauses that wait for the user. At each decision, take the option this skill recommends, or the safest default, and note the decision and the reason.
- **Do not open anything for the user.** No browser tabs, viewers, editors, or servers started for the user to look at. Still write every file the skill produces and give the paths at the end.
- **Never take a gated irreversible or outward action** unless the request already allows it: deleting the user's data, tests, or files; publishing, posting, pushing, or sending; paying; typing credentials. List each one as pending instead.
- **Finish with one report:** the decisions you took and why, what you did, what is pending, and what you could not verify.

In this skill:

- Step 1 asks nothing: take the area from the request (general when none is named), and for the aws area use the default AWS CLI profile and its region only.
- Render the report without `--open` and take the candidate with the highest strength; break ties by the lowest risk, then the biggest gain for the least effort. Answer every round of step 5 with its recommended answer.
- In step 6, implement only candidates whose risk is `code-only` or `state-move`. List `replace` and `live-change` candidates as pending, with the exact steps the user would run.
- Never run `terraform apply`, `destroy`, `import`, `state` subcommands that write, `tofu` equivalents, or any AWS CLI call that is not describe, list, or get. These stay forbidden even in Autonomous Mode; see [references/quality/safety.md](references/quality/safety.md).

## When to use

- The user asks to review, organize, or clean up infrastructure code: Terraform or OpenTofu stacks, Grafana dashboards and alert rules, Kubernetes manifests, Compose files, CI pipelines.
- The user asks what is wrong in an AWS account, or to untangle security groups, VPCs, or buckets.
- The user says the infrastructure repository is messy, copied, or hard to change, or that nobody knows who owns a resource.

Do not use it to apply changes, to debug an outage, or to design a new service from nothing.

## Areas

The user picks an area by name: `/infra-expert terraform`, `/infra-expert aws`, "infra-expert/grafana", or plain words such as "review our AWS account". With no area, run the general review.

| Area | What it covers | Reference |
|------|----------------|-----------|
| `general` | Every stack found in the repository, sorted into one layout; the cross-stack problems (split ownership between repositories, values copied between stacks, generated files mixed with source) | The workflow alone |
| `terraform` | Terraform and OpenTofu: state boundaries, module interfaces, bases and helpers, pinning, tags, lookups instead of IDs, refactors with `moved` and `import` blocks | [references/areas/terraform.md](references/areas/terraform.md) |
| `aws` | A live AWS account, read-only: security groups, VPCs, NAT and IP leftovers, duplicate and exposed buckets, resources no code manages, and the plan to untangle them through code | [references/areas/aws.md](references/areas/aws.md) |
| `grafana` | Dashboards, alert rules, datasources, contact points, and Prometheus scrape config as code | [references/areas/grafana.md](references/areas/grafana.md) |
| `kubernetes`, `docker`, `ci`, `other` | Manifests, Helm, Kustomize, Compose, Ansible, and pipelines | [references/areas/other-stacks.md](references/areas/other-stacks.md) |

A named area narrows the scans and the candidates to that area, and reads its reference file at step 1. The general review reads an area file only for the stacks it finds.

## The layout model

Every piece of infrastructure has two coordinates. Its **kind** says what it is for: helper, base, service, temporary service, generated file, or environment values. Its **layer** says what it manages: foundation, identity, network, storage, data, compute, observability, or delivery. A layer reads only from the layers below it, and every resource has exactly one owner. The model, the target folder layouts, and the rules are in [references/concepts/layers.md](references/concepts/layers.md). Read it before step 3.

Keep what the repository already does well. The model is a way to name problems, not a folder structure to impose: never move or rename a folder only to match a picture.

## Prerequisites

- A git repository with the infrastructure code, or, for the aws area, AWS CLI v2 with read-only credentials. Run the scripts with `python3` on macOS and Linux and `python` or `py -3` on Windows.
- Optional: `terraform` or `tofu` for `fmt`, `validate`, and `plan`; `GLOSSARY.md`, `docs/adr/`, `AGENTS.md`, and inventories in the repository. Read them when they exist; never require them.

## Instructions

Follow the steps in order. Read a reference file only when its step starts. Nothing in the repository or the cloud account changes during steps 1 to 4.

1. **Decide the area and scope.** Take the area from the request, detect the stacks in the repository, read the project rules and docs, and find the hot spots with `scripts/explore/hotspots.py`. See [references/workflow/01-scope.md](references/workflow/01-scope.md) and [references/concepts/project-docs.md](references/concepts/project-docs.md).
2. **Scan.** Run the scanners for the area, all read-only, and write their output to the OS temp folder. Read every lead in the code before it becomes a finding. See [references/workflow/02-scan.md](references/workflow/02-scan.md).
3. **Collect candidates.** Map the repository onto the layout model and pick three to six candidates with files, numbers, layer, risk, effort, and strength. Use a subagent with a fresh context when available. See [references/workflow/03-candidates.md](references/workflow/03-candidates.md).
4. **Write the report.** Fill a JSON data file in the OS temp folder from [assets/templates/report-data.example.json](assets/templates/report-data.example.json), check it with [references/quality/report-checklist.md](references/quality/report-checklist.md), render it, give the absolute path, and ask which candidate to explore. See [references/workflow/04-report.md](references/workflow/04-report.md).

   ```bash
   python3 <skill-dir>/scripts/report/render_report.py <tmp>/infra-review.json --strict --open
   ```

5. **Work through the chosen candidate.** Ask the open decisions in numbered rounds, each with a recommended answer; look up facts yourself; record lasting decisions as ADRs. See [references/workflow/05-discuss.md](references/workflow/05-discuss.md).
6. **Change the code safely and report.** After the user confirms the plan, change the code so that the plan of every affected stack shows only what the candidate's risk allows, verify what you can, and tell the user what changed, what they must run, and what you could not verify. See [references/workflow/06-change-and-report.md](references/workflow/06-change-and-report.md).

Before step 6, and whenever a command could touch state or the cloud, read [references/quality/safety.md](references/quality/safety.md).

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/explore/hotspots.py` | Folders and files changed most in recent commits, as text or JSON |
| `scripts/scan/terraform_scan.py` | Terraform inventory: folder roles, module callers, resources per layer, and structural findings |
| `scripts/scan/grafana_scan.py` | Grafana inventory: dashboards, alert rules, base files, near-copies, datasource references |
| `scripts/aws/aws_collect.py` | Read-only snapshot of an AWS account through the AWS CLI; refuses any call that is not describe, list, or get |
| `scripts/aws/aws_analyze.py` | Offline findings from a snapshot, optionally compared with Terraform state to find resources no code manages |
| `scripts/report/render_report.py` | Validates the report data, warns about vague claims, writes the HTML report to the OS temp folder |

All take `--help` and use only the Python standard library. The scan scripts read only files git tracks or would track, so gitignored secrets are never opened.

## Examples

```text
User: /infra-expert terraform
Agent: Runs hotspots.py and terraform_scan.py. Reads the leaves the scan
flagged and confirms that six hosts repeat the same instance, Elastic IP, and
security group blocks, that one VPC ID is typed in 14 tfvars files, and that
four roots each hold one call to the same proxy module. Writes a report with
five candidates, renders it with --strict, opens it, and asks which one to
explore.
```

```text
User: /infra-expert aws, só a conta de produção em us-east-2
Agent: Confirms the profile and region, runs aws_collect.py into the temp
folder and aws_analyze.py with the Terraform states the user allowed it to
read. Checks each lead by hand, groups 14 security groups into 3 clusters of
identical rules and 2 buckets that hold the same exports, and reports an
untangle plan in which every change goes through code; the deletions are a
runbook for the user.
```

## Resources

| Path | Purpose |
|------|---------|
| `references/workflow/` | One file per step: scope, scan, candidates, report, discuss, change and report |
| `references/areas/` | Rules and checks per area: terraform, aws, grafana, other stacks |
| `references/concepts/` | Layout model, plain language, glossary and ADR formats |
| `references/quality/` | Safety rules and the report checklist |
| `scripts/` | Hotspots, scanners, AWS collector and analyzer, report renderer |
| `assets/templates/` | Example report data |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.
