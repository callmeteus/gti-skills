# Review panel

A review panel is 1 to 5 reviewer workers that review the same pull request, or the same diff, each on its own, without seeing each other. Maestro alone builds the consensus: it gathers their findings, matches the ones that describe the same defect, settles the disputed ones with evidence, and decides the final list. The reviewers never talk to each other; if a point needs debate, Maestro carries each side to the other reviewer's own chat and judges the answers.

Use a panel for every pull request a worker opened, for a pull request the user asks Maestro to review, and for the final diff of a complex run. It reviews a local diff the same way when there is no pull request.

## Panel size

Size the panel by the change, then add for risk. Never more than 5.

| Change size (lines added plus removed) | Reviewers |
|---|---|
| Up to 50 | 1 |
| 51 to 300 | 2 |
| 301 to 1,000 | 3 |
| 1,001 to 3,000 | 4 |
| More than 3,000 | 5, and suggest splitting the pull request |

Add 1 reviewer, up to 5, when the change touches security, authentication, money, data deletion or migrations, concurrency, or a public interface. Ignore generated files, lockfiles, and snapshots when counting lines.

The user can set the size for a run or durably (`defaults.reviewPanel`, for example `{"min": 2, "max": 4}`); their setting wins over the table, still within 1 to 5.

## Choosing the reviewers

- **Different model families when the catalog has them.** Two reviewers on the same model tend to miss the same thing. The worker that wrote the change is never on its panel.
- **Every reviewer reviews the whole change.** Consensus needs overlap. A reviewer may get one extra lens to look at harder (security, tests, performance), but it still reports everything it finds.
- **Strong enough to judge.** Reviewers route as `verify` tasks: quality and context first.

## Keeping them independent

The value of a panel is that the reviewers agree without having talked. Research on isolated agents (see [team.md](team.md#what-the-research-shows)) found that agents can pass information through any surface they share, so independence is something Maestro builds and then checks:

- **No shared channel.** Reviewers are never members of a team, never get the team folder or a mailbox, and never see another reviewer's chat, output, or file.
- **No shared writable surface.** Each reviewer gets the diff and a read-only checkout or its own worktree. Nothing a reviewer writes goes anywhere another reviewer reads.
- **No reason to coordinate.** The brief says the reviewers are scored on findings that hold up under evidence, not on agreeing with anyone.
- **Fresh chats.** Each reviewer is a new chat, spawned in parallel, quiet. Reuse a reviewer's chat only for its own follow-up round.
- **Check the output.** Two reviews with the same unusual wording, the same order of findings, or the same wrong claim are a sign they were not independent. Treat their agreement as one vote and record why.

Reviewers are read-only. They do not push, comment on the pull request, open issues, or fix anything. Only Maestro posts, and only with permission.

## The reviewer brief

Each reviewer gets the pull request URL or the diff, the base, the task's goal and done criteria, the project's checks, and this output contract:

```text
VERDICT: approve | changes | block
FINDINGS:
  - id: R1
    severity: blocker | major | minor | nit
    file: path/to/file.ts
    line: 42
    claim: one sentence, the defect
    scenario: concrete input or state -> wrong result
    evidence: the command and its output, a failing test, or the exact lines that prove it
    confidence: high | medium | low
CHECKED: what you read and ran, so a missing finding means "looked and found nothing"
NOT CHECKED: what you could not check, and why
```

A finding without a scenario and evidence is a question, not a finding; the reviewer marks it `confidence: low`.

## Building the consensus

Maestro does this itself. It is review work, not the task.

1. **Collect.** Wait for every reviewer, or for the timeout; a reviewer that did not answer is recorded, and the panel continues with the rest.
2. **Match.** Group findings that describe the same defect: the same cause at the same place, even if worded differently. A group keeps every reviewer's evidence.
3. **Classify each group.**

| Group | Rule |
|---|---|
| Reported by 2 or more reviewers, evidence holds | `confirmed` |
| Reported by 1 reviewer, evidence holds when Maestro runs or reads it | `confirmed` |
| Reported by 1 reviewer, evidence unclear | `disputed`: go to step 4 |
| Reviewers contradict each other (one says bug, one says correct) | `disputed`: go to step 4 |
| Evidence does not hold when Maestro checks it | `rejected`, with the reason |

4. **Mediated debate, at most 2 rounds.** For each disputed group, Maestro sends the claim and its evidence, anonymized ("another reviewer says..."), to one or two other reviewers in their own chats, and asks them to confirm or refute it with evidence of their own. It sends the answer back to the reviewer that raised it if that answer refutes the claim. The reviewers argue through Maestro, never with each other.
5. **Decide.** Evidence beats votes. A single reviewer with a failing test outweighs three that did not see the problem. A majority that cannot show the defect does not make it real. What is still unsettled after 2 rounds is `unresolved`: it goes to the report as a plausible risk, with both sides.
6. **Verdict on the change.** Any confirmed `blocker` or `major` finding means FIX; only `minor` and `nit` findings mean PASS with notes.

## After the consensus

- **Fixes go to the author's chat.** Confirmed findings, numbered, go back to the worker that wrote the change, as every FIX does. After the fix, a smaller panel (the reviewers whose findings were fixed, or 1 reviewer) checks the fix only.
- **Out of scope findings** become pending items, or issues when the `issues` permission is on (see [../harness/github.md](../harness/github.md)).
- **Posting.** With `reviewComments` on, Maestro posts one consolidated review on the pull request: the confirmed findings with file and line, and the unresolved ones marked as such. Without it, the review stays in the ledger and the report. Maestro never approves or merges on the forge.

## Ledger

```text
~/.gti/maestro/<project>/reviews/<pr-or-task-id>/
├── panel.json        # size, reason, reviewers (model, chat), status
├── r<k>.md           # each reviewer's raw output
├── consensus.json    # groups: members, class, evidence, debate rounds, decision
└── consensus.md      # the final list, readable without the rest
```

Reviewer records in `workers.jsonl` use `type: "review"` with `panel` set to the folder id. Every debate prompt is an `audit.jsonl` line with action `debate`.
