---
name: skill-distill
description: >-
  Turns a good coding-agent session into a skill that lets a chosen
  open-weight or local model, in a chosen harness (omp, pi, Codex, Claude
  Code, OpenCode, Cursor, and others), reproduce the same task. The current agent is the teacher:
  it writes the skill, runs the student three times in tmux on fresh copies of
  the starting state, compares each result with the reference, fixes the skill
  at the first divergence, and repeats until the student matches and the user
  accepts. Use when the user says "distill this session", "make a skill so
  DeepSeek, GLM, Qwen, or a local model can do what you just did", "teach
  <model> in <harness> to reproduce this", or "skill-distill". Do not use to
  write a general-purpose skill with no reference session, to turn a video
  into a skill (use video-to-skill), or for fine-tuning.
compatibility: >-
  macOS or Linux (Windows through WSL). Python 3.10+, git, bash, and tmux;
  the student harness CLI on PATH and pointed at its model. Students run
  through the shared agent runner in scripts/agent. Web results need
  Playwright with Chromium and Pillow. Session logs are parsed for Claude
  Code, Codex, omp, and pi teachers.
license: MIT, see LICENSE
metadata:
  display-name: Skill Distill
  upstream: https://github.com/sybil-solutions/skill-distill
---

# Skill Distill

## Core Rule

Always respond in the user's language, regardless of the language used in this skill, the session, or the code. The student skill you write is in English unless the user asks otherwise, because open models follow English instructions best.

## Autonomous Mode

When the user says to work on your own, for example "do it yourself", "faz você mesmo", "you don't need to ask me", "não precisa me chamar", or "just do it", or when the request runs unattended:

- **Do not stop for input.** Skip questions, confirmations, and pauses that wait for the user. At each decision, take the option this skill recommends, or the safest default, and write the decision and the reason to `~/.gti/skill-distill/<project>/runs/<task>/decisions.md`.
- **Do not open anything for the user.** No browser tabs, viewers, editors, or servers started for the user to look at. Still write every file the run produces and give the paths at the end.
- **Never take a gated irreversible or outward action** unless the request already allows it: deleting the user's data, tests, or files; publishing, posting, pushing, or sending; paying; typing credentials. List each one as pending.
- **Finish with one report:** the decisions you took and why, what the iterations did, what is pending, and what you could not verify.

In this skill:

- Step 0 asks nothing. Take every input from its default. Only the student cannot be defaulted: if the user named no harness and model, stop before `init` and report the student as the one pending input. Never guess a model.
- An uncommitted starting state uses `--base <repo>@worktree`, which snapshots it inside the run folder. Never create a branch or commit in the user's repository.
- A failing smoke test ends the run with the error in the report; it is not a skill failure.
- Trials run in tmux without telling the user to attach. Wait with `distill.py wait` and keep working.
- Step 8 does not ask. Write `report.html` and do not open or publish it. Do not record `accept` for the user: report the best iteration's skill folder and the exact `accept` command as pending.
- Installing the final skill into a student harness is pending unless the request asked for it.

## Output Location

Everything this skill generates goes to `~/.gti/skill-distill/<project>/`, where `<project>` is the repository folder name and `GTI_HOME` replaces `~/.gti`. Each run lives in `~/.gti/skill-distill/<project>/runs/<task>/`: the reference summary, the student skill being edited, frozen iterations with their trial workspaces and traces, evidence, the ledger, `report.html`, and the accepted skill in `final/`. Smoke tests go to `~/.gti/skill-distill/<project>/smoke/`. Runs hold raw session logs and machine paths: never copy them into the user's repository, commit them, or publish them. Nothing is written to the user's repository, and the reference repository is only read and cloned.

## Roles

You are the **teacher**. A session went well: the **reference**. The user names a **student**: an agent harness plus a model (for example omp with DeepSeek-V4.1-Flash on a local server). The goal is a skill that lets the student do the same task from the same starting state, with the same prompt, and get a result as good. Invoking this skill on a session already says the user considers that session good.

Do not stop at a draft. Test the skill on the student, look at what it actually did, fix the skill where it went wrong, and test again. The **user** makes the final pass or fail call.

Everything deterministic is in `scripts/run/distill.py`, which starts students through the shared agent runner `scripts/agent/agent_run.py`; you do the judgement: what the skill says, and whether a trial matches. Paths below are relative to `<skill-dir>`, the folder that holds this file. Use `python3` on macOS and Linux. `<task>` is a short kebab-case name; `distill.py` resolves it to the run folder `<run>`, which is `~/.gti/skill-distill/<project>/runs/<task>/`.

## 0. Settle the inputs

Take these from the conversation. Ask only for what is missing and cannot be worked out.

| Input | Default |
|-------|---------|
| Student harness and model | Must be named by the user. See [references/harnesses/students.md](references/harnesses/students.md) |
| Reference session | The current session: pass `--reference claude` (or `codex`, `omp`) and `init` finds the newest session of `--reference-workspace`. Preview it with `python3 scripts/session/extract_session.py --current claude --cwd <dir>` |
| Task prompt | The first user message of the reference, verbatim, saved to `<run>/prompt.md`. Do not improve it: the student gets the same prompt |
| Starting state | The commit the reference started from: `git rev-list -1 --before=<session start> HEAD`, or `empty` for a task that starts from nothing |
| Reference result | The reference's working folder |

