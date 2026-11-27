---
name: maestro-teach
description: >-
  Shortcut into the Maestro skill's teacher and student mode: a teacher
  worker writes a lesson (instructions, a skill, a brief template, a runbook,
  or a prompt), at least 3 students per iteration follow only that lesson in
  fresh chats, the teacher finds the first divergence and the wasted effort
  and revises the lesson, and Maestro confirms mastery by running the checks
  itself. Designs: same task with lesson variants, different tasks with the
  same lesson (with held-out tasks), repeats, or different student models.
  Also makes the student's output shorter and less overthought. Use when the
  user types /maestro-teach or asks for teacher and student mode, professor e
  aluno, or to teach a cheaper model to do a task. Do not use to turn one
  past session into a skill for a named agent (use skill-distill) or for a
  normal delegated task (use maestro-simple).
compatibility: >-
  Needs the Maestro skill installed in the same skills folder (the gti-skills
  installer adds it), and an agent that can spawn subagents or a worker CLI
  on PATH.
license: No license declared
metadata:
  display-name: Maestro Teach
---

# Maestro Teach

## Core Rule

Always respond in the user's language, regardless of the language used in this skill, in Maestro's files, in the code, or in its comments. Plans, briefs, review notes, and the report follow the user's language; identifiers, commands, and file paths stay as they are.

## Autonomous Mode

When the user says to work on your own, for example "do it yourself", "faz você mesmo", "you don't need to ask me", "não precisa me chamar", or "just do it", or when the request runs unattended:

- **Do not stop for input.** At each decision, take the option this skill or Maestro recommends, and write the decision and the reason to `~/.gti/maestro/<project>/decisions.jsonl`.
- **Do not open anything for the user.** No browser tabs, viewers, the central, or servers to look at. Still write every file the run produces and give the paths at the end.
- **Never take a gated irreversible or outward action** the request did not allow: deleting the user's data or files, pushing, posting, opening pull requests or issues, paying, typing credentials, or deploying. List each one as pending.
- **Finish with one report:** the decisions and why, what the workers did, what is pending, and what was not verified.

In this skill:

- The design is not a question. Take the recommended one for the goal (generalization when the lesson must work on new tasks, A/B when the user is choosing between instructions) and record it.
- Delivering the lesson outside the ledger needs the place in the request; otherwise it stays in `lessons/<lesson-id>/lesson/` and the copy is listed as pending.
- Everything else follows the Autonomous Mode section of Maestro's `SKILL.md`.

## Output Location

This skill writes into Maestro's ledger, `~/.gti/maestro/<project>/`, where `<project>` is the repository folder name and `GTI_HOME` replaces `~/.gti`, so `/maestro status`, `/maestro resume`, `/maestro report`, and the central see the run. It keeps no folder of its own. Nothing generated goes into the user's repository: only the changes the user asked for go there, and a generated file goes there only when the user names that place.

## What this skill is

A short entry point into the Maestro skill. It runs Maestro's teacher and student mode ([`teacher-student.md`](../maestro/references/modes/teacher-student.md)). It is the same as `/maestro teach <goal>`, without having to know the Maestro command. Maestro itself is unchanged: its rules, ledger, routing, and review all apply, and Maestro still never does the task itself.

```text
/maestro-teach <what to teach, and to which model>
```

## Load Maestro first

1. Read `<skill-dir>/../maestro/SKILL.md`, the Maestro skill installed next to this one, before anything else. Inside Maestro's files, `<skill-dir>` means the Maestro folder (`<skill-dir>/../maestro/`), not this one: its scripts and references are there.
2. If that file is missing, load the skill named `maestro` the way your agent loads skills.
3. If neither exists, stop and tell the user to install it: `node packages/cli install --skill maestro-teach --harness <agent>` installs Maestro together with this skill.
4. Read each Maestro reference named below at the step that needs it, not all at once.

## Run

1. **Intake.** Calling this skill is the explicit request teacher and student mode needs. Follow Maestro's intake ([`01-intake.md`](../maestro/references/workflow/01-intake.md)) and record `entry: "maestro-teach"` and `teaching` in `run.json`.
2. **Set the goal.** What the lesson teaches, the student model (the one the user named, or the cheaper model it is for), and the design: repeat, instruction A/B, generalization, or student comparison. Read the designs in [`teacher-student.md`](../maestro/references/modes/teacher-student.md#experiment-designs).
3. **Run the loop.** Follow [The loop](../maestro/references/modes/teacher-student.md#the-loop): the teacher sets the acceptance list and checks, writes the lesson, Maestro freezes it and spawns at least 3 isolated students, runs the checks, and the teacher judges and revises.
4. **Stop.** When every student of an iteration masters the task inside the efficiency budget (and the held-out tasks in a generalization design), after 6 iterations, or after 2 iterations with no better best score.
5. **Deliver.** The mastered lesson where the user asked, or in `lessons/<lesson-id>/lesson/`, with the report of scores and metrics per iteration and a "Tested with" line. Check the lesson for secrets before it leaves the ledger.

## Never

- Write the lesson or judge the trials yourself. The teacher writes and judges; Maestro runs the checks and confirms.
- Put the expected result or a check's exact output into the lesson.
- Let a student see the teacher's notes, the acceptance list, or another student's trial.
- Change Maestro's files. This skill only calls Maestro.

## Other Maestro entry points

| Command | For |
|---|---|
| `/maestro` | The full run: any size, waves, panels, team mode when its gate holds |
| `/maestro-simple` | One task, one cheap worker, one review |
| `/maestro-plan` | Maestro's plan, with no workers started |
| `/maestro-review` | Independent reviewers, one consensus on evidence |
| `/maestro-team` | Workers that share findings on long, hard runs |
| `/maestro-council` | Several agents debate a question, Maestro chairs |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.
