---
name: untangle-codebase
description: >-
  Untangles a whole codebase (or one named area) in one long, goal-driven
  refactor, so agents working in it read less per change, break less without
  noticing, and debug faster. Lists every hidden link, needless link, surplus
  piece, and special case, redesigns from today's requirements, fixes
  everything on the list one verified commit at a time, and repeats until
  independent checks find nothing worth fixing. Ships scripts for the import
  graph with git volatility, co-change history, a code skeleton, and a
  special-case count used as the progress measure. Use when the user
  explicitly asks to untangle, restructure, or refactor an entire codebase or
  area end to end, or invokes /untangle-codebase. Do not use to pick a few
  refactor candidates or write an architecture report (use
  improve-codebase-architecture), for a bug fix, a single-file cleanup, a
  framework migration, or feature work.
compatibility: >-
  Git and a test command for the project. Python 3.8+ for the helper scripts,
  standard library only. Works best in agents with sub-agents for the
  summaries and the final checks.
license: MIT, see LICENSE
metadata:
  display-name: Untangle Codebase
  upstream: https://github.com/caldoai/skills/tree/main/skills/untangle-codebase
---

# Untangle Codebase

## Core Rule

Always respond in the user's language, regardless of the language used in this skill, the code, or its comments. Code, identifiers, commit messages, and the decision log follow the project's existing language and conventions.

## Goal

Start a thorough refactor of this codebase and complete it to the end. Treat this as a goal, not a suggestion list: keep going until the done criteria in step 5 hold, or until the user stops you.

Why do this at all:

- **Better output:** agents write better code in a well-structured codebase.
- **Cheaper and faster changes:** agents spend fewer tokens searching and more on the problem.
- **Fewer silent breaks:** agents break less without noticing.
- **Faster debugging:** agents find root causes faster.

Everything follows from one question asked of every pair of pieces: **should these pieces change together?** The code gets the answer wrong in three ways, plus special cases:

| Kind | Meaning |
|------|---------|
| **Hidden links** | Pieces that must change together, where the code does not show it |
| **Needless links** | Pieces tied together that change for different reasons |
| **Surplus** | Pieces with no reason of their own to change |
| **Special cases** | Code for one situation instead of following from how the system works; each is a requirement the design never accounted for |

The target shape: pieces that change together end up together, pieces that do not are not tied, and everything depends on what changes less than itself.

If the user named an area or concern (for example `/untangle-codebase billing` or "focus on the API layer"), the whole workflow applies to that area and its direct dependents only.

## Workflow

Copy this checklist into the decision log and keep it current:

```text
Untangle progress:
- [ ] 1. Ask and prepare (options, branch, baseline tests, baseline measurements)
- [ ] 2. List every problem (no changes yet)
- [ ] 3. Redesign from first principles
- [ ] 4. Fix everything on the list, one verified commit per fix
- [ ] 5. Check with fresh eyes, repeat until done, final report
```

1. **Ask and prepare.** Offer the two optional additions (Comments, Tests) with their exact descriptions, and settle scope and guardrails. Then make a branch, record the baseline test result, and save baseline measurements. See [references/workflow/01-ask-and-prepare.md](references/workflow/01-ask-and-prepare.md).
2. **List every problem.** Change nothing. Map the codebase with the scripts, then write every hidden link, needless link, surplus piece, and special case into the decision log with `file:line`. See [references/workflow/02-list-problems.md](references/workflow/02-list-problems.md).
3. **Redesign from first principles.** Work out the fixes as if the system had known today's requirements from the start. Look for the one fix behind several problems. Write each fix above the problems it solves. See [references/workflow/03-redesign.md](references/workflow/03-redesign.md).
4. **Fix everything on the list.** One fix per commit, tests green after each, in an order that keeps the code working. Apply the Comments and Tests rules only if the user chose them, and Tests last. See [references/workflow/04-fix.md](references/workflow/04-fix.md).
5. **Check and repeat until done.** Fresh sub-agents hunt for what is left; you loop back to step 2 for anything worth fixing. Finish with the behavior check and a before and after report. See [references/workflow/05-check-and-finish.md](references/workflow/05-check-and-finish.md).

Before step 4 and whenever a fix touches a public surface, read [references/quality/guardrails.md](references/quality/guardrails.md): it lists what never changes without asking, and when to stop and ask.

## Scripts

All scripts are read-only, use only the Python standard library, and take the codebase root as the first argument. Use `python3` on macOS and Linux and `python` or `py -3` on Windows. Write their output under `.untangle/` in the project, never next to source files.

| Script | Use |
|--------|-----|
| `<skill-dir>/scripts/map/skeleton.py` | Signatures, types, and class members without bodies, with line numbers, so the whole codebase fits in context |
| `<skill-dir>/scripts/map/deps.py` | Import graph between folders or files for Python, JS/TS, and Go: cycles, fan-in, fan-out, and imports of code that changes more often |
| `<skill-dir>/scripts/map/cochange.py` | File pairs that git history shows changing together, cross-folder pairs first: hidden link leads |
| `<skill-dir>/scripts/measure/special_cases.py` | Count of special-case markers by category; `--save` a baseline, `--compare` after each round |

Every script result is a lead to read, not a verdict. An entry point that imports everything, or a lookup table that compares to literals, can be exactly right.

## Rules

- **Behavior stays the same.** Intended behavior at the end equals behavior at the start, apart from bugs the refactor fixed. Each such bug is written in the decision log with the test that now covers it.
- **The test suite is the safety net.** Never commit a fix with a failing test that passed at baseline. If an area has no tests that would catch a regression, add a characterization test before moving its code.
- **One fix, one commit.** Each commit implements one decision log entry and names it, so any fix can be reverted alone.
- **The log is the memory.** Write decisions to `.untangle/decision-log.md` as you go. After a context reset or compaction, re-read it before doing anything else.
- **Fix causes, not instances.** Do not fix special cases one by one. Remove the ones the redesign makes unnecessary, and keep the ones the system still needs, with the reason in the log.
- **Do not hunt bugs separately.** A structural fix may fix some along the way, which is fine.

## Done when

- As few special cases are left as possible. `special_cases.py --compare` is the running measure, read together with the log of kept cases.
- A typical change lands in one place.
- Every import is reasonable, there are no cycles, and nothing imports anything more volatile than itself without a reason in the log.
- Fresh sub-agents find no issue left that is worth fixing.
- The full test suite passes and the behavior check in step 5 holds.

## Example

[assets/examples/decision-log-example.md](assets/examples/decision-log-example.md) shows a problem list and the same list grouped under fixes. Start a new log from [assets/templates/decision-log.md](assets/templates/decision-log.md) and finish with [assets/templates/final-report.md](assets/templates/final-report.md).

## Resources

| Path | Purpose |
|------|---------|
| `references/workflow/` | One file per step, in order |
| `references/quality/guardrails.md` | What never changes without asking, and when to stop |
| `scripts/map/` | Skeleton, import graph, and co-change history |
| `scripts/measure/` | Special-case counter with baseline and compare |
| `assets/templates/` | Decision log and final report |
| `assets/examples/` | A worked decision log |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.
