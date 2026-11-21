<div align="center">

# Fast CI

> PR results in under a minute, without a CI that lies

**Audits real CI runs on any platform, splits the time into waiting, setup, and running, and lands small measured changes until a pull request gets its result in under 1 minute at the median and 2 at p95, with the full suite still gating main.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Python](https://img.shields.io/badge/python-3.8%2B-blue.svg)](#requirements)
[![Agents](https://img.shields.io/badge/agents-10%20supported-8A63D2.svg)](#installation)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](#requirements)
[![License](https://img.shields.io/badge/license-not%20declared-lightgrey.svg)](#license)

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

Slow CI is usually not one slow thing. It is a queue for a cold runner, a toolchain installed on every job, a cache that misses on every PR, jobs that wait on each other, and one fat test job. The usual fixes (retries, skipped tests, path filters on required checks) make CI faster by making it lie.

Fast CI gives the agent a fixed order of work: three rules that outrank speed, an audit of the last 150 real runs split into waiting, setup, and running at p50 and p95, per-stage budgets, and one small measured change at a time. It works on GitHub Actions, Forgejo and Gitea Actions, Woodpecker, GitLab CI, Jenkins, Kubernetes and K3s runners (Tekton, Argo, ARC, act_runner, Kubernetes agents), and manual or script-based CI, because every collector writes the same timing rows.

```text
  repository + CI system (+ API token or kubectl context)
          │
          v
  rules and scope: jobs, runners, merge gate, hidden failures
          │
          ├──> ci_timings.py collect ──> normalized rows from any CI
          ├──> ci_timings.py analyze ──> waiting / setup / running, p50 and p95, budgets, cost
          │
          v
  waiting -> setup -> tools -> tests and shards -> selection and shape -> hooks and budgets
          │                         │
          │                         └──> shard_plan.py plan / list / verify
          v
  small measured changes in the repository + report in ~/.gti/fast-ci/<project>/
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Measure the last 150 runs on any CI and find the biggest bucket | Add retries, wider timeouts, skips, or `allow_failure` |
| Cancel superseded runs, bake toolchains, seed caches, shrink clones | Sign up for runner vendors, add secrets, or raise a bill |
| Switch to faster tools after a side-by-side run that proves nothing is missed | Turn off lint rules or required checks |
| Balance shards by recorded test time and verify every file ran | Delete tests without two weeks of evidence and approval |
| Select tests on PRs and prove the selector goes red on a hidden change | Use selection on main or in the merge queue |
| Add hooks and budgets that fail slow jobs | Push or open pull requests unless asked |

## Features

- **Three rules first:** the full suite gates main, no hidden failures, never check less.
- **Any CI:** collectors for GitHub Actions, Forgejo and Gitea, Woodpecker, GitLab, Jenkins, and Kubernetes or K3s pods, a `record` mode for manual CI, and a CSV format for everything else.
- **Waiting, setup, running:** each job split into three buckets at p50 and p95, with the critical path of each run.
- **Budgets:** waiting 5 s, setup 15 s, slowest job 35 s, lint and format 1 s, typecheck 5 s, tests 30 s per shard, hooks 9 s, and PR time to result 60 s at p50 and 120 s at p95, with overrides per job.
- **Cost:** billable minutes per run and per month, and monthly cost from a price per minute.
- **Shards from real times:** longest-first balancing from main's JUnit XML, new files spread at the median time, and a verify step that fails when any test file did not run.
- **Platform guides:** where time goes and which levers exist on each CI system, including K3s registry mirrors and image pre-pulls.
- **Toolchains:** fast defaults for JavaScript and TypeScript (the source prompt's bun stack), Python, Go, Rust, JVM, .NET, Ruby, and PHP, with a procedure to prove each switch.
- **Evidence-based test removal:** a two-week log of every failure as a caught regression or a change detector, and a ban on deleting authorization, privacy, migration, or concurrency tests.
- **One report:** before and after numbers from real runs, every change, tool switches, the selection check, hidden failures, and one pending list with monthly cost.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| Python | 3.8+ | Runs `ci_timings.py` and `shard_plan.py` (standard library only) | No |
| `gh` CLI | Any recent | Collecting GitHub Actions runs with your existing login | No |
| `kubectl` | Any recent | Collecting CI pod timings on Kubernetes or K3s | No |
| API token | - | Forgejo, Gitea, Woodpecker, GitLab, or Jenkins collection, read from environment variables | No |

| Platform | Python command |
|----------|----------------|
| macOS and Linux | `python3` |
| Windows | `python` or `py -3` |

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill fast-ci
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--scope user` to install for every project, and `--dry-run` to preview.

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

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/fast-ci` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/fast-ci .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\fast-ci .claude\skills\
```

Each agent has a short guide in `skills/fast-ci/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

## Quick Start

```text
Make this repo's CI as fast as possible without letting it lie.
```

The agent detects the CI system, audits the last 150 runs, fixes the biggest bucket first with one small measured change at a time, and writes a report with before and after numbers and a list of what needs an account, a secret, or a bigger bill.

## Usage

### Input

| Input | Required | Example |
|-------|:--------:|---------|
| Repository | Yes | The repository whose CI should get faster |
| CI access | No | `gh` login, a token in `FORGEJO_TOKEN`, `GITEA_TOKEN`, `WOODPECKER_TOKEN`, `GITLAB_TOKEN`, or `JENKINS_USER` and `JENKINS_TOKEN`, or a `kubectl` context; without it the audit times steps locally |
| Runner price | No | Price per minute, for the monthly cost |
| Permissions | No | Whether the agent may commit, push, open pull requests, or change settings |
| Budgets | No | Overrides such as a 45 s budget for an end-to-end job |

### Examples

```text
Our GitHub Actions CI takes 9 minutes. Get PRs under a minute.
```

```text
We run Woodpecker on a K3s cluster and pipelines wait 40 seconds to start. Fix it.
```

```text
Audit our Jenkins pipeline and tell me where the time and money go.
```

```text
Our CI is a Makefile on a build box. Make it fast and stop people skipping checks.
```

```text
Shard our tests by real time and prove every file still runs.
```

## How It Works

```text
  1. Rules and scope       CI system, runners, jobs, merge gate, hidden failures
          │
  2. Audit                 ci_timings.py: 150 runs, waiting / setup / running, p50 and p95
          │
  3. Waiting and setup     warm runners, cancel superseded runs, baked image, seeded caches
          │
  4. Tools                 fastest tools per job, each switch proven side by side
          │
  5. Tests and shards      isolation, random order, cores first, shard_plan.py, failure log
          │
  6. Selection and shape   parallel jobs, folded checks, diff selection, planted failure
          │
  7. Local and budgets     hooks under 9 s, jobs that fail over budget
          │
  8. Ship and report       one small PR per change, pending list with cost, before and after
```

## Reference

### ci_timings.py

```bash
python3 scripts/audit/ci_timings.py collect github --repo owner/app --event pull_request
python3 scripts/audit/ci_timings.py collect k8s --namespace ci --selector tekton.dev/pipelineRun --run-label tekton.dev/pipelineRun
python3 scripts/audit/ci_timings.py record --job lint --run r1 -- make lint
python3 scripts/audit/ci_timings.py analyze ~/.gti/fast-ci/app/timings/*.jsonl --price-per-minute 0.008
```

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `collect github` | Runs and jobs through `gh api` | `--repo`, `--limit` (150), `--branch`, `--event` |
| `collect gitea`, `collect forgejo` | Runs and jobs, or tasks on older servers | `--server`, `--repo`; token in `GITEA_TOKEN` or `FORGEJO_TOKEN` |
| `collect woodpecker` | Pipelines, workflows, and steps | `--server`, `--repo-id`; token in `WOODPECKER_TOKEN` |
| `collect gitlab` | Pipelines and jobs, including retried jobs | `--server`, `--gitlab-project`; token in `GITLAB_TOKEN` |
| `collect jenkins` | Builds through `wfapi/describe` | `--server`, `--job`; `JENKINS_USER` and `JENKINS_TOKEN` |
| `collect k8s`, `collect k3s` | CI pods: scheduling, image pull and init, containers | `--namespace` (`default`, or `all`), `--selector`, `--context`, `--run-label`, `--job-label`, `--file` |
| `record` | Times one command for manual CI and returns its exit code | `--job` (required), `--run`, `--setup`, `--out` |
| `analyze` | p50 and p95 per bucket and job, budgets, cost | `--budgets`, `--price-per-minute`, `--out` |

| Argument | Default | Description |
|----------|---------|-------------|
| `--project` | Git root folder name | Project folder under `~/.gti/fast-ci/`; goes before the subcommand |
| `--setup-pattern` | Checkout, set up, cache, install, restore, pull, and similar | Regex for step names counted as setup (`collect`) |
| `--out` | `~/.gti/fast-ci/<project>/timings/` or `audits/` | Output file (`collect`, `record`) or folder (`analyze`) |

### shard_plan.py

```bash
python3 scripts/shards/shard_plan.py plan --timings main-junit/*.xml --shards 4 --files "src/**/*.test.ts"
python3 scripts/shards/shard_plan.py list --timings main-junit/*.xml --shards 4 --index 2 --files "src/**/*.test.ts"
python3 scripts/shards/shard_plan.py verify --files "src/**/*.test.ts" --ran shard-*/junit.xml
```

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `plan` | Balance files across shards by recorded time and flag slow files | `--timings`, `--shards`, `--files`, `--split-over` (20), `--out` |
| `list` | Print one shard's files for the CI job; writes nothing | `--timings`, `--shards`, `--index` (1-based), `--files` |
| `verify` | Exit 1 when any expected test file is missing from every shard report | `--files`, `--ran` |

`--timings` and `--ran` take JUnit XML or a JSON map of file to seconds. `--files` takes globs, paths, or `@list.txt`.

### Reference files

| File | Contents |
|------|----------|
| `references/workflow/01-rules-and-scope.md` | The three rules, detecting the CI system, and what to record |
| `references/workflow/02-audit.md` | Collecting, analyzing, reading, and saving the baseline |
| `references/workflow/03-waiting-and-setup.md` | Warm runners, image pulls, cancelling, baked images, caches, clones |
| `references/workflow/04-tools.md` | Tool defaults and the side-by-side switch procedure |
| `references/workflow/05-tests-and-shards.md` | Isolation, random order, cores and shards, databases, the failure log |
| `references/workflow/06-selection-and-shape.md` | Parallel jobs, folded checks, diff selection, and the planted failure |
| `references/workflow/07-local-and-budgets.md` | Hooks and budgets that fail, per platform |
| `references/workflow/08-ship-and-report.md` | Small PRs, the pending list with cost, and the report |
| `references/platforms/*.md` | GitHub Actions, Forgejo and Gitea, Woodpecker, GitLab, Jenkins, Kubernetes and K3s, manual, and other systems |
| `references/stacks/toolchains.md` | Fast defaults per ecosystem |
| `references/quality/checklist.md` | The 41-item checklist |
| `references/quality/anti-patterns.md` | Speed-ups that make CI lie |

## Output

```markdown
# CI report: acme/app

## Before and after

| Metric | Before | After | Budget |
|--------|--------|-------|--------|
| PR time to result p50 | 8m40s | 52s | 60 s |
| Waiting p50 (critical path) | 25s | 3s | 5 s |

## Pending: needs the user

| Item | Fixes | Step for the user | Expected monthly cost (estimate) |
|------|-------|-------------------|----------------------------------|
| Warm runner vendor | waiting 25s to under 5s | Install the vendor's GitHub App | about $40 |
```

| Section | Contents |
|---------|----------|
| Summary | Time to result before and after, the biggest bucket, and what still needs the user |
| Before and after | Every budgeted metric, from real runs |
| Changes | One row per pull request or branch with its numbers |
| Tool switches | What the new tool missed and how the gap was closed |
| Selection check | Planted changes and whether CI went red |
| Hidden failures found | Retries, skips, and `allow_failure` with their status |
| Pending | Accounts, secrets, settings, and bills, with expected monthly cost |
| Checklist | The 41 items marked done, failing, not applicable, or not checked |
| Total CI time and cost | Before and after |

| Path | Contents |
|------|----------|
| `~/.gti/fast-ci/<project>/timings/` | Normalized timing rows |
| `~/.gti/fast-ci/<project>/audits/` | Analyses in Markdown and JSON |
| `~/.gti/fast-ci/<project>/shards/` | Shard plans |
| `~/.gti/fast-ci/<project>/failures.md` | The two-week failure log |
| `~/.gti/fast-ci/<project>/reports/` | Final reports |
| `~/.gti/fast-ci/<project>/state.md` | Baseline, change list, and history |

`GTI_HOME` replaces `~/.gti`.

## Security

- **Network:** `collect` sends read-only GET requests to the CI server you name, or runs `gh api` and `kubectl get pods`. Nothing else leaves the machine.
- **Tokens:** read from environment variables you already set; the skill never asks you to paste a token and never writes one to disk.
- **File access:** the scripts read the files you pass and write only under `~/.gti/fast-ci/` (or `--out`). `record` runs the command you give it.
- **Outward actions:** pushes, pull requests, runner vendor sign-ups, secrets, settings, and paid plans are listed as pending unless you asked for them.

## Development

| Command | Action |
|---------|--------|
| `python -m unittest discover -s skills/fast-ci/tests` | Runs the script tests with payloads shaped like each CI API, offline |
| `npm test` | Runs every test in the repository, including these |
| `node packages/cli build` | Regenerates the agent guides and validates the skill |

## Troubleshooting

<details>
<summary><strong>"gh CLI not found" or "gh api ... failed"</strong></summary>

The GitHub collector uses your `gh` login. Install the GitHub CLI and sign in, then run the collector again.

```bash
gh auth login
```

</details>

<details>
<summary><strong>HTTP 401 or 404 from Forgejo, Gitea, Woodpecker, GitLab, or Jenkins</strong></summary>

The token is missing, lacks read access to the repository, or the server path is wrong. Check that the environment variable is set in the same shell, that `--server` is the base URL without `/api`, and that the repository, repository id, project, or job path matches the URL in the web UI.

</details>

<details>
<summary><strong>Forgejo rows have no setup time</strong></summary>

Older Gitea and Forgejo versions only expose tasks, with no step detail. The rows are marked approximate and setup counts as running. Read setup from the job log, or time a few runs with `record`.

</details>

<details>
<summary><strong>The Kubernetes collector returns zero rows</strong></summary>

The selector matches no pods, or the controller already deleted finished pods. Check the labels with `kubectl get pods -n <namespace> --show-labels`, and collect soon after runs finish.

</details>

<details>
<summary><strong>shard_plan.py verify reports files that did run</strong></summary>

The JUnit reports name suites by something other than the file path (a describe block or a class name). Configure the reporter to write the file path (for example a `file` attribute or a suite name per file), or pass a JSON map of file to seconds.

</details>

<details>
<summary><strong>The agent does not see the skill</strong></summary>

Restart the agent session after installing, and confirm the folder is in the path your agent reads (see the table in [Installation](#installation)).

</details>

## Limitations

- The collectors read each platform's public API; fields change between server versions, and older versions give less detail (marked approximate).
- GitLab and Forgejo task rows have no step timing, so setup is not separated without the job log.
- Kubernetes timings exist only while pods are kept; most controllers delete them after a while.
- Budgets assume a stack that can meet them; some builds (large native or JVM builds) cannot, and the report says so with measurements.
- Cost estimates use the price you give and the run rate in the measured window; they are estimates, not bills.
- Tool defaults for JavaScript and TypeScript follow the source prompt; check each command exists in the installed version before switching.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [Pontus Abrahamsson on X: prompt to get your CI under 1 minute](https://x.com/pontusab/status/2123771160261529982) | Post on X | The three rules, the audit split, the budgets, the tool defaults, sharding, selection, hooks, and the report shape (extended to every CI platform) |

## License

No license has been declared for this skill yet. See the [root README](../../README.md#license).
