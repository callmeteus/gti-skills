<div align="center">

# Security Audit

> Source-grounded vulnerabilities, independently verified, with the smallest fix

**Turns a coding agent into a defensive security auditor that maps trust boundaries, hunts with isolated agents, tries to disprove every candidate, and reports only what the evidence supports.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Node.js](https://img.shields.io/badge/node-18%2B-blue.svg)](#requirements)
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

Agents asked to "find vulnerabilities" tend to return checklists: missing headers, outdated dependencies, and generic advice with no attacker and no damage. Owners then spend their time disproving noise. Security Audit holds every candidate to one bar: a named lower-trust principal, a crossed trust boundary, and a concrete result, shown from source and, when a sandbox is available, a bounded local check.

The skill is a port of Cloudflare's [security-audit-skill](https://github.com/cloudflare/security-audit-skill), the starting point of their vulnerability discovery harness, reorganized into this repository's layout and extended with a diff review mode, a single-agent mode, a stack inventory script, a SARIF exporter, report templates, evidence hygiene rules, and Windows support for the validators.

```text
  request
     │
     ├── question or focused review ──> guidance mode (answer in chat)
     ├── PR, branch, or commit range ─> diff review mode (answer in chat)
     └── full audit ──────────────────> six phases, files in the output directory
                                          │
     detect-stack.cjs ──> 1 reconnaissance ──> coverage-ledger.json
                          2 hunting waves (isolated agents, coverage critics)
                          3 fresh verifier per candidate
                          4 findings.json ──> validate-findings.cjs
                          5 fresh verifier per final record
                          6 REPORT.md, FINDINGS-DETAIL.md, NEEDS-VALIDATION.md
                                          └──> findings-to-sarif.cjs (optional)
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Review source for trust-boundary failures across web, API, client, AI, RPC, data, native, supply chain, cloud, availability, and desktop or mobile code | Probe deployed endpoints, scan hosts or networks, or test production |
| Run target code only inside an OS-enforced sandbox with no network | Run target code when the sandbox controls are missing |
| Keep three verdicts apart: `confirmed`, `needs_validation`, `rejected` | Give severity to an unproven lead |
| Write a validated `findings.json`, a coverage ledger, Markdown reports, and SARIF | Edit target source during the audit |
| Hand confirmed findings to a test-first fix workflow when asked | Write weaponized exploits or persistence material |

## Features

- **Three modes:** guidance for questions and focused reviews, diff review for a PR or branch, and a full six-phase audit that writes files only when asked.
- **Coverage ledger:** every surface, boundary, subsystem, and attack class becomes a deterministic unit, so runs are countable, repeatable, and additive across runs.
- **Adversarial validation:** a fresh agent that did not find the candidate tries to refute it, and a second fresh agent checks each final record.
- **Ten domain companions:** web protocol and auth, client side, AI and LLM, RPC and messaging, data isolation, memory safety, supply chain, cloud, resource exhaustion, and desktop, mobile, and local IPC.
- **Run profiles and budgets:** `quick`, `standard`, and `deep`, scoped runs, and a strict agent budget that reserves critics and verifiers before hunting.
- **Diff review mode (added):** applies the same evidence bar to changed code, its callers, and parallel paths, with optional review comments.
- **Single-agent mode (added):** keeps "the finder never confirms" in agents without sub-agents by writing verification packets for a separate session.
- **Stack inventory (added):** `detect-stack.cjs` lists languages, manifests, companions worth checking, and security tools on PATH, without running anything.
- **SARIF export (added):** `findings-to-sarif.cjs` turns validated findings into SARIF 2.1.0 with GitHub security-severity, code flows, and stable fingerprints.
- **Evidence hygiene (added):** secrets are recorded by location and fingerprint only, and scanner output is treated as a lead, never as a finding.
- **Windows validators (added):** the upstream validators refused every input on Windows; they now open input safely there with a link check and file identity re-check.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| Node.js | 18 or later | Validators, stack inventory, SARIF export | No |
| Git | Any recent | Source ref, diff review, history checks | No |
| Coding agent with sub-agents | - | Isolated hunters and verifiers in a full audit; without them the skill uses single-agent mode | No |
| OS-enforced sandbox | - | Running target builds, tests, or fixtures with no network, an allowlisted environment, read-only source, scratch-only writes, and resource limits | No |
| Local scanners | Any | Optional lead generators, for example Semgrep, Gitleaks, OSV-Scanner, Trivy | No |

| Platform | Notes |
|----------|-------|
| macOS and Linux | Validators open input with `O_NOFOLLOW` and `O_NONBLOCK`. Sandboxes such as `bwrap`, `nsjail`, `sandbox-exec`, or containers with no network can satisfy the execution rules. |
| Windows | Validators use a link check plus a device and file ID re-check. A container or VM with no network is the practical sandbox; without one the audit stays source-only. |

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill security-audit
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--scope user` to install for every project, and `--dry-run` to preview. The skill is also in the `coding` pack (`--pack coding`).

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

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/security-audit` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/security-audit .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\security-audit .claude\skills\
```

Each agent has a short guide in `skills/security-audit/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

## Quick Start

```text
Run a quick security audit of this repository and write the report to ~/audits/my-api.
```

The agent resolves the source ref and output directory, inventories the stack, maps trust boundaries into a coverage ledger, hunts with isolated agents, has fresh agents try to disprove each candidate, validates `findings.json`, and writes `REPORT.md`, `FINDINGS-DETAIL.md`, and `NEEDS-VALIDATION.md`.

## Usage

### Input

| Input | Required | Default | Description |
|-------|:--------:|---------|-------------|
| Target | Yes | Current repository | Repository root to review |
| Mode | No | Inferred from the request | Guidance, diff review, or full audit; the agent asks when unclear |
| Output directory | No | `~/security-audit-skill/<repo-name>/run-<N>` | Full audit only; must be outside the target unless version control ignores it |
| Profile | No | `standard` | `quick`, `standard`, or `deep` |
| Scope | No | Whole repository | Paths, one subsystem, one companion domain, or two source refs |
| Budget | No | None | Maximum agent invocations for the run |
| Base ref | No | Default branch | Diff review only |
| SARIF | No | Off | Ask for "SARIF" or "code scanning" to export `findings.sarif` |

### Examples

```text
Is this JWT verification in src/auth/token.ts safe?
```

Guidance mode: the agent reads the code path and answers in chat, with no files written.

```text
Review my branch against main for security issues before I open the PR.
```

Diff review mode: the agent reviews changed paths, their callers, and sibling routes, and answers with findings, leads, and suggested patches.

```text
Do a deep security audit of packages/billing with a budget of 40 agents and export SARIF.
```

Full audit, `deep` profile, scoped to one package, with a strict budget and `findings.sarif` for code scanning.

```text
Fix the high findings from the last audit.
```

After the audit: the agent fixes one fingerprint at a time, writing the regression test first.

## How It Works

```text
  1. Reconnaissance
     detect-stack.cjs inventory ──> 4 research agents (stack, principals, surfaces, local execution)
     ──> architecture.md (about 1,000 words) + coverage-ledger.json (validated)
                  │
  2. Hunting waves
     planned units ──> isolated hunters (one JSON result each) ──> ledger update (validated)
     ──> coverage critic ──> next wave or clean pass
                  │
  3. Candidate validation
     one fresh verifier per candidate tries to refute it ──> confirmed | needs_validation | rejected
                  │
  4. Structured output
     findings.json ──> validate-findings.cjs + validate-coverage-ledger.cjs
                  │
  5. Record verification
     one fresh verifier per final record ──> verified | replace (material changes re-verified)
                  │
  6. Reports
     REPORT.md, FINDINGS-DETAIL.md, NEEDS-VALIDATION.md ──> findings.sarif (optional)
```

The run ends either with every artifact written and both validators passing, or with `run_status: "incomplete"` and the exact reason disclosed in the report.

## Reference

### validate-findings.cjs

```bash
node skills/security-audit/scripts/validate/validate-findings.cjs <output-dir>/findings.json
```

| Argument | Default | Description |
|----------|---------|-------------|
| `<findings.json>` | Required | File to check against `assets/schema/report-schema.json` plus semantic rules (sorted unique fingerprints, severity no higher than impact, safe relative paths). Rejects input over 5 MiB, 1,000 findings, or 64 nesting levels. Exit 0 on pass, 1 on any error. |

### validate-coverage-ledger.cjs

```bash
node skills/security-audit/scripts/validate/validate-coverage-ledger.cjs <output-dir>/coverage-ledger.json
```

| Argument | Default | Description |
|----------|---------|-------------|
| `<coverage-ledger.json>` | Required | Ledger to check: canonical coverage IDs, state table invariants, agent IDs, check ownership, and artifact paths. Rejects input over 5 MiB, 10,000 units, or 64 nesting levels. Exit 0 on pass, 1 on any error. |

### detect-stack.cjs

```bash
node skills/security-audit/scripts/recon/detect-stack.cjs <target-dir> --format text
```

| Argument | Default | Description |
|----------|---------|-------------|
| `<target-dir>` | Required | Repository root to inventory. Symlinks are not followed; `node_modules`, `vendor`, build output, and VCS folders are skipped. |
| `--format` | `json` | `json` or `text` |
| `--max-files` | `50000` | Stop after this many files and set `truncated` |

### findings-to-sarif.cjs

```bash
node skills/security-audit/scripts/export/findings-to-sarif.cjs <output-dir>/findings.json --out <output-dir>/findings.sarif
```

| Argument | Default | Description |
|----------|---------|-------------|
| `<findings.json>` | Required | Must pass `validate-findings.cjs`; an invalid file is refused, never repaired |
| `--out` | stdout | Write to a new file; an existing file is never overwritten |
| `--include-needs-validation` | Off | Add unresolved leads as `note` results with kind `review` and no severity |

Severity maps to GitHub `security-severity` as critical 9.5, high 8.0, medium 5.5, low 3.0, informational 0.0. `rejected` records are never exported.

## Output

A full audit writes this layout:

```text
~/security-audit-skill/<repo-name>/run-<N>/
├── run-metadata.json        # profile, scope, budget, source ref, run_status
├── architecture.md          # principals, boundaries, surfaces, companion selection
├── coverage-ledger.json     # one unit per surface x boundary x subsystem x class
├── findings.json            # confirmed, needs_validation, rejected records
├── REPORT.md
├── FINDINGS-DETAIL.md
├── NEEDS-VALIDATION.md
├── findings.sarif           # optional
└── agents/<agent-id>/{scratch,artifacts}/
```

Example `REPORT.md` excerpt:

```text
| Severity | Title                                  | Affected boundary   | Observed result                          |
|----------|----------------------------------------|---------------------|------------------------------------------|
| high     | Missing ownership check on order update| Per-object owner    | Dummy user 1 changed dummy user 2's order |
```

| Section | Contents |
|---------|----------|
| Run | Profile, scope, budget, source ref, execution policy, prior runs, scanners, partial-pass statement |
| Security posture | One short summary |
| Confirmed findings | Table, then per finding: location, principal, bounded reproduction, conditions, result, impact, priority, fix |
| Needs validation | Leads with the exact blocker and safe local or owner-observed checks, no severity |
| Hardening notes and positive patterns | Kept apart from findings |
| Coverage | Ledger state counts, exclusions, and the final critic result |

## Security

- **Network:** the workflow forbids contacting deployed endpoints, external services, registries, and cloud APIs. Target code runs only in a sandbox with no external network.
- **Tokens and secrets:** reproductions use dummy principals and secrets. Discovered secrets are recorded by file, line, type, and a short fingerprint, never by value.
- **File access:** source is read-only. Writes go to the output directory outside the target; each agent writes only its own `scratch/`, and only trusted parent-side code promotes evidence into `artifacts/`.
- **Scripts:** the four bundled scripts read files, never execute target code, and never use the network. `detect-stack.cjs` checks PATH for tools but does not run them.

## Development

| Command | Action |
|---------|--------|
| `npm run test:skills` | Run the validator, inventory, and SARIF tests from the repository root |
| `node --test skills/security-audit/tests/` | Same, from the root without npm |
| `node packages/cli validate --skill security-audit` | Check the skill against the repository rules |

## Troubleshooting

<details>
<summary><strong>The agent answers in chat instead of running a full audit</strong></summary>

Loading the skill defaults to guidance mode. Ask explicitly for a "full security audit" or for report files, or name a profile such as "quick security audit".

</details>

<details>
<summary><strong>Every finding is "needs validation"</strong></summary>

The agent could not run target code because a sandbox control was missing, or the decisive fact lives in deployment configuration. Read the blockers in `NEEDS-VALIDATION.md`; provide a sandbox (for example a container with `--network none`) or answer the owner-observed checks and re-run.

</details>

<details>
<summary><strong>The validator prints "OS no-follow and nonblocking input protection is unavailable"</strong></summary>

You are running the original upstream validator, or a platform other than macOS, Linux, or Windows. Use the copy in `scripts/validate/` of this skill, which supports Windows.

</details>

<details>
<summary><strong>The agent has no sub-agents</strong></summary>

The skill switches to single-agent mode. A full audit then stops after hunting with `run_status: "incomplete"` and writes verification packets. Open a new session, load the skill, and ask it to verify the packets in the run's `verification/` folder.

</details>

<details>
<summary><strong>The budget runs out before validation</strong></summary>

The run is marked incomplete with `validation_budget_exhausted` and the unvalidated fingerprints are listed. Re-run with a larger budget, a `quick` profile, or a narrower scope; the prior-run logic picks up the open candidates.

</details>

## Limitations

- One run does not exhaust a target. Upstream reports that a single run found roughly half of what repeated runs found in total.
- The full audit is designed for agents with isolated sub-agents; single-agent mode needs a second session for independent verification.
- Deployment facts (proxy behavior, IAM, CDN keys, identity policy) are outside source and stay `needs_validation` until an owner checks them.
- Bounded local evidence needs an OS-enforced sandbox the skill does not provision.
- `detect-stack.cjs` is a heuristic over file names and manifests; it suggests companions to check and never decides scope.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [Cloudflare security-audit-skill](https://github.com/cloudflare/security-audit-skill) | MIT | Workflow, attack classes, domain companions, schema, validators, and their tests |
| [Build your own vulnerability harness (Cloudflare blog)](https://blog.cloudflare.com/build-your-own-vulnerability-harness) | Blog post | Background on the harness this skill seeded |

## License

MIT, see [LICENSE](LICENSE). Copyright Cloudflare, Inc. for the upstream workflow, references, schema, and validators; the additions in this repository follow the same license.
