<div align="center">

# Improve Codebase Architecture

> Refactors worth doing, in a report anyone on the team can read

**Finds the refactors that make a codebase easier to change and test, starting where git history shows the most change, and presents them in an HTML report written in everyday coding terms.**

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
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Overview

Codebases collect thin wrappers that only forward calls, logic copied across callers, and modules that need three mocks to test one rule. Each one makes the next change slower. An agent can find them, but its findings are only useful if the team can read them.

This skill is adapted from Matt Pocock's `improve-codebase-architecture`. It keeps the analysis and the follow-up conversation, and replaces the design-book vocabulary (seam, deepening, leverage, locality, adapter) with the words developers use every day. The HTML report is rendered by a script from a JSON file, so every report has the same readable layout, and the script refuses jargon in `--strict` mode.

```text
  git history ──> hot spots ──> explore code ──> 3 to 6 candidates
                                                       │
                                                       v
                      report-data.json ──> render_report.py --strict ──> HTML report
                                                                              │
                                                    user picks a candidate <──┘
                                                       │
                                                       v
                         rounds of questions ──> agreed plan ──> GLOSSARY.md and ADRs updated
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Find refactors where code changes most | Fix bugs or review a single diff |
| Explain each one with files, numbers, and before and after diagrams | Use design-book jargon in the report |
| Work through the chosen refactor with the user | Change code before the user confirms the plan |
| Keep `GLOSSARY.md` and ADRs current as decisions are made | Require a glossary or ADRs to exist |

## Features

- **Hot spot scan:** `hotspots.py` ranks folders and files by recent commits, skipping lock files, build output, and vendored code.
- **Plain language:** a replacement table for every design-book term, and a jargon check in the report script.
- **Fixed report layout:** start-here box, summary table, hot spots, and one card per candidate with problem, change, gains, files, testing approach, effort, and before and after diagrams.
- **Report in the user's language:** English and Portuguese page labels built in, any label can be overridden.
- **Readable anywhere:** light and dark themes, works at phone width, and diagram source stays readable without network access.
- **Testing by dependency type:** each candidate says how to test it: pure code, a local stand-in, your own service, or a third-party API.
- **Guided follow-up:** numbered rounds of questions with a recommended answer each, until the plan is agreed.
- **Design options:** three or four very different API designs for the chosen refactor, with a recommendation.
- **Change report:** after the agreed refactor, a short message that says what is different for the user, replays their own example, names exactly where the change applies and where it does not, and states what was not verified and why.
- **Self-contained:** the companion skills of the original are folded into this folder.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| Git | Any recent | Commit history for the hot spot scan | No |
| Python | 3.8+ | Runs the scripts, standard library only | No |
| Browser | Any recent | Opens the report; loads Mermaid 11.4.1 from jsDelivr for diagrams | No |

Use `python3` on macOS and Linux and `python` or `py -3` on Windows.

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill improve-codebase-architecture
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--pack coding` to install it with its pack, `--scope user` to install for every project, and `--dry-run` to preview.

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

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/improve-codebase-architecture` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/improve-codebase-architecture .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\improve-codebase-architecture .claude\skills\
```

