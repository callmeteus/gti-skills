<div align="center">

# Infra Expert

> Infrastructure code and cloud accounts sorted into layers you can change safely

**Reviews infrastructure in version control and the AWS account behind it with read-only scans, reports three to six changes in plain terms, and makes the chosen one through code so the plan shows only what was agreed.**

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

Infrastructure repositories start tidy and drift: the same host blocks copied into every service, a VPC ID typed in a dozen files, two stacks fighting over one security group attachment, dashboards copied per tenant, placeholder roots nobody remembers. The cloud account drifts too: security groups nobody uses, duplicate rule sets, buckets that hold the same exports, resources created by hand.

This skill does for infrastructure what Improve Codebase Architecture does for application code. It sorts every piece by kind (helper, extensible base, service, temporary service, generated file, environment values) and by layer (foundation, identity, network, storage, data, compute, observability, delivery), finds the problems with read-only scans, and reports three to six candidates in an HTML page. Each candidate carries a risk class that says what the plan would show. After the user picks one and settles the decisions, the agent changes the code with `moved`, `import`, and `removed` blocks so the pipeline applies it; it never applies anything or changes the account itself.

```text
  area (general, terraform, aws, grafana, other)
        │
        v
  project rules + hot spots ──> read-only scans ──> confirmed findings
                                                        │
                                                        v
            layout map (kind x layer) ──> 3 to 6 candidates with risk class
                                                        │
                                                        v
                    report-data.json ──> render_report.py --strict ──> HTML report
                                                                           │
                                          user picks a candidate <─────────┘
                                                        │
                                                        v
          rounds of questions ──> agreed plan ──> code change ──> user applies through the pipeline
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Review Terraform, OpenTofu, Grafana as code, Kubernetes, Compose, and CI | Run `apply`, `destroy`, or state commands that write |
| Audit an AWS account with describe, list, and get calls only | Change, delete, or create anything in the account |
| Explain each candidate with numbers, a risk class, and before and after diagrams | Move folders only to match a template |
| Make the agreed change in code with `moved`, `import`, and `removed` blocks | Read gitignored secret files |

## Features

- **Areas:** `general` by default, or `terraform`, `aws`, `grafana`, and other stacks (`kubernetes`, `docker`, `ci`), each with its own checks.
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
| Git | Any recent | Hot spots and the tracked-files filter | No |
| Python | 3.8+ | Runs the scripts, standard library only | No |
| AWS CLI | v2 | The aws area; read-only credentials | No |
| Terraform or OpenTofu | 1.7+ recommended | Optional: `fmt`, `validate`, and `plan`; `removed` blocks need 1.7 | No |
| Browser | Any recent | Opens the report; loads Mermaid 11.4.1 from jsDelivr for diagrams | No |

Use `python3` on macOS and Linux and `python` or `py -3` on Windows.

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

Each agent has a short guide in `skills/infra-expert/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

## Quick Start

```text
/infra-expert terraform
```

The agent scans the Terraform in the repository, confirms each lead in the code, opens an HTML report with three to six candidates, and asks which one you want to work through.

## Usage

### Input

| Input | Required | Example |
|-------|:--------:|---------|
| Repository or AWS profile | Yes | The current git repository; `--profile prod-readonly` for the aws area |
| Area | No | `terraform`, `aws`, `grafana`, `kubernetes`, `docker`, `ci`; `general` when none is given |
| Regions | No | `us-east-2`; the profile region by default |
| Terraform states | No | Permission to read them in the aws area, to find resources no code manages |
| Chosen candidate | After the report | "The second one" |

### Examples

```text
/infra-expert
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

### Reference files

| File | Purpose | Used in |
|------|---------|---------|
| `references/workflow/01-scope.md` | Area, stacks, project rules, hot spots | Step 1 |
| `references/workflow/02-scan.md` | Scanner commands per area and how to confirm leads | Step 2 |
| `references/workflow/03-candidates.md` | Layout map, questions, fields, risk classes | Step 3 |
| `references/workflow/04-report.md` | Data fields, diagrams, rendering | Step 4 |
| `references/workflow/05-discuss.md` | Decisions and rounds of questions | Step 5 |
| `references/workflow/06-change-and-report.md` | Refactor blocks, verification, the four-part change report | Step 6 |
| `references/areas/terraform.md` | State boundaries, bases, lookups, rule styles, pins, guard rails | terraform area |
| `references/areas/aws.md` | Credentials, state comparison, what each finding means, the runbook | aws area |
| `references/areas/grafana.md` | Datasource UIDs, bases and copies, generated files, deployment | grafana area |
| `references/areas/other-stacks.md` | Kubernetes, Compose, Ansible, CI, cross-repository ownership | other areas |
| `references/concepts/layers.md` | Kinds, layers, rules, target layouts, naming | Steps 3 to 6 |
| `references/concepts/plain-language.md` | Counting, naming, and the vague claims to avoid | Steps 4 to 6 |
| `references/concepts/project-docs.md` | Project rules, inventories, ADRs, glossary | Steps 1 and 5 |
| `references/quality/safety.md` | Commands that never run, need permission, or are safe | Steps 2 and 6 |
| `references/quality/report-checklist.md` | Checks before rendering | Step 4 |

## Output

Each candidate card in the report shows:

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

The report and the AWS snapshot are written to `~/.gti/infra-expert/<project>/`; nothing is written to the repository until the user confirms a plan, and nothing is ever written to the account.

## Security

- **Cloud access:** `aws_collect.py` checks every operation against a describe, list, or get pattern before calling the AWS CLI and exits on anything else. Use read-only credentials anyway.
- **Snapshot contents:** the snapshot holds network layout, resource names, and tags, but no secrets. It stays in `~/.gti/infra-expert/<project>/`.
- **State files:** Terraform state contains secrets. The aws area reads state only with the user's permission, writes it only to `~/.gti/infra-expert/<project>/`, and deletes it afterwards.
- **Secret files:** the scanners read only files git tracks or would track, so gitignored files such as `*.auto.tfvars` are skipped.
- **Changes:** the skill never runs `apply`, `destroy`, or state commands that write; changes land in code for the user's pipeline.

## Development

| Command | Action |
|---------|--------|
| `python -m unittest discover -s skills/infra-expert/tests` | Runs the script tests, with a fake AWS CLI |
| `npm test` | Runs every CLI and Python test in the repository, including these |
| `node packages/cli build` | Regenerates the agent guides and validates the skill |

## Troubleshooting

<details>
<summary><strong>The agent does not see the skill</strong></summary>

Restart the agent session after installing, and confirm the folder is in the path your agent reads (see the table in [Installation](#installation)).

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

## Limitations

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
