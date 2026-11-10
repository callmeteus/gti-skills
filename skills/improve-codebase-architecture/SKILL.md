---
name: improve-codebase-architecture
description: >-
  Finds refactors that make a codebase easier to change and test: thin
  wrappers to merge, logic copied across callers, modules that need three
  mocks to test one rule. Starts where git history shows the most change,
  presents three to six candidates in a readable HTML report with before and
  after diagrams written in everyday coding terms (no design-book jargon),
  then works through the chosen refactor with the user one round of questions
  at a time, keeping GLOSSARY.md and ADRs current. Use when the user asks to
  improve, review, or clean up the architecture or structure of a codebase,
  find refactoring opportunities, make code easier to test or for agents to
  navigate, or reduce coupling. Do not use for a bug fix, a code review of a
  single diff, performance work, or writing new features.
license: MIT, see LICENSE
compatibility: >-
  Git. Python 3.8+ for the hotspot and report scripts, standard library only.
  The report loads Mermaid from a CDN; without network the diagram source
  stays readable as text.
metadata:
  display-name: Improve Codebase Architecture
---

# Improve Codebase Architecture

## Core Rule

Always respond in the user's language, regardless of the language used in this skill or any content you analyze. The HTML report also uses the user's language for its prose; keep code names as they are in the code.

## Autonomous Mode

When the user says to work on your own, for example "do it yourself", "faz você mesmo", "you don't need to ask me", "não precisa me chamar", or "just do it", or when the request runs unattended:

- **Do not stop for input.** Skip questions, confirmations, and pauses that wait for the user. At each decision, take the option this skill recommends, or the safest default, and note the decision and the reason.
- **Do not open anything for the user.** No browser tabs, viewers, editors, or servers started for the user to look at. Still write every file the skill produces and give the paths at the end.
- **Never take a gated irreversible or outward action** unless the request already allows it: deleting the user's data, tests, or files; publishing, posting, pushing, or sending; paying; typing credentials. List each one as pending instead.
- **Finish with one report:** the decisions you took and why, what you did, what is pending, and what you could not verify.

In this skill:

- Render the report without `--open` (`render_report.py <file> --strict`) and give its path at the end instead of asking which candidate to explore.
- Pick the candidate with the highest strength; break ties by the biggest gain for the least effort. Answer every round of step 4 with its recommended answer and record the answers in `GLOSSARY.md` and ADRs as usual.
- Skip the plan confirmation and go on to step 6: implement, run the tests, and report. Keep public APIs and stored data formats unchanged; when a design would change them, choose the option that does not, and list the other as pending.

## When to use

- The user asks for an architecture review, refactoring ideas, or "where should we clean up first".
- The user says the code is hard to change, hard to test, or hard for agents to navigate.
- The user names a module or folder that hurts and wants options.

Do not use it for a bug fix, a review of one diff, performance tuning, or new features.

## The goal

Find modules that cost more than they give, and propose merging or reshaping them so that each module has a small public API with real logic inside. The payoff is concrete: fewer files to open per change, one place to fix a bug, tests that call one function instead of mocking three classes. The ideas are explained in [references/concepts/module-design.md](references/concepts/module-design.md).

## The language rule

The report and the conversation are technical, in the words developers use every day: module, function, class, public API, interface, service, wrapper, helper, mock, fake, injection. Never use design-book jargon such as seam, deepen, shallow module, depth, leverage, locality, adapter, or ports and adapters. Name real files and functions, count things, and describe the effect on daily work. The full list of replacements is in [references/concepts/plain-language.md](references/concepts/plain-language.md); the report script warns about any jargon it finds.

## Prerequisites

- A git repository. Run the scripts with `python3` on macOS and Linux and `python` or `py -3` on Windows.
- Optional: `GLOSSARY.md` (or `GLOSSARY-MAP.md`) and ADRs in `docs/adr/`. Read them when they exist; never require them.

## Instructions

Follow the steps in order. Read a reference file only when its step starts.

1. **Decide where to look.** Take the user's target, or find the hot spots with `scripts/explore/hotspots.py`. Read the glossary and ADRs for the area. See [references/workflow/01-scope.md](references/workflow/01-scope.md) and [references/concepts/project-docs.md](references/concepts/project-docs.md).
2. **Explore and collect candidates.** Use a subagent with a fresh context when available. Record files, the problem and the gain with numbers, the dependency type, effort, and strength for three to six candidates. See [references/workflow/02-explore.md](references/workflow/02-explore.md) and [references/concepts/testing-by-dependency.md](references/concepts/testing-by-dependency.md).
3. **Write the report.** Fill a JSON data file in the OS temp folder from [assets/templates/report-data.example.json](assets/templates/report-data.example.json), check it with [references/quality/report-checklist.md](references/quality/report-checklist.md), and render it. Give the user the absolute path, then ask which candidate they want to explore. Do not design APIs yet. Add `--open` only when the user is following along; in Autonomous Mode render without it and keep going. See [references/workflow/03-report.md](references/workflow/03-report.md).

   ```bash
   python3 <skill-dir>/scripts/report/render_report.py <tmp>/architecture-review.json --strict --open
   ```

4. **Work through the chosen candidate.** Ask the open decisions in numbered rounds with a recommended answer each, look up facts yourself, and update `GLOSSARY.md` and ADRs as decisions are made. See [references/workflow/04-discuss.md](references/workflow/04-discuss.md).
5. **Compare API designs (optional).** When the user wants options, produce three or four very different designs and recommend one. See [references/workflow/05-design-options.md](references/workflow/05-design-options.md).
6. **Implement and report the change.** After the user confirms, change the code as agreed, then tell them in a few short paragraphs: what is different now from their side, their own example under the new behavior, exactly where it applies and where it does not, and what you could not verify and why. See [references/workflow/06-implement-and-report.md](references/workflow/06-implement-and-report.md).

Nothing in the repository changes during steps 1 to 3. Change code only after the user confirms the plan from step 4.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/explore/hotspots.py` | Folders and files changed most in recent commits, as text or JSON |
| `scripts/report/render_report.py` | Validates the report data, warns about jargon, writes the HTML report to the OS temp folder |

Both take `--help` and use only the Python standard library.

## Examples

```text
User: Our backend is getting hard to change. Where should we refactor first?
Agent: Runs hotspots.py: src/orders and src/pricing hold most recent changes.
Reads GLOSSARY.md and three ADRs. Explores both folders and finds that every
order route calls four validation helpers in the same order, and that two
files copy the pricing HTTP calls with their own retries. Writes a report with
four candidates, renders it with --strict, opens it, and asks which one to
explore.
```

```text
User: The second one, the pricing client.
Agent: Round 1: Q1 name it PricingClient? Q2 put it in src/pricing/client.ts?
Q3 test with an in-memory fake? Each with a recommendation. Looks up every
caller of the pricing service itself. After two rounds, summarizes the plan
and asks for confirmation before touching code.
```

## Resources

| Path | Purpose |
|------|---------|
| `references/workflow/` | One file per step: scope, explore, report, discuss, design options, implement and report |
| `references/concepts/` | Module design, plain language, testing by dependency type, glossary and ADR formats |
| `references/quality/` | Report checklist |
| `scripts/` | Hotspot scan and report renderer |
| `assets/templates/` | Example report data |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.

## Notes

- Adapted from the `improve-codebase-architecture` skill by Matt Pocock (MIT), with its companion skills `codebase-design`, `grilling`, and `domain-modeling` folded into this folder so it works on its own. The analysis is the same; the vocabulary, report format, and scripts are new.
