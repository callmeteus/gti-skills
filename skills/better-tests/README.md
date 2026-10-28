<div align="center">

# Better Tests

> Tests that catch bugs instead of locking in code

**Makes coding agents write behavior-first tests with real dependencies, reproduce bugs before fixing them, prove tests fail with mutation testing, and prune brittle suites.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Runtime](https://img.shields.io/badge/runtime-none-blue.svg)](#requirements)
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
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Overview

Agents write many tests, and most of them mock every collaborator, assert on internal calls, and recompute expected values with the code's own formula. Those tests pass on day one, break on every refactor, cost tokens and CI time, and catch few real bugs. Some teams have responded by deleting large parts of their unit test suites.

Better Tests gives an agent eight rules and a workflow in three modes: write tests for new code, fix a bug starting from a failing test, and audit or prune an existing suite. Every new test is proven to fail when the behavior breaks, and the suite is measured by the bugs it catches, not by its size or line coverage.

```text
  request
     │
     v
  discover stack, helpers, public surface ──> references/workflow/01-discover.md
     │
     ├── write tests ──> choose level ──> write with the eight rules
     ├── fix a bug ────> failing test first ──> smallest fix
     └── audit ────────> classify ──> replace ──> delete with approval
     │
     v
  verify: break on purpose, mutation and property-based testing
     │
     v
  test report (behaviors, dependencies, verification, audit numbers)
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Write API, integration, user-flow, and unit tests through the public surface | Load, performance, or security testing |
| Replace mocks of owned code with real dependencies and Testcontainers | Set up CI pipelines on its own |
| Reproduce bugs in a failing test before fixing them | Delete tests without replacement coverage and approval |
| Run mutation and property-based testing to find missing tests | Install tools without asking |

## Features

- **Eight rules:** avoid mocks, Testcontainers for integration, couple to public APIs, failing test before a fix, no logic in tests, mutation and property-based testing, Playwright for user flows, and user-visible assertions.
- **Three modes:** write tests, fix a bug, and audit or prune a suite, each with its own steps.
- **Level selection:** a table and signals for choosing user flow, API, or unit level per behavior.
- **Proof of value:** every new test is seen failing, and mutation testing finds assertions that are missing.
- **Safe pruning:** replacement tests first, seeded bugs to compare, deletion only with approval, before and after numbers.
- **Anti-pattern checklist:** used to review new tests and classify existing ones.
- **Language agnostic:** tool tables for JavaScript, TypeScript, Python, Java, Go, Rust, C#, and PHP.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| None | - | The skill is instructions and reference files only | - |
| Docker | Any recent | Testcontainers integration tests | No |
| Playwright | Any recent | User-flow tests and the Playwright MCP server | No |
| Mutation or property-based tool | Per language | Verify step, for example Stryker, PIT, mutmut, fast-check, Hypothesis | No |

The optional tools are used only when the project has them or the user approves installing them.

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill better-tests
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

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/better-tests` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/better-tests .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\better-tests .claude\skills\
```

Each agent has a short guide in `skills/better-tests/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

## Quick Start

```text
Add tests for the POST /orders endpoint in src/routes/orders.ts.
```

The agent finds the test runner and existing helpers, writes HTTP-level tests against a real database container, breaks the code on purpose to see the tests fail, and returns a report of the behaviors covered and how they were verified.

## Usage

### Input

| Input | Required | Example |
|-------|:--------:|---------|
| Target | Yes | A feature, endpoint, module, bug report, or test folder |
| Mode | No | Write tests, fix a bug, or audit; inferred from the request |
| Allowed tools | No | "You may install Stryker", "no Docker on this machine" |
| Scope limits | No | "Only the billing module", "report only, do not delete" |

### Examples

```text
Write tests for the invoice PDF export. Use the real Postgres, not mocks.
```

```text
Users get logged out after changing their password on mobile. Reproduce it in a test, then fix it.
```

```text
Our test suite takes 14 minutes and breaks on every refactor. Audit tests/unit and tell me what to cut.
```

```text
Run mutation testing on src/pricing and add the missing tests.
```

## How It Works

```text
  1. Discover        runner, helpers, containers, public surface
          │
  2. Choose level    user flow, API or integration, unit for pure logic
          │
  3. Write           eight rules; failing test first for a bug
          │
  4. Verify          break on purpose, mutation, property-based
          │
  5. Audit (opt.)    classify, replace, delete with approval
          │
  6. Report          behaviors, dependencies, verification, numbers
```

## Reference

### Reference files

The agent reads a file only when a step needs it.

| File | Purpose | Used in |
|------|---------|---------|
| `references/workflow/01-discover.md` | Finding the stack, helpers, and public surface | All modes |
| `references/workflow/02-choose-level.md` | Choosing user flow, API, or unit per behavior | Write tests |
| `references/workflow/03-reproduce-bug.md` | Failing test before a fix | Fix a bug |
| `references/workflow/04-verify.md` | Break on purpose, mutation and property-based tools per language | Write tests, fix a bug |
| `references/workflow/05-audit-and-prune.md` | Measuring, classifying, and pruning a suite | Audit |
| `references/rules/dependencies.md` | Mocks, fakes, Testcontainers, time, and randomness | Write tests, audit |
| `references/rules/user-flows.md` | Playwright and the Playwright MCP server | Write tests |
| `references/quality/anti-patterns.md` | Checklist mapped to the eight rules | Review and audit |

### Repository commands

Validate the skill and regenerate its agent guides after editing it:

```bash
node packages/cli validate
node packages/cli build
```

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `node packages/cli validate` | Checks every skill against the standard | None |
| `node packages/cli build` | Regenerates `harnesses/<id>/GUIDE.md` and validates | None |
| `node packages/cli install` | Installs the skill into agents | `--harness`, `--skill`, `--scope`, `--dest`, `--dry-run` |

## Output

````markdown
# Test report: checkout coupon total

## Summary

- **Mode:** fix a bug
- **Stack:** Vitest, Testcontainers postgres:16
- **Scope:** src/checkout

## Bug reproduction

- **Report:** coupon SAVE10 plus free shipping on a 100.00 cart
- **Failing before the fix:** expected 95.00, received 105.00
- **Passing after the fix:** npm test -- checkout, 42 passed
- **Root cause and fix:** shipping was added after the discount; src/checkout/total.ts
````

| Section | Contents |
|---------|----------|
| Summary | Mode, stack, and scope |
| Behaviors covered | Each behavior with its level and test |
| Bug reproduction | The failing and passing runs, root cause, and fix |
| Dependencies | How each dependency runs in tests and why |
| Verification | Break on purpose, mutation score, properties |
| Audit | Before and after numbers and the classification of each file |
| Not covered | Gaps and follow-up work |

The template is `assets/templates/test-report.md`.

## Troubleshooting

<details>
<summary><strong>The agent does not see the skill</strong></summary>

Restart the agent session after installing, and confirm the folder is in the path your agent reads (see the table in [Installation](#installation)).

</details>

<details>
<summary><strong>Integration tests fail because Docker is not running</strong></summary>

Testcontainers needs a Docker compatible runtime. Start Docker and rerun, or tell the agent that Docker is not available; it then asks before using an in-memory substitute and lists what that substitute cannot check.

</details>

<details>
<summary><strong>Mutation testing takes too long</strong></summary>

The skill scopes mutation runs to the changed files or package. Name a smaller scope in the request, for example "mutation test only src/pricing".

</details>

<details>
<summary><strong>The agent wants to delete many tests</strong></summary>

The audit mode only proposes deletions after writing replacement tests. Review the file list in the report and approve or reject each entry; nothing is deleted without approval.

</details>

## Limitations

- The rules come from short posts, not from a measured study. The audit mode treats the claim that unit tests lock in slop code as a hypothesis and checks it with seeded bugs.
- Mutation and property-based testing depend on a tool for the project's language; without one, the verify step is limited to breaking the code by hand.
- User-flow tests need a running app and a browser; the skill does not provision environments.
- Unit tests stay the right choice for dense pure logic; the skill does not remove them by level alone.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [Daniel Moka: 8 tips to make your AI agents write better tests](https://x.com/dmokafa/status/2114977298122244116) | Standard X post terms | Source of the eight rules |
| [Sherwood Callaway: deleting 800k lines of unit tests](https://x.com/shcallaway/status/2106142042405453879) | Standard X post terms | Motivation for the audit and prune mode |

## License

No license has been declared for this skill yet. See the [root README](../../README.md#license).
