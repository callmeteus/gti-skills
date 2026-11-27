---
name: maestro-simple
description: >-
  Shortcut into the Maestro skill for simple orchestration: one task, one
  worker chat on the cheapest model that fits, Maestro's evidence review in
  the same chat, and a short report. No plan waves, no team mode, no review
  panel, no central. Maestro still never does the task itself. Use when the
  user types /maestro-simple, asks to delegate one small or medium task to a
  cheaper model, or wants plain orchestration without the full Maestro run.
  Do not use for work that needs several parallel tasks or many hours (use
  maestro or maestro-team), or for a change the current agent can finish in
  one edit.
compatibility: >-
  Needs the Maestro skill installed in the same skills folder (the gti-skills
  installer adds it), and an agent that can spawn subagents or a worker CLI
  on PATH.
license: No license declared
metadata:
  display-name: Maestro Simple
---

# Maestro Simple

## Core Rule

Always respond in the user's language, regardless of the language used in this skill, in Maestro's files, in the code, or in its comments. Plans, briefs, review notes, and the report follow the user's language; identifiers, commands, and file paths stay as they are.

## Autonomous Mode

When the user says to work on your own, for example "do it yourself", "faz você mesmo", "you don't need to ask me", "não precisa me chamar", or "just do it", or when the request runs unattended:

- **Do not stop for input.** At each decision, take the option this skill or Maestro recommends, and write the decision and the reason to `~/.gti/maestro/<project>/decisions.jsonl`.
- **Do not open anything for the user.** No browser tabs, viewers, the central, or servers to look at. Still write every file the run produces and give the paths at the end.
- **Never take a gated irreversible or outward action** the request did not allow: deleting the user's data or files, pushing, posting, opening pull requests or issues, paying, typing credentials, or deploying. List each one as pending.
- **Finish with one report:** the decisions and why, what the workers did, what is pending, and what was not verified.

In this skill:

- The size check does not ask. When the request is too big for one task, run it as a full Maestro run, record the switch in `decisions.jsonl`, and say so in the report.
- Model choice and the worker path follow Maestro's Autonomous Mode: preferences first, then the recommended route.
- Everything else follows the Autonomous Mode section of Maestro's `SKILL.md`.

## Output Location

This skill writes into Maestro's ledger, `~/.gti/maestro/<project>/`, where `<project>` is the repository folder name and `GTI_HOME` replaces `~/.gti`, so `/maestro status`, `/maestro resume`, `/maestro report`, and the central see the run. It keeps no folder of its own. Nothing generated goes into the user's repository: only the changes the user asked for go there, and a generated file goes there only when the user names that place.

## What this skill is

A short entry point into the Maestro skill. It runs the simple run of Maestro: Intake, a one-task plan, Delegate, Review, and Finish, with the class fixed to simple. It is the same as `/maestro <task>, forced to a simple run`, without having to know the Maestro command. Maestro itself is unchanged: its rules, ledger, routing, and review all apply, and Maestro still never does the task itself.

```text
/maestro-simple <task>
```

## Load Maestro first

1. Read `<skill-dir>/../maestro/SKILL.md`, the Maestro skill installed next to this one, before anything else. Inside Maestro's files, `<skill-dir>` means the Maestro folder (`<skill-dir>/../maestro/`), not this one: its scripts and references are there.
2. If that file is missing, load the skill named `maestro` the way your agent loads skills.
3. If neither exists, stop and tell the user to install it: `node packages/cli install --skill maestro-simple --harness <agent>` installs Maestro together with this skill.
4. Read each Maestro reference named below at the step that needs it, not all at once.

## Run

1. **Intake.** Follow Maestro's intake ([`01-intake.md`](../maestro/references/workflow/01-intake.md)) with the class fixed to `simple`. Load the preferences, detect the harness and the worker runtime, and record `entry: "maestro-simple"` in `run.json`.
2. **Check the size.** If the request clearly needs several independent tasks, more than one area of the codebase, or a migration, say so in one line and offer the full `/maestro` run instead. Do not split it into waves here.
3. **One task.** Write one brief with Maestro's brief contract ([`03-delegate.md`](../maestro/references/workflow/03-delegate.md)). Route it to the cheapest model that fits the task's context and quality needs, with one fallback.
4. **Delegate.** Spawn one worker chat, record its chat id before the first prompt, and wait for its notification. Do not poll.
5. **Review.** Review in the same chat with Maestro's review ([`04-review.md`](../maestro/references/workflow/04-review.md)): evidence first, then PASS, FIX, REASSIGN, or ESCALATE. At most 2 fix rounds before a reassign.
6. **Report.** A short report: what changed, the checks and their results, the worker and model, and anything pending. Keep the chat open for follow-up.

## Never

- Turn on team mode, teacher and student mode, or a review panel.
- Start the central or open anything for the user.
- Do the task yourself because it is small. A simple run still uses a worker.
- Change Maestro's files. This skill only calls Maestro.

## Other Maestro entry points

| Command | For |
|---|---|
| `/maestro` | The full run: any size, waves, panels, team mode when its gate holds |
| `/maestro-plan` | Maestro's plan, with no workers started |
| `/maestro-review` | Independent reviewers, one consensus on evidence |
| `/maestro-team` | Workers that share findings on long, hard runs |
| `/maestro-teach` | A teacher writes the lesson, students prove it |
| `/maestro-council` | Several agents debate a question, Maestro chairs |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.
