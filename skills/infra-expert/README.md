<div align="center">

# Infra Expert

> Guardrails for every infrastructure operation, review, and CVE triage

**Guards every infrastructure operation with operate mode, reviews and untangles infrastructure code and AWS accounts, and assesses CVEs with an explicit automatic mode.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Python](https://img.shields.io/badge/python-3.8%2B-blue.svg)](#requirements)
[![Agents](https://img.shields.io/badge/agents-10%20supported-8A63D2.svg)](#installation)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](#requirements)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](#license)

[Quick Start](#quick-start) • [Usage](#usage) • [Reference](#reference) • [Troubleshooting](#troubleshooting)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Reference](#reference)
- [Output](#output)
- [Security](#security)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Overview

Infrastructure work is not only source code in a repository. It is SSH sessions on hosts, cloud CLIs, deploys, Terraform applies, secret store writes, dashboards, model servers, and network devices. The same drift that makes a repository hard to change makes live work repetitive and risky: access is reinvented every session, identifiers are guessed, the wrong machine is edited, and lessons are lost between sessions. Vulnerabilities need the same discipline: one CVE must be mapped to real versions and conditions in the inventory and reported without anyone changing a running system by accident.

This skill applies automatically to any infrastructure work through three modes. **Operate** adds guardrails from the first command: it reads the project's own knowledge, names the exact target, climbs an access ladder from the project MCP down to the project CLI, measures symptoms, changes only the source of truth, and records learnings and MCP gaps. **Review** does for infrastructure what Improve Codebase Architecture does for application code: read-only scans, a layout model of kinds and layers, three to six candidates in an HTML report, and a change in code so the pipeline applies only what was agreed. **CVE** triages a vulnerability or sweeps the inventory, classifies each service from primary sources and live read-only versions, writes a report and the records the project keeps, and never upgrades anything. Operate and CVE are project-agnostic: the project specifics live in the project's committed `.gti/infra-expert/` folder, and the agent prefers the project MCP before its CLI.

```text
   infrastructure work ──> mode chosen from the request
          │                      │                     │
          v                      v                     v
     OPERATE                REVIEW                   CVE
  read .gti/ first      area + hot spots      CVE ID or sweep
  name exact target     read-only scans       OSV + KEV + advisory
  MCP -> CLI ladder     layout (kind x layer) read live version, condition
  diagnose + change     3 to 6 candidates     classify services
  records + learn       HTML report           report + records
          │                      │                     │
          v                      v                     v
  ~/.gti/infra-expert/<project>/  (all generated files and run state)
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Guard any infrastructure operation, including hosts, cloud CLIs, and deploys | Invent an access path when the documented one fails |
| Review Terraform, OpenTofu, Grafana as code, Kubernetes, Compose, and CI | Run `apply`, `destroy`, or state commands that write |
| Audit an AWS account with describe, list, and get calls only | Change, delete, or create anything in the account |
| Assess a CVE from primary sources and write a report and records | Upgrade, restart, push, or post a result |
| Prefer the project MCP and log every CLI fallback as an MCP gap | Print or store a secret value |
| Make the agreed review change in code with `moved`, `import`, and `removed` blocks | Read gitignored secret files |

## Features

- **Three modes:** operate (automatic guardrails during any infrastructure work), review (the six-step review and HTML report), and CVE (assess a vulnerability or sweep the inventory).
- **Zero downtime:** every operate change to a running service is planned as rolling or zero-downtime; when no such path exists the agent stops, says what would go down and the options, and asks the user.
- **Project knowledge:** reads the project's committed `.gti/infra-expert/` folder at the nearest git root before the first remote command, and creates it from a template only when asked.
- **Access ladder:** project MCP tools first, then the project CLI, then a vendor CLI with a documented profile, then raw SSH or HTTP only when the project documents it; every drop is recorded as an MCP gap.
- **Operate checklist:** 28 recurring failure patterns with the reference file that explains each one, from wrong-host actions to hidden stderr and investigation narrated as a record.
- **CVE lookup and report:** fetches OSV and CISA KEV facts online or from a saved file, validates findings, sorts CVEs worst first, groups large identical service sets, and renders a Markdown report.
- **CVE automatic mode:** an explicit opt-in or a scheduled run that asks nothing, queries only inventory components and new IDs, lists upgrades and unread services as pending, and never patches.
- **Areas:** `general` by default, or `terraform`, `aws`, `grafana`, `kubernetes`, `docker`, `ci`, `other`, and `cve`, each with its own checks.
- **Layout model:** every piece gets a kind and a layer, with rules for ownership, lookups, dependency direction, and state boundaries.
- **Terraform scan:** folder roles and callers, resources per layer, copied blocks, hardcoded IDs and ARNs counted across `.tf` and `.tfvars`, mixed security group rule styles, open ingress, placeholder and one-call roots, unpinned modules and providers, missing default tags.
- **Grafana scan:** dashboards and alert rules, base files and their children, near-copies, repeated queries, datasource UIDs used but not provisioned, duplicate UIDs.
- **AWS audit:** a collector that refuses any call other than describe, list, and get, and an offline analyzer for unused, duplicate, and exposed security groups, overlapping and empty VPCs, idle NAT gateways, IPs, and volumes, duplicate, empty, and public buckets, and resources no Terraform state manages.
- **Risk classes:** `code-only`, `state-move`, `replace`, and `live-change`, each with how to verify it.
- **Secret-safe scans:** the scanners read only files git tracks or would track, so gitignored `*.auto.tfvars` and similar files are never opened.
- **Report in the user's language:** English and Portuguese page labels built in, any label can be overridden, and a check that refuses vague claims such as "best practices".
- **Change report:** after the agreed change, a short message with what is different, the commands the user runs with the expected plan summary, and what was not verified.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| Git | Any recent | Hot spots, the tracked-files filter, and finding the project root | No |
| Python | 3.8+ | Runs the scripts, standard library only | No |
| AWS CLI | v2 | The aws area; read-only credentials | No |
| Terraform or OpenTofu | 1.7+ recommended | Optional: `fmt`, `validate`, and `plan`; `removed` blocks need 1.7 | No |
| Browser | Any recent | Opens the review report; loads Mermaid 11.4.1 from jsDelivr for diagrams | No |

Use `python3` on macOS and Linux and `python` or `py -3` on Windows. Operate and CVE work read the project knowledge folder at `.gti/infra-expert/` at the nearest git root when the project keeps one; it is never required to exist before you start.

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill infra-expert
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--pack infra` to install it with its pack, `--scope user` to install for every project, and `--dry-run` to preview.

| Agent | Id | Project folder | User folder |
|-------|----|----------------|-------------|
| Cursor / Cursor CLI | `cursor` | `.cursor/skills` | `~/.cursor/skills` |
| Claude / Claude Code | `claude` | `.claude/skills` | `~/.claude/skills` |
| Antigravity | `antigravity` | `.agents/skills` | `~/.gemini/antigravity/skills` |
| OpenCode | `opencode` | `.opencode/skills` | `~/.config/opencode/skills` |
| Cline | `cline` | `.cline/skills` | `~/.cline/skills` |
| Kilo Code | `kilo` | `.kilocode/skills` | `~/.kilocode/skills` |
| Kiro | `kiro` | `.kiro/skills` | `~/.kiro/skills` |
| Codex | `codex` | `.agents/skills` | `~/.agents/skills` |
| GitHub Copilot | `copilot` | `.github/skills` | `~/.copilot/skills` |
| Muse Code | `muse` | `.agents/skills` | `~/.agents/skills` |

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/infra-expert` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/infra-expert .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\infra-expert .claude\skills\
```

Each agent has a short guide in `skills/infra-expert/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded. A project-scope Cursor install also writes an always-on rule at `.cursor/rules/infra-expert.mdc` that triggers operate mode before the first infrastructure command.

## Quick Start

```text
Check the disk space on app-host-02 and fix the unit if it is full.
```

The agent enters operate mode: it reads the project knowledge folder, names the target, prefers the project MCP, applies only the change the request allows, verifies it, and appends what it learned.

## Usage

### Input

| Input | Required | Example |
|-------|:--------:|---------|
| Mode | No | Inferred from the request: operate for a command, review for a cleanup, CVE for a vulnerability |
| Target | For operate and CVE | A host alias, account and region, cluster, or device from `.gti/infra-expert/hosts.md` |
| Repository or AWS profile | For review | The current git repository; `--profile prod-readonly` for the aws area |
| Area | For review | `terraform`, `aws`, `grafana`, `kubernetes`, `docker`, `ci`; `general` when none is given |
| Regions | For review | `us-east-2`; the profile region by default |
| CVE input | For CVE | A CVE ID, an advisory URL, a vendor plus "recent", or a sweep request |
| Terraform states | For review | Permission to read them in the aws area, to find resources no code manages |
| Chosen candidate | After the review report | "The second one" |

### Examples

```text
Check the disk space on app-host-02 through the project MCP and fix the unit if it is full.
```

```text
Do a CVE sweep in automatic mode, but only for the components in our inventory.
```

```text
/infra-expert terraform
```

```text
/infra-expert aws, only the production profile in us-east-2. Focus on security groups and duplicated buckets.
```

```text
infra-expert/grafana: the tenant dashboards are copies of each other. What should be a template?
```

```text
Let's do candidate 1. Use moved blocks so nothing is recreated.
```

## How It Works

```text
   mode chosen from the request
          │
          ├── OPERATE ── orient -> access -> diagnose -> change -> records -> learn
          │              project MCP first, CLI fallback logged as an MCP gap
          │
          ├── REVIEW ── 1. Scope -> 2. Scan -> 3. Candidates -> 4. Report
          │                                      -> 5. Discuss -> 6. Change and report
          │
          └── CVE ───── intake -> facts -> map to inventory -> read live version
                         -> classify -> follow filter -> write -> never patch
```

Review runs the six steps in order. Read a reference file only when its step starts. Nothing in the repository or the cloud account changes during steps 1 to 4.

```text
  1. Scope        area, stacks found, project rules, hot spots
          │
  2. Scan         terraform_scan.py, grafana_scan.py, aws_collect.py + aws_analyze.py
          │       (read-only; every lead confirmed by reading)
  3. Candidates   layout map, 3 to 6 candidates with layer, risk, effort, strength
          │
  4. Report       report-data.json ──> render_report.py --strict --open
          │
  5. Discuss      rounds of questions with recommended answers; ADRs
          │
  6. Change       code change with moved, import, removed blocks; fmt and validate;
                  report with the commands the user runs and the expected plan
```

## Reference

### hotspots.py

```bash
python3 scripts/explore/hotspots.py . --commits 300 --top 15
```

| Argument | Default | Description |
|----------|---------|-------------|
| `repo` | `.` | Repository path |
| `--commits` | `300` | Number of recent commits to read |
| `--since` | None | Only commits after this date, for example `3.months` |
| `--top` | `15` | Rows to show per table |
| `--depth` | `2` | Folder depth used to group files |
| `--ignore` | None | Extra glob to skip; repeatable |
| `--json` | Off | Print JSON, ready for the report's `hotspots` field |

### terraform_scan.py

```bash
python3 scripts/scan/terraform_scan.py infra/terraform --json
```

| Argument | Default | Description |
|----------|---------|-------------|
| `root` | `.` | Repository or folder to scan |
| `--json` | Off | Print the full inventory as JSON |
| `--copy-threshold` | `0.9` | Similarity from 0 to 1 above which two resource blocks count as copies |
| `--large-lines` | `400` | Line count above which a file is oversized |
| `--limit` | `15` | Rows to print per finding in text mode |

### grafana_scan.py

```bash
python3 scripts/scan/grafana_scan.py . --threshold 0.7
```

| Argument | Default | Description |
|----------|---------|-------------|
| `root` | `.` | Repository or folder to scan |
| `--json` | Off | Print the full inventory as JSON |
| `--threshold` | `0.7` | Similarity from 0 to 1 above which two files count as near-copies |
| `--extends-key` | `$extends` | Key that points a JSON file at its base file |
| `--large-panels` | `40` | Panel count above which a dashboard is oversized |
| `--limit` | `15` | Rows to print per finding in text mode |

### aws_collect.py

```bash
python3 scripts/aws/aws_collect.py --profile prod-readonly --regions us-east-2 --out ~/.gti/infra-expert/<project>/aws-snapshot
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--out` | New folder in `~/.gti/infra-expert/aws/` | Output folder |
| `--profile` | CLI default chain | AWS CLI profile |
| `--regions` | Profile region | Comma-separated regions |
| `--all-regions` | Off | Collect every region enabled in the account |
| `--skip-s3` | Off | Skip S3 buckets |
| `--workers` | `8` | Parallel AWS CLI calls |
| `--aws` | `aws` | AWS CLI binary |

### aws_analyze.py

```bash
python3 scripts/aws/aws_analyze.py ~/.gti/infra-expert/<project>/aws-snapshot --tf-state ~/.gti/infra-expert/<project>/state-network.json
```

| Argument | Default | Description |
|----------|---------|-------------|
| `snapshot` | - | Folder written by `aws_collect.py` |
| `--tf-state` | None | A `.tfstate` file or `terraform show -json` output to compare with; repeatable |
| `--json` | Off | Print findings as JSON |
| `--limit` | `10` | Findings to print per severity and category in text mode |

### render_report.py

```bash
python3 scripts/report/render_report.py infra-review.json --strict --open
```

| Argument | Default | Description |
|----------|---------|-------------|
| `data` | - | Report data JSON file |
| `--out` | `~/.gti/infra-expert/<project>/`, `infra-review-<timestamp>.html` | Output HTML path |
| `--strict` | Off | Exit with code 3 instead of writing when vague claims are found |
| `--open` | Off | Open the report in the default browser after writing |

The data format is documented in `references/workflow/04-report.md`, with a full example in `assets/templates/report-data.example.json`.

### knowledge.py

```bash
python3 scripts/knowledge/knowledge.py find
python3 scripts/knowledge/knowledge.py init --root <repo>
python3 scripts/knowledge/knowledge.py learn --area access --what "A read opened a new connection" --rule "Use the read-only tool with its own grep parameter" --source "incident review"
```

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `find` | Print the knowledge folder at the nearest git root, or nothing when absent | `--start` (default `.`) |
| `init` | Copy the project template into `<root>/.gti/infra-expert/` | `--root` (default nearest git root), `--force` |
| `learn` | Append a dated learning to `learnings.md` | `--area`, `--what`, `--rule` (all required), `--source`, `--dir` |
| `gap` | Append a dated MCP gap to `mcp-gaps.md` | `--need`, `--command`, `--proposal` (all required), `--dir` |
| `check` | Check that every template file exists and entries follow the format | `--dir` |

`--dir` on `learn`, `gap`, and `check` selects the knowledge folder instead of finding it at the nearest git root from the current folder. The script refuses a value that looks like a secret.

### cve_lookup.py

```bash
python3 scripts/cve/cve_lookup.py osv --id CVE-2026-12345
python3 scripts/cve/cve_lookup.py query --ecosystem Debian:12 --package nginx --version 1.31.8 --state
python3 scripts/cve/cve_lookup.py kev --id CVE-2026-12345
```

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `osv` | Facts about one CVE from OSV | `--id` (required), `--from-file PATH` |
| `query` | CVEs that match a package version in OSV | `--ecosystem`, `--package`, `--version` (all required), `--from-file PATH`, `--state [PATH]` |
| `kev` | Check the CISA Known Exploited Vulnerabilities feed | `--id` (required), `--from-file PATH` |

`--from-file` reads a saved JSON response instead of the network. `--state` prints only IDs not already in `seen` and updates `seen` and `last_run`; with no PATH it uses `~/.gti/infra-expert/<project>/cve/state.json`.

### cve_report.py

```bash
python3 scripts/cve/cve_report.py cve-findings.json --check
python3 scripts/cve/cve_report.py cve-findings.json --out ~/.gti/infra-expert/<project>/cve/cve-report.md
```

| Argument | Default | Description |
|----------|---------|-------------|
| `findings` | - | Findings JSON file, see `assets/templates/cve-findings.example.json` |
| `--out` | `~/.gti/infra-expert/<project>/cve/`, timestamped `cve-report-<timestamp>.md` | Output Markdown path |
| `--check` | Off | Validate only; do not write a report |

### Reference files

| File | Purpose | Used in |
|------|---------|---------|
| `references/workflow/01-scope.md` | Area, stacks, project rules, hot spots | Review step 1 |
| `references/workflow/02-scan.md` | Scanner commands per area and how to confirm leads | Review step 2 |
| `references/workflow/03-candidates.md` | Layout map, questions, fields, risk classes | Review step 3 |
| `references/workflow/04-report.md` | Data fields, diagrams, rendering | Review step 4 |
| `references/workflow/05-discuss.md` | Decisions and rounds of questions | Review step 5 |
| `references/workflow/06-change-and-report.md` | Refactor blocks, verification, the four-part change report | Review step 6 |
| `references/areas/terraform.md` | State boundaries, bases, lookups, rule styles, pins, guard rails | terraform area |
| `references/areas/aws.md` | Credentials, state comparison, what each finding means, the runbook | aws area |
| `references/areas/grafana.md` | Datasource UIDs, bases and copies, generated files, deployment | grafana area |
| `references/areas/other-stacks.md` | Kubernetes, Compose, Ansible, CI, cross-repository ownership | other areas |
| `references/areas/cve.md` | Intake, primary sources, mapping, classification, writing rules, automatic mode | CVE mode |
| `references/operate/01-orient.md` | Project knowledge, target naming, access ladder, preflight, feasibility | Operate step 1 |
| `references/operate/02-access.md` | Connection reuse, scripts in files, first access, fleet batching | Operate step 2 |
| `references/operate/03-diagnose.md` | Facts and timeline, stderr, waits and retries, real identifiers | Operate step 3 |
| `references/operate/04-change.md` | Source of truth, safe apply, environments, names, announcements | Operate step 4 |
| `references/operate/05-records.md` | Field tables, grouped lists, Not checked, record templates | Operate step 5 |
| `references/operate/06-learn.md` | Learnings, MCP gaps, correcting the folder, secrets | Operate step 6 |
| `references/concepts/layers.md` | Kinds, layers, rules, target layouts, naming | Review steps 3 to 6 |
| `references/concepts/plain-language.md` | Counting, naming, and the vague claims to avoid | Review steps 4 to 6 |
| `references/concepts/project-docs.md` | Project rules, inventories, ADRs, glossary | Review steps 1 and 5 |
| `references/quality/safety.md` | Commands that never run, need permission, or are safe; operate rules | Every mode |
| `references/quality/operate-checklist.md` | 28 recurring failure patterns | Operate mode |
| `references/quality/report-checklist.md` | Checks before rendering | Review step 4 |
| `assets/templates/project-knowledge/README.md` | Template of the project's committed knowledge folder | Operate and CVE |
| `assets/templates/cve-findings.example.json` | Findings JSON shape for `cve_report.py` | CVE step 7 |
| `assets/templates/cve-record.md` | Fixed per-CVE record shape | CVE step 7 |
| `assets/templates/cve-report.md` | Markdown report template | CVE step 7 |

## Output

Each candidate card in the review report shows:

```text
  1. Create modules/vm-host and move the 6 hosts onto it
  [Strong] [Layer: Compute] [Risk: State move] [Effort: Medium]

  What's wrong today                 What to change
  6 services repeat about 70 lines   Create a vm-host base and move each
  each; the KMS ARN is typed 7       host onto it with moved blocks.
  times.

  [ Before diagram ]                 [ After diagram ]

  What gets better                   Files and resources involved
  - A new host is one 15-line call   infra/terraform/services/api/main.tf
  - The KMS key is set in 1 place    ...
                                     How to verify it
                                     The plan shows only moved resources.
```

| Section | Contents |
|---------|----------|
| Header | Repository or account, area, date, candidate count, and scope |
| Start here | The candidate to do first and why |
| All candidates | Title, layer, risk, recommendation, and effort per candidate |
| What the scans found | Totals of confirmed scan findings, when provided |
| Where the code changes most | Hot spot table from git history, when provided |
| Details | One card per candidate: problem, change, before and after diagrams, gains, files and resources, how to verify, warning |

### CVE report

One Markdown report is written per run, even a run with no findings:

```text
  # CVE report: acme-infra
  This run reviewed 3 CVEs across 9 services. 1 service is affected or possible.
  Scope: NGINX, Linux kernel CephFS client, runc. Checked on: 2026-11-19. Mode: automatic.
  Status: done

  | CVE | Component | Overall status | Affected services | Fixed in | Record |
  ...

  ## Affected and possible
  ### CVE-2026-12345: NGINX, including the copy embedded in OpenResty
  ... Upgrade step left to do: Upgrade NGINX to 1.31.9 ...

  ## Not applicable
  ## Not checked
  ## Left to do
  - Upgrade NGINX to 1.31.9 on web-01 ... (rollout: rolling)

  ## Needs a downtime decision (the user must decide)
  - needs downtime: ask the user before the kernel upgrade and reboot on db-01 ...

  Nothing was upgraded or restarted.
```

| Section | Contents |
|---------|----------|
| Header | Project, scope (components), one checked-on date, counts, mode, status |
| Results | One row per CVE: component, overall status, affected service count, fixed version, record path |
| Affected | A service table and the upgrade step left to do for each CVE with affected or possible services |
| Not applicable | One short reason per CVE whose condition is absent |
| Not checked | One line per unread service or inventory item, with the reason |
| Left to do | Every upgrade that keeps the service up, with its rollout value, as a separate maintenance task for the user |
| Needs a downtime decision | Upgrades with rollout `needs-downtime`, which the user must decide before they run |

### Project knowledge folder

The project commits `.gti/infra-expert/` itself at the nearest git root, so it is the only generated area that lives in a repository. It never holds a secret value.

| File | Contents |
|------|----------|
| `README.md` | Index of the folder and the rule to read before the first remote command |
| `access.md` | Access paths, profiles, secret-store references, and session reuse notes |
| `mcp.md` | Which project MCP tool to call and whether it reuses a connection |
| `cli.md` | The documented CLI fallback commands |
| `hosts.md` | Host aliases, addresses, and owners |
| `learnings.md` | Dated learnings with What, Rule, and Source |
| `mcp-gaps.md` | Dated MCP gaps with Need, Command, Proposal, and Status |
| `records.md` | Where records go, which cases get one, and the inventory to sweep |

All other generated files, including review reports, AWS snapshots, CVE reports, and `cve/state.json`, go to `~/.gti/infra-expert/<project>/`. Nothing is written to the repository until the user asks for that change, and CVE mode never changes a running system.

## Security

- **Access:** Operate mode starts with the project MCP and climbs to the project CLI, vendor CLI, and raw SSH only as documented; every CLI fallback is written to `mcp-gaps.md`.
- **Cloud access:** `aws_collect.py` checks every operation against a describe, list, or get pattern before calling the AWS CLI and exits on anything else. Use read-only credentials anyway.
- **Snapshot contents:** the snapshot holds network layout, resource names, and tags, but no secrets. It stays in `~/.gti/infra-expert/<project>/`.
- **State files:** Terraform state contains secrets. The aws area reads state only with the user's permission, writes it only to `~/.gti/infra-expert/<project>/`, and deletes it afterwards.
- **Secrets:** the scanners skip gitignored files, and `knowledge.py` refuses a value that looks like a secret. No skill file stores a secret; only variable names and secret-store paths are written.
- **Live state:** an operate change happens only when the request allows it, through the project's documented path, and never widens access or deletes or restarts beyond the request.
- **Zero downtime:** a change to a running service is rolling or zero-downtime; if none is possible the agent stops and asks, and in Autonomous Mode it lists the step as pending with the options.
- **CVE mode:** it reads live versions only, never upgrades or restarts a service, and leaves every upgrade step to the user.
- **Changes:** the review workflow never runs `apply`, `destroy`, or state commands that write; changes land in code for the user's pipeline.

## Development

| Command | Action |
|---------|--------|
| `python -m unittest discover -s skills/infra-expert/tests` | Runs the script tests, with a fake AWS CLI and offline CVE fixtures |
| `python3 -m pytest skills/infra-expert/tests -q` | Runs the same tests with pytest |
| `npm test` | Runs every CLI and Python test in the repository, including these |
| `node packages/cli build` | Regenerates the agent guides and validates the skill |

## Troubleshooting

<details>
<summary><strong>The agent does not see the skill</strong></summary>

Restart the agent session after installing, and confirm the folder is in the path your agent reads (see the table in [Installation](#installation)). In Cursor, a project install also adds an always-on rule at `.cursor/rules/infra-expert.mdc`; check that the rule is present.

</details>

<details>
<summary><strong>"no knowledge folder found" from knowledge.py</strong></summary>

The project does not keep a `.gti/infra-expert/` folder yet. Run `knowledge.py init --root <repo>` if you want one, or let the agent work through the documented read-only profile without it. Never invent an access path while the folder is missing.

</details>

<details>
<summary><strong>The agent acts on the wrong host</strong></summary>

The operate reference requires naming the exact target and resolving nicknames through `hosts.md` before connecting, with a hostname guard at the top of every remote script. If a nickname is not in the folder, tell the agent which target it means before it connects.

</details>

<details>
<summary><strong>"cannot reach AWS" from aws_collect.py</strong></summary>

The AWS CLI could not call STS with the chosen profile. Log in first, for example with `aws sso login --profile <profile>`, and check with `aws sts get-caller-identity --profile <profile>`.

</details>

<details>
<summary><strong>"N calls failed; see errors in manifest.json"</strong></summary>

The credentials lack permission for some describe, list, or get calls, so the checks that need them are missing. Use a profile with the `ReadOnlyAccess` or `SecurityAudit` policy, or accept the gap and say so in the report.

</details>

<details>
<summary><strong>Every resource shows as "not found in the given Terraform states"</strong></summary>

The comparison only knows the states passed with `--tf-state`. Pass the state of every stack that manages the account, in `terraform show -json` or `.tfstate` format.

</details>

<details>
<summary><strong>The Terraform scan misses files</strong></summary>

Inside a git repository the scanners skip gitignored files on purpose. Files that should be scanned must be tracked or at least not ignored.

</details>

<details>
<summary><strong>"vague: 'best practices' in ..." and exit code 3</strong></summary>

`--strict` found a claim that says nothing concrete. Replace it with what actually changes, as printed next to it, then run the script again.

</details>

<details>
<summary><strong>The diagrams show as plain text</strong></summary>

The report loads Mermaid from jsDelivr, and the browser could not reach it. Open the report with network access; the diagram source stays readable meanwhile.

</details>

<details>
<summary><strong>"findings error" from cve_report.py</strong></summary>

The findings JSON does not match the required shape. Start from `assets/templates/cve-findings.example.json`: each CVE needs an `id`, a `component`, and at least one service with a valid status; an `affected` or `possible` service needs a version and a condition, and a `not-checked` service needs a reason. Each `left_to_do` item needs a `text` and a `rollout` value of `rolling`, `blue-green`, `reload`, `no-restart`, or `needs-downtime`. Fix the fields and run `--check` again.

</details>

<details>
<summary><strong>cve_lookup.py cannot reach OSV or KEV</strong></summary>

Use `--from-file` with a saved JSON response from the same endpoint to work offline. Record the failed read as `not-checked` in the findings instead of guessing a version or a KEV status.

</details>

## Limitations

- Operate and CVE mode depend on the project knowledge folder being accurate. A wrong alias or access path can misdirect a command; correct the folder as soon as a fact is confirmed wrong.
- `cve_lookup.py` fetches OSV and the CISA KEV feed only. The vendor advisory, NVD, and the distribution tracker are read by hand, and a sweep is limited to the components in the project inventory.
- CVE mode never patches. It classifies, reports, and lists upgrades as pending; it cannot verify a fix until the user applies it as a separate maintenance task.
- The Terraform scan reads HCL structure without evaluating expressions, `for_each`, or Terragrunt includes; counts are leads for the agent to confirm.
- The Grafana scan reads JSON only; Jsonnet files are counted, not evaluated, and YAML files are read only for datasource UIDs.
- The AWS audit covers EC2 networking, security groups, Elastic IPs, EBS, load balancers, RDS, Lambda, and S3. Launch templates, CloudFormation stacks, and other accounts can use a security group that looks unused.
- Bucket duplicates are found by name and checked by the agent; the analyzer does not compare bucket contents.
- Plans need credentials and backend access; without them the agent verifies with `fmt` and `validate` only and says so.
- Diagrams need network access to render, because Mermaid is loaded from a CDN.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [Improve Codebase Architecture](../improve-codebase-architecture/README.md) | MIT | The review workflow, `hotspots.py`, and the report renderer this skill adapts |
| [mattpocock/skills: improve-codebase-architecture](https://github.com/mattpocock/skills/tree/main/skills/engineering/improve-codebase-architecture) | MIT | The original workflow behind Improve Codebase Architecture |
| [Mermaid](https://github.com/mermaid-js/mermaid) | MIT | Before and after diagrams in the report |

## License

MIT, see [LICENSE](LICENSE). Parts adapted from Improve Codebase Architecture keep its copyright notice.
