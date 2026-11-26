# Teacher and student mode

A teacher agent writes a lesson: a set of instructions, a skill, a brief template, a runbook, or a system prompt. Student agents get only that lesson and a task, each in a fresh chat on a fresh copy of the starting state. The teacher reads what each student did, finds where it went wrong or wasted effort, fixes the lesson, and runs the students again. The lesson is done when the students do the task with mastery: right, and without wasted effort.

This mode runs only when the user asks for it by name. It is never chosen by Maestro, by a run profile, or by autonomous mode.

## When it runs

Turn it on only when the user explicitly asks for it, for example "teacher and student", "professor e aluno", "teach a cheaper model to do this", or `/maestro teach <goal>`. Do not infer it from a task that would benefit from it; say in one line that the mode exists and continue with a normal run.

Typical uses:

- **Teach a task to a cheaper model.** The lesson lets a fast or free model do what only a strong model did before.
- **Test a set of instructions.** A skill, a prompt, or a brief template is proven by students following it, not by reading it.
- **Make a student's output smarter.** The student gets it right but too slowly: long outputs, overthinking what is already in front of it, re-deriving given facts. The lesson is tuned until the same result comes shorter and faster.

When the goal is to turn one good past session into a skill for a named harness and model, the Skill Distill skill does exactly that with its own trial tooling. Suggest it in one line, and continue in Maestro if the user prefers.

## Roles

| Role | Who | Does | Does not |
|---|---|---|---|
| Teacher | A worker chat on a strong model (T3), one chat for the whole lesson | Writes the lesson, the acceptance list, the checks, and the task set; judges each trial; revises the lesson | See its own lesson as proof; write the student's answer into the lesson |
| Student | A fresh worker chat per trial, on the model the lesson is for | Does the task with only the lesson and the task prompt | See the teacher's notes, the reference result, the acceptance list, or another student's trial |
| Maestro | The orchestrator, as always | Spawns both, isolates the trials, runs the checks itself, confirms or rejects the teacher's verdict, keeps the ledger | Write the lesson, judge in place of the checks, or do the task |

The teacher concludes when the lesson is mastered. Maestro confirms it with the evidence, as it does for every worker: the teacher's "mastered" is a claim, and the checks that Maestro runs are the proof.

Pick the student model by the goal: the model the user named, or the cheaper model the lesson is meant for. The teacher and the students should be from different model families when the catalog allows it, so the teacher cannot rely on the student thinking like itself.

## Experiment designs

Change one thing at a time, so a difference between trials has one cause.

| Design | Same | Varies | Answers |
|---|---|---|---|
| Repeat | Task and lesson | Nothing (3 students) | Is the lesson reliable, or did one student get lucky? |
| Instruction A/B | Task | Lesson variant (one per student, 2 to 3 variants) | Which wording, order, or example works best? |
| Generalization | Lesson | Task (training tasks plus held-out tasks) | Does the lesson teach the skill, or only this one task? |
| Student comparison | Task and lesson | Student model | Which cheaper model can follow it? |

Rules:

- Run at least 3 students per iteration. One trial proves nothing; models are noisy.
- In an A/B, give each variant the same tasks and the same number of students, and keep the variants as different as one decision, not three.
- Keep at least one held-out task the teacher never revises against. A lesson that passes only the tasks it was tuned on is overfit.
- Never put the expected result, the reference answer, or a check's exact output into the lesson. That is teaching to the test.

## The loop

```text
  1. teacher: acceptance list, checks, task set, lesson v1
  2. Maestro: freeze the lesson, spawn the students in parallel, isolated
  3. students: do the task, return the output contract and their trace
  4. Maestro: run the checks on every trial, collect the metrics
  5. teacher: judge each trial, find the first divergence and the waste
  6. Maestro: confirm the verdicts against the evidence
  7. mastered? -> report      not yet -> teacher revises the lesson -> 2
```

1. **Set the bar.** The teacher writes `acceptance.md` with 4 to 10 observable results, each with how it is checked, and a script or command list that checks as many as possible. Run the checks on a known good result first: if they fail there, the checks are wrong.
2. **Write the lesson.** Steps in the order that matters, the decisions with their reasons, the traps, the facts the student would otherwise rediscover, and a mandatory verification step. No finished output.
3. **Run the students.** Each student gets a fresh worktree or a copy of the starting state, the frozen lesson, and the task prompt, and nothing else. Spawn them in parallel; they write nothing shared. On Paseo, spawn them quiet; keep their chats (not ephemeral) so the teacher can ask a student why it did something.
4. **Measure.** Maestro runs the checks and records the metrics below for every trial.
5. **Judge.** The teacher reads each trace and output, and records a verdict, a score, the first divergence, and the waste. Find the earliest point that explains the gap, not the last symptom. The student's own "all done, verified" is not evidence.
6. **Revise.** The teacher makes one edit for everything it saw, chosen from the fix table, and freezes the next iteration. A change that made the next iteration worse is reverted, not patched over.

