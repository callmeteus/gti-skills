---
name: maestro-council
description: >-
  Convenes a council through the Maestro skill: 3 to 7 worker agents, on
  different model families when possible, debate one question or decision
  among themselves. Each writes a blind opening position, then they argue
  directly with each other on a shared floor (Maestro's team mailbox) for up
  to 3 rounds, and each casts a blind final vote with its confidence. Maestro
  chairs: it frames the question, assigns lenses and a devil's advocate,
  watches for herding, sycophancy, and collusion, and writes the verdict with
  the majority, the dissent, and what would change the answer. Read-only: the
  council changes nothing. Use when the user types /maestro-council or asks
  for a council, a congress, a debate between agents, several AIs discussing
  a topic, or a vote between models on a decision. Do not use for reviewing a
  diff (use maestro-review, whose reviewers must stay independent) or for
  doing the work (use maestro-simple or maestro).
compatibility: >-
  Needs the Maestro skill installed in the same skills folder (the gti-skills
  installer adds it), and an agent that can spawn subagents or a worker CLI
  on PATH.
license: No license declared
metadata:
  display-name: Maestro Council
---

# Maestro Council

## Core Rule

Always respond in the user's language, regardless of the language used in this skill, in Maestro's files, in the code, or in its comments. Plans, briefs, review notes, and the report follow the user's language; identifiers, commands, and file paths stay as they are.

## Autonomous Mode

When the user says to work on your own, for example "do it yourself", "faz você mesmo", "you don't need to ask me", "não precisa me chamar", or "just do it", or when the request runs unattended:

- **Do not stop for input.** At each decision, take the option this skill or Maestro recommends, and write the decision and the reason to `~/.gti/maestro/<project>/decisions.jsonl`.
- **Do not open anything for the user.** No browser tabs, viewers, the central, or servers to look at. Still write every file the run produces and give the paths at the end.
- **Never take a gated irreversible or outward action** the request did not allow: deleting the user's data or files, pushing, posting, opening pull requests or issues, paying, typing credentials, or deploying. List each one as pending.
- **Finish with one report:** the decisions and why, what the workers did, what is pending, and what was not verified.

In this skill:

- The council size, the lenses, and the rounds are not questions. Use 5 members, the lenses that fit the question, and up to 3 rounds, and record them.
- The verdict is advice. Acting on it with a gated action (deleting, publishing, deploying, paying) goes to the pending list, never into a worker's brief.
- Everything else follows the Autonomous Mode section of Maestro's `SKILL.md`.

## Output Location

This skill writes into Maestro's ledger, `~/.gti/maestro/<project>/`, where `<project>` is the repository folder name and `GTI_HOME` replaces `~/.gti`, so `/maestro status`, `/maestro resume`, `/maestro report`, and the central see the run. It keeps no folder of its own. Nothing generated goes into the user's repository: only the changes the user asked for go there, and a generated file goes there only when the user names that place.

## What this skill is

A short entry point into the Maestro skill. It runs a council: a debate among worker agents that Maestro convenes and chairs, using Maestro's routing, briefs, ledger, and team mailbox. Maestro has no command for it: the procedure is in this skill's `references/council.md`, and Maestro does the spawning, routing, and ledger. Maestro itself is unchanged: its rules, ledger, routing, and review all apply, and Maestro still never does the task itself.

```text
/maestro-council <question or decision> [--members <3-7>] [--rounds <1-3>]
```

## Load Maestro first

1. Read `<skill-dir>/../maestro/SKILL.md`, the Maestro skill installed next to this one, before anything else. Inside Maestro's files, `<skill-dir>` means the Maestro folder (`<skill-dir>/../maestro/`), not this one: its scripts and references are there.
2. If that file is missing, load the skill named `maestro` the way your agent loads skills.
3. If neither exists, stop and tell the user to install it: `node packages/cli install --skill maestro-council --harness <agent>` installs Maestro together with this skill.
4. Read each Maestro reference named below at the step that needs it, not all at once.

## Run

1. **Frame the question.** Read [`references/council.md`](references/council.md). Turn the request into one question with its options, the context each member needs (files to read, facts, constraints), and what a good answer must weigh. Follow Maestro's intake ([`01-intake.md`](../maestro/references/workflow/01-intake.md)) for the harness, preferences, and catalog, record `entry: "maestro-council"` in `run.json`, and create `councils/<id>/` in Maestro's ledger.
2. **Seat the members.** 3 to 7 members, 5 by default, odd so a vote breaks ties. Route each with Maestro's router ([`03-router.md`](../maestro/references/routing/03-router.md)) on a different model family when the catalog has them, give each a lens from [`council.md`](references/council.md#seats-and-lenses), and make one member the devil's advocate.
3. **Opening positions, blind.** Spawn every member in a fresh, quiet chat in parallel with the member brief. Each returns its opening position without seeing anyone else's. Save them as `open/<seat>.md`.
4. **Open the floor.** Open a team folder for the council with Maestro's mailbox (`<skill-dir>/../maestro/scripts/team/mailbox.py --team <ledger>/councils/<id>/floor open --members <seats> --goal "<question>"`). Post every opening position to the floor under its seat name, then tell each member in its own chat to read the floor and answer the others.
5. **Debate, up to 3 rounds.** In each round, every member reads the floor, answers the arguments it disagrees with (board posts, or direct `question` and `answer` messages to another seat), and posts its current position. Maestro moderates between rounds and ends the debate early when a round brings no new argument.
6. **Blind final vote.** Each member, in its own chat and without seeing the others' votes, casts its vote: the option, its confidence, the strongest argument for it, and the strongest argument against it.
7. **Verdict.** Maestro writes `verdict.md`: the question, the vote, the outcome (consensus, majority with dissent, or no decision), the arguments that won, the dissent in its own words, what evidence would change the answer, and any sign of herding or collusion. The verdict is advice; the decision stays with the user.

## Never

- Debate as a member, or write a member's position. Maestro chairs and summarizes; the members argue.
- Score, remove, or threaten a member for disagreeing. Members are judged on arguments, never on agreeing with the majority or with Maestro.
- Let the council edit files, push, post, or take any gated action. It is read-only, and its verdict is advice.
- Count a vote cast after members saw each other's votes, or treat a unanimous vote without new arguments as proof.
- Change Maestro's files. This skill only calls Maestro.

## Other Maestro entry points

| Command | For |
|---|---|
| `/maestro` | The full run: any size, waves, panels, team mode when its gate holds |
| `/maestro-simple` | One task, one cheap worker, one review |
| `/maestro-plan` | Maestro's plan, with no workers started |
| `/maestro-review` | Independent reviewers, one consensus on evidence |
| `/maestro-team` | Workers that share findings on long, hard runs |
| `/maestro-teach` | A teacher writes the lesson, students prove it |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.
