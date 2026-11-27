---
name: maestro-review
description: >-
  Shortcut into the Maestro skill's review panel: reviews a pull request, a
  branch, or the local diff with 1 to 5 independent read-only reviewer
  workers sized by the change and its risk. Reviewers never talk to each
  other. Maestro matches their findings, settles disputes with a mediated
  debate of at most 2 rounds, and decides on evidence, not votes. Posts the
  consolidated review only with the user's permission. Use when the user
  types /maestro-review, asks for a review panel, several reviewers, or a
  consensus review of a PR or diff. Do not use for a quick single-reviewer
  look the current agent can do itself, or for fixing the code (findings go
  back to the author).
compatibility: >-
  Needs the Maestro skill installed in the same skills folder (the gti-skills
  installer adds it), and an agent that can spawn subagents or a worker CLI
  on PATH.
license: No license declared
metadata:
  display-name: Maestro Review
---

# Maestro Review

## Core Rule

Always respond in the user's language, regardless of the language used in this skill, in Maestro's files, in the code, or in its comments. Plans, briefs, review notes, and the report follow the user's language; identifiers, commands, and file paths stay as they are.

## Autonomous Mode

When the user says to work on your own, for example "do it yourself", "faz você mesmo", "you don't need to ask me", "não precisa me chamar", or "just do it", or when the request runs unattended:

- **Do not stop for input.** At each decision, take the option this skill or Maestro recommends, and write the decision and the reason to `~/.gti/maestro/<project>/decisions.jsonl`.
- **Do not open anything for the user.** No browser tabs, viewers, the central, or servers to look at. Still write every file the run produces and give the paths at the end.
- **Never take a gated irreversible or outward action** the request did not allow: deleting the user's data or files, pushing, posting, opening pull requests or issues, paying, typing credentials, or deploying. List each one as pending.
- **Finish with one report:** the decisions and why, what the workers did, what is pending, and what was not verified.

In this skill:

- The panel size is not a question. Use the table, the saved setting, or the size in the request.
- Posting needs the `reviewComments` permission from the request or `defaults.forge`. Without it, the review stays in the ledger and is listed as pending.
- Everything else follows the Autonomous Mode section of Maestro's `SKILL.md`.

## Output Location

This skill writes into Maestro's ledger, `~/.gti/maestro/<project>/`, where `<project>` is the repository folder name and `GTI_HOME` replaces `~/.gti`, so `/maestro status`, `/maestro resume`, `/maestro report`, and the central see the run. It keeps no folder of its own. Nothing generated goes into the user's repository: only the changes the user asked for go there, and a generated file goes there only when the user names that place.

## What this skill is

A short entry point into the Maestro skill. It runs Maestro's review panel ([`review-panel.md`](../maestro/references/modes/review-panel.md)). It is the same as `/maestro review pr <url or number>`, without having to know the Maestro command. Maestro itself is unchanged: its rules, ledger, routing, and review all apply, and Maestro still never does the task itself.

```text
/maestro-review <pull request, branch, or nothing for the local diff>
```

## Load Maestro first

1. Read `<skill-dir>/../maestro/SKILL.md`, the Maestro skill installed next to this one, before anything else. Inside Maestro's files, `<skill-dir>` means the Maestro folder (`<skill-dir>/../maestro/`), not this one: its scripts and references are there.
2. If that file is missing, load the skill named `maestro` the way your agent loads skills.
3. If neither exists, stop and tell the user to install it: `node packages/cli install --skill maestro-review --harness <agent>` installs Maestro together with this skill.
4. Read each Maestro reference named below at the step that needs it, not all at once.

## Run

1. **Find the change.** A pull request URL or number, a branch against its base, or, with nothing given, the local diff (`git diff` plus staged changes). Read it with the forge's CLI or MCP server; record `entry: "maestro-review"` in `run.json`.
2. **Size the panel.** Use the panel table in [`review-panel.md`](../maestro/references/modes/review-panel.md): 1 to 5 reviewers by changed lines, plus 1 for risk. A size the user gave, or `defaults.reviewPanel`, wins within 1 to 5.
3. **Spawn the reviewers.** Fresh, read-only, quiet chats in parallel, on different model families when the catalog has them, each with the reviewer brief and output contract from `review-panel.md`. No mailbox, no shared writable folder.
4. **Build the consensus.** Match findings by defect, classify them, run the mediated debate for disputed ones, and decide on evidence. Write `reviews/<id>/` in the ledger.
5. **Report.** The verdict (PASS, PASS with notes, or FIX), the confirmed findings with file, line, scenario, and evidence, the unresolved ones with both sides, and what no reviewer checked.
6. **Post only with permission.** With the `reviewComments` permission (see [`github.md`](../maestro/references/harness/github.md)), post one consolidated review. Without it, give the review text so the user can post it.

## Never

- Let the reviewers see each other's output, share a folder, or join a team.
- Fix the code. Confirmed findings go to the author: the worker chat that wrote it, or the user.
- Approve, merge, or enable auto-merge on the forge.
- Change Maestro's files. This skill only calls Maestro.

## Other Maestro entry points

| Command | For |
|---|---|
| `/maestro` | The full run: any size, waves, panels, team mode when its gate holds |
| `/maestro-simple` | One task, one cheap worker, one review |
| `/maestro-plan` | Maestro's plan, with no workers started |
| `/maestro-team` | Workers that share findings on long, hard runs |
| `/maestro-teach` | A teacher writes the lesson, students prove it |
| `/maestro-council` | Several agents debate a question, Maestro chairs |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.
