<div align="center">

# Skill Distill

> A frontier session turned into a skill a local model can follow

**Turns a good coding-agent session into a skill for an open-weight model, and tests it on that model in a loop until the result matches the original.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Python](https://img.shields.io/badge/python-3.10%2B-blue.svg)](#requirements)
[![Agents](https://img.shields.io/badge/agents-10%20supported-8A63D2.svg)](#installation)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20WSL-lightgrey.svg)](#requirements)
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

A frontier model did a task well. An open-weight model running locally could often do the same task, if it had the right instructions, but a skill written from memory is rarely right the first time: the weaker model skips steps, misuses its harness, stops early, or claims success without checking.

Skill Distill makes the current agent the **teacher**. At the end of a good session, the user names a **student** (a harness plus a model, for example omp with DeepSeek-V4.1-Flash). The teacher writes a skill from the session, runs the student three times on fresh copies of the starting state with the original prompt, compares each result with the reference, fixes the skill at the first place the student went wrong, and repeats. The user makes the final call from a side-by-side report.

```text
  reference session ──> reference.md, acceptance.md, checks.sh (pass on the reference)
          │
          v
  student skill v1 ──> 3 trials in tmux (fresh clone, same prompt, skill only)
          ^                      │
          │                      v
   fix at the first    evidence: trace, files, diff, checks, screenshots
   divergence  <────── verdict per trial: match, close, miss, broken
                                 │
                                 v  all 3 match, or 8 iterations, or 3 with no gain
                      report.html ──> user: pass or fail ──> final skill
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Turn a finished Claude Code, Codex, or omp session into a tested skill for another model and harness | Write a general-purpose skill with no reference session |
| Run the student headless in tmux, three trials per version, and keep a ledger of verdicts | Fine-tune or change model weights |
| Snapshot an uncommitted starting state without touching the user's repository | Hand the student the finished output or a script that writes it |
| Write a side-by-side HTML report for the user's pass or fail call | Decide pass or fail on the user's behalf |

## Features

- **Teacher and student loop:** write, run, judge, fix, rerun, with stop rules at 3 matching trials, 8 iterations, or 3 iterations without a better score.
- **Clean trials:** every trial gets a fresh clone of the starting state, a frozen copy of the skill in `.skill/<name>/`, and the original prompt plus one pointer line. Nothing else.
- **Any harness as the student:** omp, pi, Codex CLI, Claude Code, OpenCode, Cursor, Kilo, Cline, and Command Code through the shared [agent runner](../../packages/python/agent-runner/README.md), plus any adapter script you pass by path. Optional flags are checked against the installed CLI's help.
- **Smoke test:** checks the student model answers through the same runner command the trials use, so a wrong model id does not look like a skill failure.
- **Session extraction:** turns Claude Code, Codex, `codex exec --json`, omp, and pi logs into a readable reference and drops system and instruction-file text.
- **Checks proven on the reference:** a check that fails on the reference is a broken check; the run refuses to judge trials until it passes.
- **Web capture:** serves a web app, drives it in headless Chromium with a list of actions, and saves screenshots and errors.
- **Judging guidance:** first divergence, full-resolution craft comparison, state probes, and distrust of the student's own report.
- **Worktree snapshot (added):** `--base <repo>@worktree` captures uncommitted changes inside the run folder instead of a throwaway branch in the user's repository.
- **Doctor (added):** lists missing tools with the install command for the platform.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| Python | 3.10+ | The run manager and scripts | No |
| git | Any recent | Starting states and diffs | No |
| tmux | Any recent | Runs the trials so they can be watched | No |
| bash | Any recent | The trial scripts and custom adapters | No |
| A student harness | Current | Any harness in `scripts/agent/harnesses.json`, pointed at its model | No |
| Playwright and Pillow | Current | Only for web results, through `capture_web.py` | No |

| Platform | Status |
|----------|--------|
| macOS | Supported. Install tmux with Homebrew. |
| Linux | Supported. Install tmux through `apt-get`, `dnf`, or `pacman`. |
| Windows | Through WSL only; tmux and bash are not available natively. |

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill skill-distill
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--scope user` to install for every project, and `--dry-run` to preview. The skill is in the `coding` pack.

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

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/skill-distill` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/skill-distill .claude/skills/
```

Windows (PowerShell, for a WSL setup that reads the Windows folder):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\skill-distill .claude\skills\
```

Each agent has a short guide in `skills/skill-distill/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

Check the machine before the first run:

```bash
python3 skills/skill-distill/scripts/setup/doctor.py --student omp --web
```

## Quick Start

```text
Distill this session into a skill for omp with deepseek-v4.1-flash on my local server.
```

The agent saves your first message as the task prompt, finds the commit the session started from, smoke-tests the student, writes the acceptance list and checks and proves them on your result, then runs the student three times per skill version in tmux until it matches, and shows you the side-by-side report for your pass or fail call.

## Usage

### Input

| Input | Required | Example |
|-------|:--------:|---------|
| Student harness and model | Yes | "omp with local/deepseek-v4.1-flash", "codex with qwen3-coder on my vLLM box" |
| Reference session | No | The current session by default, or a session log path |
| Starting state | No | The commit before the session by default; "it started from an empty folder" |
| Setup per trial | No | "run npm ci first", "reset the test database" |
| Trial timeout | No | 90 minutes by default |

### Examples

```text
Make a skill so GLM can do what you just did, in pi.
```

```text
Teach Qwen in opencode to reproduce this refactor. The repo had uncommitted changes when we started.
```

```text
Distill the Codex session from this morning in ~/code/game into a skill for omp with deepseek. Do it yourself, don't call me.
```

```text
Show me the skill-distill runs for this project and their best scores.
```

## How It Works

```text
  0. Inputs        student (asked), prompt (verbatim), starting commit, reference folder
        │
  1. Check         doctor.py: tools ── distill.py smoke: student creates hello.txt
        │
  2. Init          run folder in ~/.gti/skill-distill/<project>/runs/<task>/
        │
  3. Acceptance    acceptance.md + checks.sh, proven on the reference
        │
  4. Skill v1      steps in order, decisions, traps, harness notes, verification
        │
  5. Trials        3 fresh workspaces in tmux, prompt + skill only
        │
  6. Judge         evidence ── first divergence ── verdict and score
        │
  7. Fix           one edit per iteration, revert regressions, back to 5
        │
  8. User          report.html ── accept pass or fail
        │
  9. Deliver       "Tested with" line, privacy check, optional install
```

## Reference

All commands run from the user's project folder. `<task>` resolves to `~/.gti/skill-distill/<project>/runs/<task>/`; a path is used as given.

### distill.py

```bash
python3 scripts/run/distill.py <command> [args] [--project <name>]
```

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `smoke` | Run a one-minute task through the student harness | `--student harness:model`, `--student-args="..."`, `--env K=V`, `--timeout 300` |
| `init` | Create a run | `--prompt`, `--student`, `--base empty\|<repo>[@ref\|@worktree]`, `--reference claude\|codex\|omp\|<log>`, `--reference-workspace`, `--setup`, `--timeout-min 90`, `--name`, `--tmux`, `--force` |
| `trial` | Freeze the skill as the next iteration and start trials in tmux | `-k 3`, `--iter` |
| `status` | Show trial states and the last output line | `--iter` |
| `wait` | Block until every trial exits; exit code 2 at the timeout | `--timeout 540`, `--iter` |
| `evidence` | Collect files, diff, trace, and `checks.sh` output per trial | `--reference [dir]`, `--iter` |
| `verdict` | Record a judgement in the ledger | `--iter`, `--trial`, `--verdict match\|close\|miss\|broken`, `--score 0-10`, `--divergence`, `--note`, `--fix` |
| `ledger` | Print verdicts, decisions, and the best score per iteration | None |
| `report` | Write `report.html` | `--iter` |
| `accept` | Record the user's decision; on pass copy the skill to `final/` | `--iter`, `--decision pass\|fail`, `--note` |
| `list` | List the project's runs | None |

### extract_session.py

Shared from the agent runner package and synced into `scripts/agent/`.

```bash
python3 scripts/agent/extract_session.py LOG [-o reference.md] [--json reference.json]
python3 scripts/agent/extract_session.py --current claude|codex|omp --cwd DIR
```

| Argument | Default | Description |
|----------|---------|-------------|
| `LOG` | None | Session log; the format is detected |
| `--current` | None | Use the newest session of that kind for `--cwd` |
| `--cwd` | Current folder | Folder whose session to find |
| `--format` | Detected | `claude`, `codex`, `codex-exec`, or `omp` |
| `-o` | Standard output | Markdown summary |
| `--json` | None | JSON summary with tool calls, errors, and files written |

### capture_web.py

```bash
python3 scripts/capture/capture_web.py --dir WORKSPACE --out OUT [--start "npx vite --port {port} --strictPort"]
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--dir` | Required | Folder to serve or start in |
| `--out` | Required | Where screenshots, `console.log`, and `capture.json` go |
| `--start` | Static file server | Command that serves the app; `{port}` is replaced with a free port |
| `--path` | `/` | Page path |
| `--actions` | Built-in walk and interact | JSON list of `wait`, `key`, `press`, `click`, `click_text`, `js`, and `shot` steps |
| `--size` | `1280x800` | Viewport |
| `--boot-secs` | `90` | How long to wait for the server |

### doctor.py

```bash
python3 scripts/setup/doctor.py [--student <harness>] [--web] [--json]
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--student` | None | Also check the harness and its CLI |
| `--web` | Off | Also check Playwright and Pillow |
| `--json` | Off | Machine-readable output |

### agent_run.py

The shared runner that starts every student, synced from [packages/python/agent-runner](../../packages/python/agent-runner/README.md) into `scripts/agent/`. See that README for every flag.

```bash
python3 scripts/agent/agent_run.py list
python3 scripts/agent/agent_run.py spawn --harness <id> --model <model> --cwd <dir> --prompt-file <file> --dry-run
```

| Harness | Status |
|---------|--------|
| `omp`, `codex` | Tested upstream |
| `claude` | Smoke-tested on 2.1 with Haiku |
| `opencode`, `cursor` | Flags verified against the installed CLI's help; not run end to end here |
| `pi`, `kilo`, `cline`, `command-code` | From the CLI docs |

## Output

```text
~/.gti/skill-distill/<project>/
├── smoke/<timestamp>-<id>/         # smoke test workspace and output
└── runs/<task>/
    ├── run.json, prompt.md         # settings and the verbatim prompt
    ├── base/                       # only with @worktree: the snapshot repository
    ├── reference/                  # reference.md, reference.json, evidence/
    ├── acceptance.md, checks.sh    # written by the teacher
    ├── skill/                      # the student skill being edited
    ├── iters/01/skill/             # frozen copy per iteration
    ├── iters/01/t1/                # workspace/, trace/, evidence/, verdict.json, stdout.log
    ├── ledger.jsonl                # verdicts and user decisions
    ├── report.html                 # reference and trials side by side
    └── final/<name>/               # the accepted skill
```

| Section | Contents |
|---------|----------|
| Produced skill | `SKILL.md` with Goal, Done means, Before you start, Steps, Decisions, Don't, Verify, and a "Tested with" line, plus optional `scripts/` and `references/` |
| Report | The task, the reference and trial panels with screenshots, checks, and files, the ledger, and the skill used |
| Ledger | One JSON line per verdict and per user decision |

## Security

- **Student permissions:** trials run the student with `--yolo`, every permission granted inside its trial workspace. The workspace is a throwaway clone under `~/.gti/skill-distill/`, but the process runs as your user. Use a container or VM for tasks that touch shared machines.
- **Private material:** run folders hold raw session logs and machine paths. They stay under `~/.gti/` and are never written to your repository.
- **Your repository:** the reference repository is only read and cloned. `@worktree` copies uncommitted changes into the run folder; it creates no branch, commit, or ref in your repository.
- **Produced skill:** the teacher checks it for secrets, private hostnames, and personal data before delivery, because the skill is meant to be shared.
- **Network:** only what the student harness itself does, such as calls to its model server.

## Development

| Command | Action |
|---------|--------|
| `python -m unittest discover -s skills/skill-distill/tests` | Runs the script tests, including a full loop with a fake student when tmux is installed |
| `npm run test:python` | Runs every Python test in the repository |
| `node packages/cli validate --skill skill-distill` | Checks the skill against the repository rules |

## Troubleshooting

<details>
<summary><strong>The smoke test fails</strong></summary>

The student harness cannot reach its model: a wrong model id, a missing key, or a server that is down. Read the last output lines printed by `smoke`, then run the harness by hand with the same model.

```bash
python3 scripts/run/distill.py smoke --student omp:local/deepseek-v4.1-flash
```

</details>

<details>
<summary><strong>tmux is not on PATH</strong></summary>

Trials run in tmux windows. Install it and run the doctor again.

```bash
python3 scripts/setup/doctor.py
```

</details>

<details>
<summary><strong>The checks fail on the reference</strong></summary>

The check is wrong, not the reference: a guessed key, a click that misses, a timing that is too short. Fix `checks.sh` and run `evidence --reference` until it exits 0 before judging any trial.

</details>

<details>
<summary><strong>Trials have no trace.md</strong></summary>

The harness left no session log, or the log format has no parser (OpenCode, Cursor). Judge from `stdout.log`, `files.txt`, and the checks, or add a parser to `extract_session.py`.

</details>

<details>
<summary><strong>The student keeps hanging on a server or watch command</strong></summary>

The harness blocks on a long-running command. Add a harness note at the top of the student skill with the exact background command and how to stop it.

</details>

## Limitations

- Needs tmux and bash, so Windows works only through WSL.
- Session logs are parsed for Claude Code, Codex, omp, and pi. Other teachers write `reference/reference.md` by hand.
- omp and Codex were run end to end upstream and Claude Code passed the smoke test here. OpenCode and Cursor flags were checked against their help output, and the rest come from their docs.
- OpenCode, Cursor, Kilo, Cline, and Command Code have no isolation flag, so the user's own context may reach the student. OpenCode and Cursor logs have no parser.
- Three trials per iteration with a 90-minute timeout can take hours of local GPU time for large tasks.
- The user's pass or fail call is required for an accepted skill; the loop cannot prove "as good" by itself.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [Sybil Solutions: skill-distill](https://github.com/sybil-solutions/skill-distill) | MIT | The teacher and student loop, the run manager, session extraction, web capture, the first harness flags, and the judging lessons |
| [0xSero: Skill Distill announcement](https://x.com/0xSero/status/2124035122924232712) | Standard X post terms | Introduced the skill |

## License

MIT, see [LICENSE](LICENSE). Copyright Sybil Solutions for the upstream skill; the additions in this repository follow the same license.
