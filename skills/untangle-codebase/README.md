<div align="center">

# Untangle Codebase

> A codebase where a typical change lands in one place

**Runs one long, goal-driven refactor that lists every hidden link, needless link, surplus piece, and special case, redesigns from today's requirements, and fixes everything one verified commit at a time.**

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

Agents work worse in tangled code: they read more files per change, miss the copy that also needed editing, and chase symptoms instead of causes. Untangle Codebase asks one question of every pair of pieces, "should these change together?", and fixes every place the code answers it wrong: hidden links, needless links, surplus, and the special cases that reveal requirements the design never accounted for.

The skill is a port of the [untangle-codebase](https://github.com/caldoai/skills/tree/main/skills/untangle-codebase) skill by Caldo, kept close to its wording, split into workflow files, and extended with four helper scripts, a progress measure, safety guardrails for a long unattended refactor, and decision log and report templates.

```text
  /untangle-codebase [area]
     │
     v
  1 ask and prepare ── options, scope, public surfaces, branch, baseline tests, baseline counts
     │
  2 list every problem ── skeleton.py, deps.py, cochange.py, special_cases.py, sub-agent summaries
     │
  3 redesign ── one fix behind several problems, written above the problems it solves
     │
  4 fix ── one fix per commit, tests green after each
     │
  5 check ── fresh sub-agents hunt what is left ──> back to 2 until nothing worth fixing
     │
     v
  behavior check + before and after report (branch left for you to review)
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Refactor a whole codebase or one named area end to end, on its own branch | Pick a few candidates and write an advisory report (use Improve Codebase Architecture) |
| Remove special cases by finding the requirement behind them | Hunt for bugs separately, or add features |
| Keep behavior the same and prove it with the project's tests | Change public APIs, schemas, or CLI flags without approval |
| Measure progress with a special-case count, cycles, and volatile imports | Merge or push the branch |

## Features

- **One question, four kinds of problem:** hidden links, needless links, surplus, and special cases, each with concrete examples and evidence to look for.
- **Redesign before fixing:** fixes are worked out from today's requirements, and each one is written above the problems it solves.
- **Skeleton (added):** `skeleton.py` prints signatures, types, and class members without bodies, with line numbers, so the whole codebase fits in context.
- **Import graph with volatility (added):** `deps.py` resolves imports for Python, JS/TS, and Go, and flags cycles and imports of code that git shows changing more often.
- **Co-change history (added):** `cochange.py` lists files that change together across folders, the strongest hidden-link evidence.
- **Progress measure (added):** `special_cases.py` counts swallowed exceptions, sleeps, retries, disabled tests, literal branches, suppressions, and TODO markers, with a saved baseline and a compare mode.
- **Guardrails (added):** clean branch, baseline tests, characterization tests before moving untested code, one commit per fix, and an explicit list of surfaces that never change without asking.
- **Decision log (added):** a template the agent keeps current, so the run survives context compaction and a new session.
- **Optional cleanups:** remove comments that restate the code, and remove or rewrite tests that would not catch a real bug, only when the user chooses them.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| Git | Any recent | Branch, one commit per fix, and history for volatility and co-change | No |
| Python | 3.8+ | Runs the helper scripts, standard library only | No |
| Project test command | - | The safety net; without one the skill first adds characterization tests | No |
| Coding agent with sub-agents | - | Summaries and the fresh-eyes checks; without them the agent re-reads from the skeleton | No |

Use `python3` on macOS and Linux and `python` or `py -3` on Windows.

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill untangle-codebase
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

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/untangle-codebase` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/untangle-codebase .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\untangle-codebase .claude\skills\
```

Each agent has a short guide in `skills/untangle-codebase/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

## Quick Start

```text
/untangle-codebase
```

The agent asks whether to also clean up comments and tests, confirms the scope and the public surfaces it must not change, creates an `untangle/<date>` branch, records baseline tests and counts, and then lists, redesigns, and fixes until fresh sub-agents find nothing worth fixing.

## Usage

### Input

| Input | Required | Default | Description |
|-------|:--------:|---------|-------------|
| Area or concern | No | Whole repository | For example `/untangle-codebase billing` or "focus on the API layer" |
| Comments addition | No | Asked in step 1 | Remove comments that only restate the code |
| Tests addition | No | Asked in step 1 | Remove tests that would not catch a real bug, and fix the ones that fail without one |
| Public surfaces | No | Proposed by the agent | Surfaces that must not change shape without approval |
| Budget | No | None | Time or token limit; the agent finishes the current fix and reports what is left |

### Examples

```text
/untangle-codebase packages/editor
```

Untangles one package and its direct dependents, leaving the rest of the monorepo alone.

```text
Untangle this codebase end to end. Also do the Comments cleanup, but leave the tests alone.
```

Full run with the Comments addition; the existing tests stay as the safety net.

```text
Run the special-case count and dependency graph so I can see how tangled this is before we start.
```

Uses only the scripts from step 2 and reports the numbers, without changing code.

## How It Works

```text
  Step 1  git status clean? ──no──> stop and ask
          branch untangle/<date> ── baseline tests ── special_cases.py --save ── deps.py
                                                │
  Step 2  map: skeleton, imports, co-change, special-case list, sub-agent summaries
          list every problem with file:line and kind ──> .untangle/decision-log.md
                                                │
  Step 3  group by requirement ── one fix behind several problems ── order, risk, size
          public surface or product decision? ──> ask the user
                                                │
  Step 4  per fix: re-read ── cover with a test ── change ── verify ── commit ── log
                                                │
  Step 5  fresh sub-agents ── special_cases.py --compare ── issues left? ──yes──> step 2
                                                │ no
          behavior check ── .untangle/report.md ── summary in chat
```

## Reference

All scripts are read-only and take the codebase root as the first argument (default: current folder). Generated, vendored, build, and dependency folders are skipped.

### skeleton.py

```bash
python3 skills/untangle-codebase/scripts/map/skeleton.py . > .untangle/skeleton.txt
```

| Argument | Default | Description |
|----------|---------|-------------|
| `root` | `.` | Codebase root |
| `--body-depth` | `0` | Levels of function or block bodies to keep in brace languages |
| `--include-tests` | Off | Include test files |
| `--only` | All files | Glob of files to include, repeatable |
| `--ignore` | None | Extra glob to skip, repeatable |

### deps.py

```bash
python3 skills/untangle-codebase/scripts/map/deps.py . --depth 2
```

| Argument | Default | Description |
|----------|---------|-------------|
| `root` | `.` | Codebase root |
| `--depth` | `2` | Folder depth used to group files; `0` is one node per file |
| `--alias` | None | JS/TS import alias `PREFIX=FOLDER/`, for example `@/=src/`, repeatable |
| `--include-tests` | Off | Include test files in the graph |
| `--ignore` | None | Extra glob to skip, repeatable |
| `--commits` | `500` | Commits of history used for change counts |
| `--ratio` | `2.0` | How many times more often the imported group must change to be flagged |
| `--min-changes` | `5` | Ignore imported groups with fewer changes |
| `--top` | `15` | Rows per section in text output |
| `--edges` | Off | List every edge in text output |
| `--json` | Off | Print JSON |

### cochange.py

```bash
python3 skills/untangle-codebase/scripts/map/cochange.py . --cross-folder-only
```

| Argument | Default | Description |
|----------|---------|-------------|
| `root` | `.` | Codebase root inside a git repository |
| `--commits` | `1000` | Recent commits to read |
| `--since` | None | Only commits after this date, for example `6.months` |
| `--max-files` | `20` | Skip commits that touch more files than this |
| `--min-together` | `3` | Minimum commits a pair shares |
| `--min-confidence` | `0.5` | Shared commits divided by the changes of the less changed file |
| `--depth` | `2` | Folder depth that decides whether a pair is cross-folder |
| `--cross-folder-only` | Off | Only pairs in different folders |
| `--include-tests` | Off | Include test files |
| `--ignore` | None | Extra glob to skip, repeatable |
| `--top` | `30` | Rows in text output |
| `--json` | Off | Print JSON |

### special_cases.py

```bash
python3 skills/untangle-codebase/scripts/measure/special_cases.py . --save .untangle/baseline.json
python3 skills/untangle-codebase/scripts/measure/special_cases.py . --compare .untangle/baseline.json
```

| Argument | Default | Description |
|----------|---------|-------------|
| `root` | `.` | Codebase root |
| `--ignore` | None | Extra glob to skip, repeatable |
| `--save` | None | Write the full result as JSON (a baseline) |
| `--compare` | None | Baseline JSON written earlier with `--save` |
| `--list` | Off | List every location in text output |
| `--category` | All | Only list one of `swallowed_exception`, `sleep`, `retry`, `disabled_test`, `literal_branch`, `suppression`, `marker_comment` |
| `--top` | `15` | Files shown in text output |
| `--json` | Off | Print JSON |

`disabled_test` is counted in test files only; every other category in source files only.

## Output

The run writes everything to `.untangle/` in the project and commits the code changes to the `untangle/<date>` branch:

```text
.untangle/
├── decision-log.md     # problems, fixes, kept cases, open questions, progress
├── baseline.json       # special-case counts at the start
├── deps-before.json    # import graph at the start
├── skeleton.txt        # latest skeleton
└── report.md           # final report
```

Example `special_cases.py --compare` output:

```text
category                before   after   delta
swallowed_exception         13       2     -11
sleep                        4       0      -4
literal_branch             224      61    -163
total                      296      88    -208
```

| Section | Contents |
|---------|----------|
| Summary | Scope, branch, number of commits, status |
| Before and after | Special-case counts by category, cycles, volatile imports, test results |
| Main fixes | One line per fix with its commit |
| Special cases kept | What stays and the requirement behind it |
| Behavior check | Commands run, public surface comparison |
| Bugs fixed along the way | Each with the test that covers it |

## Development

| Command | Action |
|---------|--------|
| `python -m unittest discover -s skills/untangle-codebase/tests` | Run the script tests from the repository root |
| `npm run test:python` | Run every Python test in the repository, including these |
| `node packages/cli validate --skill untangle-codebase` | Check the skill against the repository rules |

## Troubleshooting

<details>
<summary><strong>The agent stops at the start and asks me to commit</strong></summary>

The working tree has uncommitted changes, and the skill never mixes your work with the refactor. Commit or stash them, then run the skill again.

</details>

<details>
<summary><strong>deps.py shows no edges</strong></summary>

Imports between files in the same group are not edges. Lower `--depth` (try `1` or `0`), and pass `--alias` for JS or TS path aliases such as `@/`. Languages other than Python, JS/TS, and Go are listed as unresolved.

</details>

<details>
<summary><strong>deps.py or cochange.py says there is no git history</strong></summary>

The folder is not inside a git repository, or git is not on PATH. Volatility and co-change need history; the rest of the workflow still works.

</details>

<details>
<summary><strong>special_cases.py reports hundreds of literal branches</strong></summary>

It counts textual signs, not real special cases. Read the list with `--list --category literal_branch`: an if-chain over the same values in two files is a hidden link, while a single parser switch is fine. Use the count to watch the trend, not as a target of zero.

</details>

<details>
<summary><strong>The run lost track after a long session</strong></summary>

Ask the agent to read `.untangle/decision-log.md` and `git log --oneline` on the untangle branch, then continue from the first unfinished step.

</details>

## Limitations

- A full untangle of a large codebase is long and costs many tokens. Scope it to an area first when in doubt.
- The skill is only as safe as the test suite. Without tests, it adds characterization tests first, which cannot capture every behavior.
- The scripts are heuristics: import resolution covers Python, JS/TS, and Go; the skeleton reads brace languages by brace depth; special-case markers are textual.
- Volatility and co-change depend on history; a young repository gives weak signals.
- Changes to public surfaces always wait for your approval, so some fixes may stay planned.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [Caldo skills: untangle-codebase](https://github.com/caldoai/skills/tree/main/skills/untangle-codebase) | MIT | The method, the four kinds of problem, the comment and test rules, the done criteria, and the decision log example |

## License

MIT, see [LICENSE](LICENSE). Copyright Maze for the upstream skill; the additions in this repository follow the same license.