Each agent has a short guide in `skills/improve-codebase-architecture/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

## Quick Start

```text
Our backend is getting hard to change. Where should we refactor first?
```

The agent finds the folders that change most, explores them, opens an HTML report with three to six refactor candidates, and asks which one you want to work through.

## Usage

### Input

| Input | Required | Example |
|-------|:--------:|---------|
| Repository | Yes | The current git repository |
| Target area | No | "Only `src/billing`", "adding a payment method is painful" |
| Glossary and ADRs | No | `GLOSSARY.md`, `docs/adr/*.md`; read when present |
| Chosen candidate | After the report | "The second one" |

### Examples

```text
Review the architecture of src/orders and tell me what to merge or split.
```

```text
Our tests mock everything and still miss bugs. Which modules have the wrong shape?
```

```text
Find refactors that would make this repo easier for agents to navigate.
```

```text
Let's do candidate 1. Show me three different API designs first.
```

## How It Works

```text
  1. Scope         user target, or hotspots.py; read GLOSSARY.md and ADRs
          │
  2. Explore       subagent walks the code; 3 to 6 candidates with numbers
          │
  3. Report        report-data.json ──> render_report.py --strict --open
          │
  4. Discuss       rounds of questions with recommended answers
          │
  5. Options       optional: 3 or 4 API designs, one recommendation
          │
  6. Implement     after the user confirms the plan: change the code, then a short report
                   (what changed, the user's own example, where it applies, what was not verified)
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

### render_report.py

```bash
python3 scripts/report/render_report.py architecture-review.json --strict --open
```

| Argument | Default | Description |
|----------|---------|-------------|
| `data` | - | Report data JSON file |
| `--out` | OS temp folder, `architecture-review-<timestamp>.html` | Output HTML path |
| `--strict` | Off | Exit with code 3 instead of writing when jargon is found |
| `--open` | Off | Open the report in the default browser after writing |

The data format is documented in `references/workflow/03-report.md`, with a full example in `assets/templates/report-data.example.json`.

### Reference files

| File | Purpose | Used in |
|------|---------|---------|
| `references/workflow/01-scope.md` | Choosing where to look, hot spots | Step 1 |
| `references/workflow/02-explore.md` | Questions to answer and what to record per candidate | Step 2 |
| `references/workflow/03-report.md` | Data fields, language, diagrams, rendering | Step 3 |
| `references/workflow/04-discuss.md` | Rounds of questions, glossary and ADR updates | Step 4 |
| `references/workflow/05-design-options.md` | Several API designs and a recommendation | Step 5 |
| `references/workflow/06-implement-and-report.md` | Implementing the agreed plan and the four-part change report | Step 6 |
| `references/concepts/module-design.md` | Small API with logic inside, the merge test | Steps 2 to 5 |
| `references/concepts/plain-language.md` | Banned jargon and plain replacements | Steps 3 and 4 |
| `references/concepts/testing-by-dependency.md` | Testing approach per dependency type | Steps 2 and 4 |
| `references/concepts/project-docs.md` | `GLOSSARY.md` and ADR formats | Steps 1 and 4 |
| `references/quality/report-checklist.md` | Checks before rendering | Step 3 |

## Output

Each candidate card in the report shows:

```text
  1. Merge the order validation helpers into OrderIntake.submit()
  [Strong] [Effort: Medium] [Testing: Local stand-in]

  What's wrong today                 What to change
  OrderHandler calls four helpers    Create OrderIntake.submit(order) that
  in a fixed order, and every        validates and saves in one call.
  route repeats that order.

  [ Before diagram ]                 [ After diagram ]

  What gets better                   Files involved
  - A new order field touches        src/orders/OrderHandler.ts
    1 file instead of 5              src/orders/OrderValidator.ts
  - Tests call submit() with SQLite  How to test it
    instead of mocking 3 classes     Run a local replacement such as SQLite...
```

| Section | Contents |
|---------|----------|
| Header | Repository, date, candidate count, and scope |
| Start here | The candidate to do first and why |
| All candidates | Title, recommendation, effort, and file count per candidate |
| Where the code changes most | Hot spot table from git history, when provided |
| Details | One card per candidate: problem, change, before and after diagrams, gains, files, testing approach, ADR warning |

The report is written to the OS temp folder; nothing is written to the repository until the user confirms a plan.

## Development

| Command | Action |
|---------|--------|
| `python -m unittest discover -s skills/improve-codebase-architecture/tests` | Runs the script tests |
| `npm test` | Runs every CLI and Python test in the repository, including these |
| `node packages/cli build` | Regenerates the agent guides and validates the skill |

## Troubleshooting

<details>
<summary><strong>The agent does not see the skill</strong></summary>

Restart the agent session after installing, and confirm the folder is in the path your agent reads (see the table in [Installation](#installation)).

</details>

<details>
<summary><strong>The diagrams show as plain text</strong></summary>

The report loads Mermaid from jsDelivr, and the browser could not reach it. Open the report with network access; the diagram source stays readable meanwhile.

</details>

<details>
<summary><strong>"jargon: 'seam' in ..." and exit code 3</strong></summary>

`--strict` found a design-book word in the report text. Replace it with the suggested word printed next to it, then run the script again.

</details>

<details>
<summary><strong>The hot spot list is full of generated files</strong></summary>

Skip them with `--ignore`, for example `--ignore "src/generated/*"`. The flag can be repeated.

</details>

<details>
<summary><strong>The report labels are in the wrong language</strong></summary>

Set `"lang": "pt"` or `"lang": "en"` in the data file. For other languages, keep `en` and translate the labels in a `labels` object.

</details>

## Limitations

- The analysis depends on the agent's reading of the code; numbers in the report are counted by the agent, not measured by a tool.
- The hot spot scan uses commit counts only. Large but rare changes and code ownership are not considered.
- Diagrams need network access to render, because Mermaid is loaded from a CDN.
- Page labels are built in for English and Portuguese only; other languages need a `labels` object.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [mattpocock/skills: improve-codebase-architecture](https://github.com/mattpocock/skills/tree/main/skills/engineering/improve-codebase-architecture) | MIT | Source of the workflow, adapted with plain language and a new report |
| [mattpocock/skills: codebase-design, grilling, domain-modeling](https://github.com/mattpocock/skills) | MIT | Module design principles, question rounds, glossary and ADR formats, folded into this skill |
| [Mermaid](https://github.com/mermaid-js/mermaid) | MIT | Before and after diagrams in the report |

## License

MIT, see [LICENSE](LICENSE). The original work is copyright Matt Pocock.
