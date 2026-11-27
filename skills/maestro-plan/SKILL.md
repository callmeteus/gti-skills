---
name: maestro-plan
description: >-
  Shortcut into the Maestro skill that only plans: classifies the request,
  writes the tasks, waves, dependencies, model routes, done criteria, and
  review gates to Maestro's ledger, prints the plan, and starts no worker.
  The plan can be run later with /maestro resume or /maestro. Use when the
  user types /maestro-plan, asks Maestro to plan a task without running it,
  wants to see how Maestro would split and route the work, or wants a cost
  estimate first. Do not use when the user wants the work done now (use
  maestro or maestro-simple).
compatibility: >-
  Needs the Maestro skill installed in the same skills folder (the gti-skills
  installer adds it), and an agent that can spawn subagents or a worker CLI
  on PATH.
license: No license declared
metadata:
  display-name: Maestro Plan
---

# Maestro Plan

## Core Rule

Always respond in the user's language, regardless of the language used in this skill, in Maestro's files, in the code, or in its comments. Plans, briefs, review notes, and the report follow the user's language; identifiers, commands, and file paths stay as they are.

## Autonomous Mode

When the user says to work on your own, for example "do it yourself", "faz você mesmo", "you don't need to ask me", "não precisa me chamar", or "just do it", or when the request runs unattended:

- **Do not stop for input.** At each decision, take the option this skill or Maestro recommends, and write the decision and the reason to `~/.gti/maestro/<project>/decisions.jsonl`.
- **Do not open anything for the user.** No browser tabs, viewers, the central, or servers to look at. Still write every file the run produces and give the paths at the end.
- **Never take a gated irreversible or outward action** the request did not allow: deleting the user's data or files, pushing, posting, opening pull requests or issues, paying, typing credentials, or deploying. List each one as pending.
- **Finish with one report:** the decisions and why, what the workers did, what is pending, and what was not verified.

In this skill:

- Intake asks nothing. Take the recommended reading of an ambiguous request and list the assumption in the plan's open questions.
- The run itself is not started. Running the plan is the user's next step, so it is not listed as pending work.
- Everything else follows the Autonomous Mode section of Maestro's `SKILL.md`.

## Output Location

This skill writes into Maestro's ledger, `~/.gti/maestro/<project>/`, where `<project>` is the repository folder name and `GTI_HOME` replaces `~/.gti`, so `/maestro status`, `/maestro resume`, `/maestro report`, and the central see the run. It keeps no folder of its own. Nothing generated goes into the user's repository: only the changes the user asked for go there, and a generated file goes there only when the user names that place.

## What this skill is

A short entry point into the Maestro skill. It runs Maestro's `/maestro plan` command: Intake and Plan only. It is the same as `/maestro plan <task>`, without having to know the Maestro command. Maestro itself is unchanged: its rules, ledger, routing, and review all apply, and Maestro still never does the task itself.

```text
/maestro-plan <task>
```

## Load Maestro first

1. Read `<skill-dir>/../maestro/SKILL.md`, the Maestro skill installed next to this one, before anything else. Inside Maestro's files, `<skill-dir>` means the Maestro folder (`<skill-dir>/../maestro/`), not this one: its scripts and references are there.
2. If that file is missing, load the skill named `maestro` the way your agent loads skills.
3. If neither exists, stop and tell the user to install it: `node packages/cli install --skill maestro-plan --harness <agent>` installs Maestro together with this skill.
4. Read each Maestro reference named below at the step that needs it, not all at once.

## Run

1. **Intake.** Follow Maestro's intake ([`01-intake.md`](../maestro/references/workflow/01-intake.md)): goal, done criteria, simple or complex, risk, budget, harness, preferences, and catalog. Record `entry: "maestro-plan"` and `phase: "planned"` in `run.json`.
2. **Plan.** Follow Maestro's plan step ([`02-plan.md`](../maestro/references/workflow/02-plan.md)): one task for simple work, waves for complex work, each task with its routing target, fallback, reason, and done criteria. Write it to `plan.md` in the ledger.
3. **Print it.** Show the run header, the wave table, the model per task with the reason, the budget estimate, and the open questions. Say how to run it: `/maestro resume` continues this plan, and `/maestro <task>` starts a new run.
4. **Stop.** Start no worker, spawn nothing, and send no brief.

## Never

- Spawn a worker, send a brief, or start the central.
- Edit the user's repository. The plan lives only in the ledger.
- Change Maestro's files. This skill only calls Maestro.

## Other Maestro entry points

| Command | For |
|---|---|
| `/maestro` | The full run: any size, waves, panels, team mode when its gate holds |
| `/maestro-simple` | One task, one cheap worker, one review |
| `/maestro-review` | Independent reviewers, one consensus on evidence |
| `/maestro-team` | Workers that share findings on long, hard runs |
| `/maestro-teach` | A teacher writes the lesson, students prove it |
| `/maestro-council` | Several agents debate a question, Maestro chairs |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.