## Mastery

An iteration is mastered when every student in it:

- passes every acceptance item, by Maestro's checks;
- stays inside the efficiency budget the teacher set at step 1 (for example output length, turns or tool calls, tokens, wall time);
- and, in a generalization design, passes the held-out tasks too.

Stop when an iteration is mastered, after 6 iterations, or after 2 iterations in a row with no better best score. A lesson the students cannot master is a result too: report what they still cannot do, where they fail, and what was tried.

## Making the output smarter

The waste is as important as the errors. For every trial, record:

| Metric | Source |
|---|---|
| Output length | Characters or lines of the final answer |
| Turns and tool calls | The harness trace or the session log |
| Tokens and cost | When the harness reports them |
| Wall time | Spawn to result |
| Rework | Files or commands the student redid, facts it re-derived that the lesson or the task already gave |

The teacher reads the trace for these patterns and fixes the lesson for each:

| What the student did | Fix in the lesson |
|---|---|
| Thought at length about something already in the task or the lesson | Put the fact first, under "Given", and say "this is settled, do not re-check it" |
| Explored the whole repository to find one file | Name the file and the symbol; give the search command that finds it |
| Wrote a long answer when a short one was asked | An output contract with sections and a length limit, and one short example |
| Hedged, listed options, or asked instead of deciding | A decision table with the default for each case |
| Repeated the same failing command | A stop rule: after 2 identical failures, report the error |
| Verified by reading its own code | The exact command that verifies, and its expected result |
| Got it right only after a detour | Move the step that the detour was missing earlier in the lesson |

A shorter output that loses a correct result is not an improvement. Efficiency counts only once every acceptance item passes.

## The ledger

```text
~/.gti/maestro/<project>/lessons/<lesson-id>/
├── goal.md            # what the lesson teaches, for which student model, the design
├── acceptance.md      # observable results and how each is checked
├── checks.sh          # or checks.md: the commands Maestro runs on every trial
├── tasks/             # training tasks and held-out tasks, one prompt each
├── lesson/            # the current lesson (a SKILL.md, a prompt, a brief)
├── iters/<NN>/
│   ├── lesson/        # the frozen lesson of iteration NN, per variant in an A/B
│   └── trials/<k>/    # one student: brief, output, trace, check log, metrics
├── trials.jsonl       # one line per trial, see below
└── report.md
```

One line per trial in `trials.jsonl`:

```json
{"iter":2,"trial":1,"variant":"B","task":"t2-heldout","student":{"provider":"opencode","model":"deepseek-v4.1-flash","chat":"agent_456"},"verdict":"close","score":7,"checks":{"passed":5,"total":6},"metrics":{"outputChars":5400,"turns":31,"toolCalls":48,"tokens":182000,"seconds":610,"rework":["re-read the schema after the lesson gave it"]},"divergence":"step 3: ran the full test suite before the focused test","fix":"move the focused test command to step 2 and say the full suite runs last","confirmed":true}
```

Verdicts are the Skill Distill ones: `match` (as good as the bar, you would show it to the user), `close` (every item passes but the craft is visibly lower or the budget is exceeded), `miss` (an acceptance item fails), and `broken` (no usable result, or the trial's environment was broken; fix the environment and do not count it).

Worker records use `type: "teacher"` and `type: "student"`, with `lesson`, `iter`, `trial`, and `variant`. `run.json` gets `teaching: {lesson, design, studentModel, iteration, status}`.

## Deliver

- The mastered lesson, copied to where the user asked (for example a skill folder in their repository), or left in `lessons/<lesson-id>/lesson/` when they named no place.
- `report.md`: the score and metrics per iteration, what changed in the lesson between iterations and why, the A/B winner and by how much, the held-out results, and what the students still do worse.
- A "Tested with" line at the end of the lesson: student model, harness, iterations, and how many of the last trials matched.
- Check the lesson for secrets, private hostnames, and personal data before it leaves the ledger.
