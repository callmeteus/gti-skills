---
name: infra-expert
description: >-
  Guards every infrastructure operation, reviews and reorganizes infrastructure
  in version control (Terraform or OpenTofu, Grafana as code, Kubernetes,
  Compose, CI) and the AWS account behind it, and assesses CVEs. Use when the
  agent runs, changes, deploys, debugs, or inspects infrastructure (SSH on
  hosts, cloud CLIs, Terraform, Kubernetes, Compose, CI, secret stores,
  Grafana, model servers, network devices), when the user asks for a review or
  cleanup of infrastructure, or names a CVE or asks for a vulnerability sweep.
  Modes: operate (automatic guardrails during any infrastructure work, rolling
  or zero-downtime changes, else ask), review (the six-step review and HTML
  report), cve (assess a vulnerability or sweep the inventory, with an explicit
  automatic mode). Project-agnostic: project
  specifics live in the project's committed .gti/infra-expert/ folder; prefer
  the project MCP, then its CLI, and record CLI fallbacks as MCP gaps. Do not
  use for application code with no infrastructure involved.
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

- Review, step 1 asks nothing: take the area from the request (general when none is named), and for the aws area use the default AWS CLI profile and its region only.
- Review, steps 2 to 5: render the report without `--open` and take the candidate with the highest strength; break ties by the lowest risk, then the biggest gain for the least effort. Answer every round of step 5 with its recommended answer.
- Review, step 6: implement only candidates whose risk is `code-only` or `state-move`. List `replace` and `live-change` candidates as pending, with the exact steps the user would run.
- Operate mode: ask nothing. Take the safest documented access path, project MCP first then project CLI, and record every CLI fallback as an MCP gap. Name the exact target before acting, record decisions in the project knowledge folder, and state or apply changes only when the request allows them.
- Operate mode, conventions: discover and apply the project's provisioning path, naming, and tags from `conventions.md` and the repository without asking; ask only for values the repository cannot answer that change the result; see [references/operate/01-orient.md](references/operate/01-orient.md).
- Operate mode, zero downtime: never run a step that causes downtime; list it as pending with the options (accept a window, add a second instance, defer) and ask only outside Autonomous Mode; see [references/operate/04-change.md](references/operate/04-change.md).
- CVE mode: follow [references/areas/cve.md](references/areas/cve.md). In its automatic mode, asked for explicitly or run on a schedule, ask nothing, query only inventory components and CVEs since the last run, read through the access ladder, classify, write the report and allowed records, and list every upgrade and not-checked service as pending. Never upgrade, restart, push, or post.
- Never run `terraform apply`, `destroy`, `import`, `state` subcommands that write, `tofu` equivalents, or any AWS CLI call that is not describe, list, or get in Review and CVE modes. These stay forbidden even in Autonomous Mode; see [references/quality/safety.md](references/quality/safety.md).
- Operate mode in Autonomous Mode: a state change runs only when the request asked for it, and only through the documented path. Anything else, including a method the user named that has no documented path, is listed as pending; see [references/operate/04-change.md](references/operate/04-change.md).
- Operate mode, backups: delete non-database backups after the change is verified, keep database backups, and list them as pending for the user's decision; see [references/operate/04-change.md](references/operate/04-change.md).

## Output Location

Everything this skill generates (reports, notes, logs, downloads, renders, measurements, and run state) goes to `~/.gti/infra-expert/<project>/`, where `<project>` is the repository folder name and `GTI_HOME` replaces `~/.gti`. Create the folder when needed. Never write generated files into the user's repository: only the changes the user asked for (their code, tests, or docs) go there, and a generated file goes there only when the user names that place. Scanner output, the AWS snapshot, state exports, the report data, the HTML report, and the CVE report and state go to `~/.gti/infra-expert/<project>/`. ADRs, `GLOSSARY.md`, and the agreed IaC changes go into the repository.

The one repository location this skill uses is `.gti/infra-expert/`, the project knowledge folder. It lives at the nearest git root of the repository you work in, never at a parent folder of a workspace that holds several repositories. The project commits and shares it like `GLOSSARY.md` or ADRs; it holds access paths, MCP and CLI notes, host aliases, learnings, MCP gaps, and record pointers, never secret values. The skill reads it before the first remote command and writes there only when the folder already exists or the user asked to create it. Create it with `python3 <skill-dir>/scripts/knowledge/knowledge.py init`.