If the reference started from uncommitted changes, pass `--base <repo>@worktree`: `init` copies the repository into the run folder and commits the changes there, so the user's repository is not touched. If the task needs machines, services, or data outside the repository (a GPU box, an API), write down how each trial gets a clean copy and pass it as `--setup`. A trial that starts dirty cannot be judged.

## 1. Check the machine and the student

```bash
python3 scripts/setup/doctor.py --student <harness> [--web]
python3 scripts/run/distill.py smoke --student <harness>:<model> [--student-args="..."] [--env K=V]
```

`doctor.py` lists what is missing with the install command; it installs nothing. `smoke` asks the student to create `hello.txt` through the same runner command the trials use. A wrong model id, a missing key, or a server that is down would otherwise look like a skill failure. Tell the user that the student runs with every permission inside its throwaway workspace (see the harness reference).

## 2. Create the run

```bash
python3 scripts/run/distill.py init <task> --prompt <run>/prompt.md \
  --student <harness>:<model> --base <repo>[@<commit>|@worktree]|empty \
  --reference claude|codex|omp|<session.jsonl> --reference-workspace <dir> \
  [--setup "npm ci"] [--timeout-min 90]
```

Read `<run>/reference/reference.md` all the way through, then look at the reference result itself: open it, run it, read the important files. The summary is a map, not the result. With a teacher that has no log parser, write `reference/reference.md` by hand and omit `--reference`.

## 3. Write down what "as good" means

Write `<run>/acceptance.md`: 4 to 10 observable things that made the reference good, each checkable in a trial, with how it is checked. Prefer outcomes over method. Examples: "starts with no console errors", "pressing E at a tent feeds a person and the street count drops", "README says how to run it", "tok/s at C1 within 5% of the reference".

Then write `<run>/checks.sh`, which checks as much of that list as a script can. It gets `$WORKSPACE` and `$OUT`; screenshots and logs go to `$OUT`; it exits 0 only when every scripted check passes. For web apps, call `scripts/capture/capture_web.py` (see [references/workflow/02-judge.md](references/workflow/02-judge.md)). Run it on the reference first:

```bash
python3 scripts/run/distill.py evidence <task> --reference
```

**The checks must pass on the reference.** If they do not, the checks are wrong. Fix them before judging any trial.

## 4. Write the first student skill

Edit `<run>/skill/SKILL.md`, which starts from the template. Follow [references/workflow/01-student-skill.md](references/workflow/01-student-skill.md): steps in the order that mattered, decisions with reasons, traps, harness notes, scripts for mechanical steps, mandatory verification, no finished output, under about 250 lines.

## 5. Run the student

```bash
python3 scripts/run/distill.py trial <task> -k 3
python3 scripts/run/distill.py status <task>
python3 scripts/run/distill.py wait <task> --timeout 540
```

Each trial gets a fresh copy of the starting state, a frozen copy of the skill in `.skill/<name>/`, and the original prompt plus one line pointing at the skill. Nothing else. Run 3 trials per iteration: open models are noisy and one lucky run proves nothing. `wait` exits with code 2 at the timeout; repeat it until every trial exits, and keep working meanwhile (prepare checks, re-read the reference). The user can watch with `tmux attach -t distill-<task>`.

## 6. Judge each trial

```bash
python3 scripts/run/distill.py evidence <task>
python3 scripts/run/distill.py verdict <task> --iter N --trial K \
  --verdict match|close|miss|broken --score 0-10 \
  --divergence "step 4: started vite in the foreground, tool call hung for 20 min" \
  --note "what it got right and wrong" --fix "what you will change"
```

Read [references/workflow/02-judge.md](references/workflow/02-judge.md) before the first verdict. Find the first divergence, not the last symptom. `match` means you would show it to the user as equal to the reference; if you would hesitate, it is `close`. The student's final message is not evidence.

## 7. Fix the skill, then run again

Pick each fix from the failure kind in [references/workflow/03-fix.md](references/workflow/03-fix.md), make them in one edit, and go back to step 5. Revert a change that made the next iteration worse. Stop when all 3 trials of an iteration `match`, after 8 iterations, or after 3 iterations in a row with no better best score, and say what the student still cannot do.

## 8. The user decides

```bash
python3 scripts/run/distill.py report <task>
python3 scripts/run/distill.py accept <task> --iter N --decision pass|fail --note "<their words>"
```

`report` writes `report.html`: the reference and the trials side by side, the ledger, and the skill. Show it to the user (open the file, or publish it as a private page if your environment can and the user agrees), point them at the best trial's workspace so they can run it, and ask whether it is as good as the reference. Record their answer with `accept`. On `fail`, add their note to `acceptance.md` and go back to step 7. On `pass`, the skill is copied to `<run>/final/<name>/`.

## 9. Deliver

Add a "Tested with" line at the end of the final `SKILL.md` (harness, model, iterations, how many of the last trials matched). Check that it holds no secrets, private hostnames, or personal data from the reference. Install it into the student harness only if the user wants that (folders in [references/harnesses/students.md](references/harnesses/students.md)).

Report the skill path, the pass rate per iteration (`distill.py ledger <task>`), what changed between versions and why, and what the student still does worse than the reference. `distill.py list` shows every run of the project.

## Running in your agent

The skill works the same in every coding agent that can run shell commands. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.