## Modes

Pick a mode from the request. Operate and CVE have their own references; Review is the six-step workflow in this file.

| Mode | Starts when | Reference |
|------|-------------|-----------|
| Operate | The first command that touches infrastructure: a remote host, cloud CLI, deploy, Terraform run, secret store, dashboard, model server, or network device | [references/operate/01-orient.md](references/operate/01-orient.md) to [06-learn.md](references/operate/06-learn.md) and [references/quality/operate-checklist.md](references/quality/operate-checklist.md) |
| Review | The user asks to review, organize, clean up, or untangle infrastructure code or an AWS account | The six steps under [Instructions](#instructions) and the areas table below |
| CVE | The user names a CVE or advisory, a vendor plus "recent", or asks for a vulnerability sweep | [references/areas/cve.md](references/areas/cve.md) and the two scripts in [Scripts](#scripts) |

### Operate

Automatic guardrails during any infrastructure work: remote hosts, cloud CLIs, deploys, Terraform, secret stores, observability, model servers, and network devices. Follow the steps in order, reading each file when its step starts:

1. **Orient.** Locate and read the project knowledge folder, discover the project's conventions into `conventions.md`, name the exact target, climb the access ladder, run one preflight, check feasibility. [references/operate/01-orient.md](references/operate/01-orient.md)
2. **Access.** Reuse one connection, keep scripts in files with a hostname guard, batch across the fleet. [references/operate/02-access.md](references/operate/02-access.md)
3. **Diagnose.** Measure the symptom again, keep stderr and exit codes, wait on conditions, use real identifiers and backends. [references/operate/03-diagnose.md](references/operate/03-diagnose.md)
4. **Change.** Change the source of truth, use reversible apply steps, back up state the source cannot rebuild and delete backups after verification, plan rolling or zero-downtime changes and stop to ask when downtime is unavoidable, keep requirements, announce only confirmed results, finish the reversible part. [references/operate/04-change.md](references/operate/04-change.md)
5. **Records.** A field table with one "Checked on" date, grouped lists, and a Not checked section. [references/operate/05-records.md](references/operate/05-records.md)
6. **Learn.** Append learnings and MCP gaps, correct the folder, never write a secret. [references/operate/06-learn.md](references/operate/06-learn.md)

Read [references/quality/operate-checklist.md](references/quality/operate-checklist.md) before acting on a recurring failure pattern, and [references/quality/safety.md](references/quality/safety.md) before any command that touches state. State or change live state only when the request asks for that change.

### Review

Runs the six steps under [Instructions](#instructions) and writes an HTML report to `~/.gti/infra-expert/<project>/`. The areas table below narrows the scans; the `cve` area hands off to CVE mode instead of the review workflow. Plain writing rules are in [references/concepts/plain-language.md](references/concepts/plain-language.md).

### CVE

Assess one vulnerability from a CVE ID, an advisory URL, or a vendor plus "recent", or sweep the project inventory. [references/areas/cve.md](references/areas/cve.md) defines the eight steps, the status vocabulary, the writing rules, and the automatic mode. Fetch facts with [scripts/cve/cve_lookup.py](scripts/cve/cve_lookup.py) and validate and render the report with [scripts/cve/cve_report.py](scripts/cve/cve_report.py). The report goes to `~/.gti/infra-expert/<project>/cve/`; per-CVE records follow the project's `.gti/infra-expert/records.md` policy. Nothing is upgraded or restarted.

## When to use

- The agent is about to run any infrastructure command: SSH on a host, a cloud CLI, a deploy, Terraform, a secret store write, a Grafana API call, a model server, or a network device. Operate mode applies before the first command.
- The user asks to review, organize, or clean up infrastructure code: Terraform or OpenTofu stacks, Grafana dashboards and alert rules, Kubernetes manifests, Compose files, CI pipelines.
- The user asks what is wrong in an AWS account, or to untangle security groups, VPCs, or buckets.
- The user names a CVE, an advisory, a vendor plus "recent", or asks for a vulnerability sweep.

Do not use it for application code with no infrastructure involved.

## Areas

The user picks an area by name: `/infra-expert terraform`, `/infra-expert aws`, "infra-expert/grafana", or plain words such as "review our AWS account". With no area, run the general review.

| Area | What it covers | Reference |
|------|----------------|-----------|
| `general` | Every stack found in the repository, sorted into one layout; the cross-stack problems (split ownership between repositories, values copied between stacks, generated files mixed with source) | The workflow alone |
| `terraform` | Terraform and OpenTofu: state boundaries, module interfaces, bases and helpers, pinning, tags, lookups instead of IDs, refactors with `moved` and `import` blocks | [references/areas/terraform.md](references/areas/terraform.md) |
| `aws` | A live AWS account, read-only: security groups, VPCs, NAT and IP leftovers, duplicate and exposed buckets, resources no code manages, and the plan to untangle them through code | [references/areas/aws.md](references/areas/aws.md) |
| `grafana` | Dashboards, alert rules, datasources, contact points, and Prometheus scrape config as code | [references/areas/grafana.md](references/areas/grafana.md) |
| `kubernetes`, `docker`, `ci`, `other` | Manifests, Helm, Kustomize, Compose, Ansible, and pipelines | [references/areas/other-stacks.md](references/areas/other-stacks.md) |
| `cve` | One CVE, a vendor's recent advisories, or an inventory sweep, classified and reported with records; handled by CVE mode, not the review steps | [references/areas/cve.md](references/areas/cve.md) |

A named area narrows the scans and the candidates to that area, and reads its reference file at step 1. The general review reads an area file only for the stacks it finds. The `cve` area runs CVE mode instead of the review workflow.

## The layout model

Every piece of infrastructure has two coordinates. Its **kind** says what it is for: helper, base, service, temporary service, generated file, or environment values. Its **layer** says what it manages: foundation, identity, network, storage, data, compute, observability, or delivery. A layer reads only from the layers below it, and every resource has exactly one owner. The model, the target folder layouts, and the rules are in [references/concepts/layers.md](references/concepts/layers.md). Read it before step 3.

Keep what the repository already does well. The model is a way to name problems, not a folder structure to impose: never move or rename a folder only to match a picture.

## Prerequisites

- A git repository with the infrastructure code, or, for the aws area, AWS CLI v2 with read-only credentials. Run the scripts with `python3` on macOS and Linux and `python` or `py -3` on Windows.
- Optional: `terraform` or `tofu` for `fmt`, `validate`, and `plan`; `GLOSSARY.md`, `docs/adr/`, `AGENTS.md`, and inventories in the repository. Read them when they exist; never require them.
- For Operate and CVE work, the project knowledge folder at `.gti/infra-expert/` when it exists. Read it first and prefer the project MCP named there; the folder is never required to exist before you start.

## Instructions

These six steps are Review mode. For operate work follow the files under [Operate](#operate); for a CVE follow [CVE](#cve). Follow the steps in order. Read a reference file only when its step starts. Nothing in the repository or the cloud account changes during steps 1 to 4.

1. **Decide the area and scope.** Take the area from the request, detect the stacks in the repository, read the project rules and docs, and find the hot spots with `scripts/explore/hotspots.py`. See [references/workflow/01-scope.md](references/workflow/01-scope.md) and [references/concepts/project-docs.md](references/concepts/project-docs.md).
2. **Scan.** Run the scanners for the area, all read-only, and write their output to `~/.gti/infra-expert/<project>/`. Read every lead in the code before it becomes a finding. See [references/workflow/02-scan.md](references/workflow/02-scan.md).
3. **Collect candidates.** Map the repository onto the layout model and pick three to six candidates with files, numbers, layer, risk, effort, and strength. Use a subagent with a fresh context when available. See [references/workflow/03-candidates.md](references/workflow/03-candidates.md).
4. **Write the report.** Fill a JSON data file in `~/.gti/infra-expert/<project>/` from [assets/templates/report-data.example.json](assets/templates/report-data.example.json), check it with [references/quality/report-checklist.md](references/quality/report-checklist.md), render it, give the absolute path, and ask which candidate to explore. See [references/workflow/04-report.md](references/workflow/04-report.md).

   ```bash
   python3 <skill-dir>/scripts/report/render_report.py ~/.gti/infra-expert/<project>/infra-review.json --strict --open
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
| `scripts/report/render_report.py` | Validates the report data, warns about vague claims, writes the HTML report to `~/.gti/infra-expert/<project>/` |
| `scripts/knowledge/knowledge.py` | Locate or create the project knowledge folder, append learnings and MCP gaps, check the folder |
| `scripts/cve/cve_lookup.py` | CVE facts from OSV and the CISA KEV feed, online or from a saved JSON file |
| `scripts/cve/cve_report.py` | Validate CVE findings and render the Markdown report, or check only |

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
User: /infra-expert aws, only the production profile in us-east-2
Agent: Confirms the profile and region, runs aws_collect.py into the temp
folder and aws_analyze.py with the Terraform states the user allowed it to
read. Checks each lead by hand, groups 14 security groups into 3 clusters of
identical rules and 2 buckets that hold the same exports, and reports an
untangle plan in which every change goes through code; the deletions are a
runbook for the user.
```

```text
User: Check the disk space on app-host-02 and fix the unit if it is full.
Agent: Reads .gti/infra-expert/ before the first command, names the target,
uses the project MCP read tool with its own filter, runs one preflight, finds
the log partition full, truncates the log through the documented path because
the request allows that change, verifies the health check, and appends a
learning. No secret value is printed.
```

```text
User: Is CVE-2026-12345 applicable to us?
Agent: Reads the project's records.md and hosts.md, fetches OSV and KEV facts
with cve_lookup.py, reads the vendor advisory and NVD by hand, lists real
versions through the access ladder, classifies each service, checks the
findings with cve_report.py --check, renders the report under
~/.gti/infra-expert/<project>/cve/, and writes records only where the policy
allows. Nothing is upgraded or restarted.
```

```text
User: Run the CVE sweep in automatic mode.
Agent: Queries only inventory components and IDs since the last run with
cve_lookup.py query --state, reads through the access ladder without
prompting, marks unreadable hosts not-checked, writes the report and allowed
records, and lists every upgrade as pending. No upgrade, restart, push, or
post.
```

## Resources

| Path | Purpose |
|------|---------|
| [references/workflow/](references/workflow/01-scope.md) | One file per review step: scope, scan, candidates, report, discuss, change and report |
| [references/areas/](references/areas/terraform.md) | Rules and checks per area, including [cve.md](references/areas/cve.md) |
| [references/concepts/layers.md](references/concepts/layers.md) | Layout model and target folder layouts |
| [references/concepts/plain-language.md](references/concepts/plain-language.md) | Counting, naming, and the vague claims to avoid |
| [references/concepts/project-docs.md](references/concepts/project-docs.md) | Project rules, inventories, ADRs, glossary |
| [references/operate/01-orient.md](references/operate/01-orient.md) to [06-learn.md](references/operate/06-learn.md) | Operate mode: orient, access, diagnose, change, records, learn |
| [references/quality/operate-checklist.md](references/quality/operate-checklist.md) | Recurring failure patterns in operate mode |
| [references/quality/safety.md](references/quality/safety.md) | Commands that never run, need permission, or are safe; operate rules |
| [references/quality/report-checklist.md](references/quality/report-checklist.md) | Checks before rendering the review report |
| [scripts/knowledge/knowledge.py](scripts/knowledge/knowledge.py) | Project knowledge folder management |
| [scripts/cve/cve_lookup.py](scripts/cve/cve_lookup.py), [cve_report.py](scripts/cve/cve_report.py) | CVE facts and report |
| [assets/templates/project-knowledge/README.md](assets/templates/project-knowledge/README.md) | Template of the project's committed knowledge folder |
| [assets/templates/cve-findings.example.json](assets/templates/cve-findings.example.json), [cve-record.md](assets/templates/cve-record.md), [cve-report.md](assets/templates/cve-report.md) | CVE findings and report templates |
| [assets/templates/report-data.example.json](assets/templates/report-data.example.json) | Example review report data |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.
