---
name: fast-ci
description: >-
  Makes CI as fast as possible without letting it lie: PR results in under 1
  minute at p50 and 2 at p95, the full suite still gating main, and no failure
  hidden by retries, wider timeouts, or skips. Audits the last 150 runs split
  into waiting, setup, and running at p50 and p95, then hits per-stage budgets
  with warm runners, baked images, seeded caches, fast tools, shards balanced by
  recorded time, test selection proven to go red, parallel jobs, hooks, and
  jobs that fail over budget, and checks rollback scripts, jobs, and migrations
  with timed drills. Works on GitHub Actions, Forgejo, Gitea,
  Woodpecker, GitLab CI, Jenkins, Kubernetes and K3s runners (Tekton, Argo,
  ARC, act_runner), and manual script CI. Use when the user says CI is slow,
  wants PR feedback in a minute, sharding, test selection, caching, runner
  changes, a rollback review, or a CI time and cost report. Do not use for
  writing tests (use better-tests) or infrastructure unrelated to CI.
metadata:
  display-name: Fast CI
---

# Fast CI

## Core Rule

Always respond in the user's language, regardless of the language used in this skill, its references, or the repository being analyzed.

## Autonomous Mode

When the user says to work on your own, for example "do it yourself", "faz você mesmo", "you don't need to ask me", "não precisa me chamar", or "just do it", or when the request runs unattended:

- **Do not stop for input.** Skip questions, confirmations, and pauses that wait for the user. At each decision, take the option this skill recommends, or the safest default, and note the decision and the reason.
- **Do not open anything for the user.** No browser tabs, viewers, editors, or servers started for the user to look at. Still write every file the skill produces and give the paths at the end.
- **Never take a gated irreversible or outward action** unless the request already allows it: deleting the user's data, tests, or files; publishing, posting, pushing, or sending; paying; typing credentials. List each one as pending instead.
- **Finish with one report:** the decisions you took and why, what you did, what is pending, and what you could not verify.

In this skill:

- **Which CI system (step 1):** detect it from the repository files (`.github/workflows`, `.forgejo/workflows`, `.gitea/workflows`, `.woodpecker`, `.gitlab-ci.yml`, `Jenkinsfile`, Tekton or Argo manifests, `Makefile` or `scripts/ci*`). With several, audit each.
- **No API access for the audit (step 2):** time the pipeline locally with `ci_timings.py record`, mark the audit as local-only in the report, and list the real-run audit as pending with the exact command.
- **Runner vendor, bigger machines, new accounts, secrets (step 3):** never sign up, add secrets, or raise a bill. Prepare the change on a branch or as a patch, and add it to the pending list with the expected monthly cost.
- **Tool switches (step 4):** switch only after the side-by-side run shows the new tool misses nothing; when it misses something, keep the old tool and record why.
- **Deleting change-detector tests (step 5):** never delete tests in this mode. Write the evidence log and list the candidates as pending.
- **Rollback drills (step 8):** drill only against staging, a preview environment, or a throwaway namespace you can identify from the repository; never against production. With no such environment, run only the scan and list the drill as pending with the exact command.
- **Opening pull requests (step 9):** commit one change per branch locally when the request allows commits; never push or open pull requests unless the request said so. List each as pending.
- **Merge queue or branch protection settings:** these are repository settings; list them as pending with the exact setting to change.

## Output Location

Everything this skill generates (timing rows, audits, shard plans, failure logs, reports, and run state) goes to `~/.gti/fast-ci/<project>/`, where `<project>` is the repository folder name and `GTI_HOME` replaces `~/.gti`. Create the folder when needed. Never write generated files into the user's repository: only the changes the user asked for (workflow files, runner images, hook config, lint config, test changes, `AGENTS.md` rules) go there, and a generated file goes there only when the user names that place. A shard timing file that CI itself needs is produced by CI on main and stored as a CI artifact or cache, not committed by this skill.

| Folder | Contents |
|--------|----------|
| `~/.gti/fast-ci/<project>/timings/` | Normalized timing rows (`.jsonl`) from `ci_timings.py collect` and `record` |
| `~/.gti/fast-ci/<project>/audits/` | `ci_timings.py analyze` results (`.md` and `.json`) |
| `~/.gti/fast-ci/<project>/shards/` | `shard_plan.py plan` results |
| `~/.gti/fast-ci/<project>/rollback/` | `rollback_check.py scan` results (`.md` and `.json`) and `drills.jsonl` |
| `~/.gti/fast-ci/<project>/failures.md` | The two-week log of every test failure: caught regression or change detector |
| `~/.gti/fast-ci/<project>/reports/` | The final report from the template |
| `~/.gti/fast-ci/<project>/state.md` | Baseline numbers, the change list, and what shipped when |

## When to use

- The user says CI is slow, PRs wait too long, or wants CI under a minute.
- The user asks about sharding, test selection, caching, runners, runner images, or merge queues.
- The user wants to know where CI time and money go, with before and after numbers.
- The user has flaky checks that are being retried, or timeouts that keep growing.
- The user wants rollback scripts, rollback jobs, or down migrations reviewed, or wants to know how long a rollback takes.

Do not use this skill to write new tests or fix weak tests (use `better-tests`), to tune page speed (use `web-performance-audit`), or for infrastructure that is not CI (use `infra-expert`).

## The three rules

These outrank speed. Read [references/workflow/01-rules-and-scope.md](references/workflow/01-rules-and-scope.md) before any change.

1. **The full suite runs before anything reaches main**, in a merge queue or an equivalent gate. Test selection only narrows PR feedback.
2. **Never hide failures.** No retries, wider timeouts, or skipped tests. A check that needs a retry has a bug: find it.
3. **Never check less.** Lint rules and required checks only stay or grow.

## Budgets

| Stage | Budget |
|-------|--------|
| PR time to result | p50 under 60 s, p95 under 120 s |
| Waiting (queue to start) | under 5 s |
| Setup (clone, toolchain, dependencies, caches) | under 15 s |
| Slowest job | under 35 s; no required job waits on another |
| Lint | under 1 s |
| Format check | under 1 s |
| Typecheck | under 5 s |
| Tests | under 30 s per shard; split any file over 20 s |
| Local hooks | under 9 s |

Budgets are targets for the stack, not excuses: when a budget is impossible on the user's stack (a 4-minute Gradle build, a native toolchain), say so with the measurement and set the tightest honest budget instead.

## Instructions

1. **Rules and scope.** Detect the CI system, the stack, the package manager, the test runner, and how PRs merge. Read [references/workflow/01-rules-and-scope.md](references/workflow/01-rules-and-scope.md), then the platform guide for every CI system found:

   | Platform | Guide |
   |----------|-------|
   | GitHub Actions | [references/platforms/github-actions.md](references/platforms/github-actions.md) |
   | Forgejo and Gitea Actions | [references/platforms/forgejo-gitea.md](references/platforms/forgejo-gitea.md) |
   | Woodpecker | [references/platforms/woodpecker.md](references/platforms/woodpecker.md) |
   | GitLab CI | [references/platforms/gitlab.md](references/platforms/gitlab.md) |
   | Jenkins | [references/platforms/jenkins.md](references/platforms/jenkins.md) |
   | Kubernetes and K3s runners (Tekton, Argo, ARC, act_runner, Woodpecker and Jenkins agents) | [references/platforms/kubernetes.md](references/platforms/kubernetes.md) |
   | Manual or script-based CI (Makefile, shell, cron, a build box) | [references/platforms/manual.md](references/platforms/manual.md) |
   | Anything else (CircleCI, Buildkite, Drone, Azure Pipelines, Bitbucket, TeamCity) | [references/platforms/other.md](references/platforms/other.md) |

2. **Audit.** Pull the last 150 runs and split every job into waiting, setup, and running at p50 and p95:

   ```bash
   python3 <skill-dir>/scripts/audit/ci_timings.py collect github --repo owner/app
   python3 <skill-dir>/scripts/audit/ci_timings.py analyze ~/.gti/fast-ci/<project>/timings/github-*.jsonl
   ```

   Fix the biggest bucket of the critical path first. Save the baseline to `state.md`. Read [references/workflow/02-audit.md](references/workflow/02-audit.md).

3. **Waiting and setup.** Get waiting under 5 s (warm runners, cancel superseded runs) and setup under 15 s (toolchain baked into the image, caches seeded from main above 95% hits, dependencies cached as installed, blobless or shallow clones). Read [references/workflow/03-waiting-and-setup.md](references/workflow/03-waiting-and-setup.md).

4. **Tools.** Move lint, format, typecheck, tests, install, and scripts to the fastest tools for the stack, each switch proven by a side-by-side run. The tools are defaults; keeping an old one needs a measured reason. Read [references/workflow/04-tools.md](references/workflow/04-tools.md) and [references/stacks/toolchains.md](references/stacks/toolchains.md).

5. **Tests and shards.** Isolate modules not processes, reset state after every file, run in random order, buy cores before shards, give each shard its own throwaway database, balance shards by recorded time, and prove the shards ran every file:

   ```bash
   python3 <skill-dir>/scripts/shards/shard_plan.py plan --timings main-junit/*.xml --shards 4 --files "src/**/*.test.ts"
   python3 <skill-dir>/scripts/shards/shard_plan.py verify --files "src/**/*.test.ts" --ran shard-*/junit.xml
   ```

   Start the two-week failure log for evidence-based test removal. Read [references/workflow/05-tests-and-shards.md](references/workflow/05-tests-and-shards.md).

6. **Selection and shape.** Run lint, typecheck, build, and tests in parallel; fold the small checks into one job that lists every failure; on PRs run only the tests the diff can reach, list the inputs that rerun everything, then hide a real change from the selector on purpose and confirm CI goes red. Read [references/workflow/06-selection-and-shape.md](references/workflow/06-selection-and-shape.md).

7. **Local hooks and budgets.** Pre-commit formats and lints staged files, pre-push runs the same check as CI, under 9 s, as a hook and not a line in `AGENTS.md`, because agents skip steps. Fail every job that exceeds its budget. Read [references/workflow/07-local-and-budgets.md](references/workflow/07-local-and-budgets.md).

8. **Rollback.** A fast CI ships often, so a bad release must come back fast: one command that redeploys the pinned artifact of the last good release (never a rebuild, never `latest`), fails loudly, waits until healthy, runs from CI, and finishes in under 5 minutes. Migrations keep the previous app version working (expand and contract), so an app rollback never needs a down migration. Scan, fix, then drill against staging:

   ```bash
   python3 <skill-dir>/scripts/rollback/rollback_check.py scan --root .
   python3 <skill-dir>/scripts/rollback/rollback_check.py drill --name staging --verify "curl -fsS https://staging.example.com/healthz" -- ./scripts/rollback.sh v1.42.0
   ```

   Read [references/workflow/08-rollback.md](references/workflow/08-rollback.md).

9. **Ship and report.** One small change per pull request, each with before and after numbers from real runs. Do everything that needs no account, secret, or bigger bill first; bring the rest as one list with expected monthly cost. End with total CI time and cost, before and after. Write the report from [assets/templates/ci-report.md](assets/templates/ci-report.md) to `~/.gti/fast-ci/<project>/reports/`. Read [references/workflow/09-ship-and-report.md](references/workflow/09-ship-and-report.md).

Before reporting, go through [references/quality/checklist.md](references/quality/checklist.md) and check every change against [references/quality/anti-patterns.md](references/quality/anti-patterns.md), the ways a fast CI starts to lie.

## Examples

```text
User: Our GitHub Actions CI takes 9 minutes. Get it under a minute.
Agent: Collects 150 runs with ci_timings.py. Critical path p50 is 8m40s: waiting 25s,
setup 2m10s (npm ci with no cache, full clone), running 6m05s (one Jest job, 3 files
over 60s). Opens one change at a time: concurrency cancel for superseded runs, blobless
clone, node_modules cached by lockfile hash and seeded from main, lint and typecheck as
parallel jobs, tests split into 6 shards balanced from main's JUnit times with a final
verify step. Each change has before and after numbers from real runs. Lists "move to a
warm runner vendor, about $40/month" as pending with the account step for the user.
```

```text
User: We run Woodpecker on a K3s cluster and every pipeline waits 40 seconds to start.
Agent: Collects pipeline timings from the Woodpecker API and the CI pods with
`ci_timings.py collect k8s --selector woodpecker-ci.org/...`. Waiting p50 is 38s, of
which 31s is image pull. Bakes the toolchain into one CI image, pushes it to the
in-cluster registry mirror, pre-pulls it with a DaemonSet, and sets imagePullPolicy to
IfNotPresent. Waiting drops to 3s at p50.
```

```text
User: Check whether our rollback script actually works.
Agent: Runs rollback_check.py scan. Finds scripts/rollback.sh with no `set -e`, a
`kubectl rollout undo` with no --to-revision, `|| true` on the rollout, and no health
check, never called from CI; and a migration that drops a column in one step. Fixes the
script (pinned digest argument, set -euo pipefail, rollout status with a timeout, curl
health check), adds a workflow_dispatch rollback job, splits the migration into expand
and contract, and drills it on staging: healthy in 1m40s.
```

```text
User: CI here is a Makefile someone runs on a build box. Make it fast.
Agent: Wraps each make target with `ci_timings.py record` for ten runs to get a baseline,
runs lint, typecheck, and tests in parallel with `make -j`, adds a pre-push hook that
runs the same `make ci`, and adds a budget check that fails any step over its budget.
```

## Resources

| Path | Purpose |
|------|---------|
| `references/workflow/` | One file per step: rules and scope, audit, waiting and setup, tools, tests and shards, selection and shape, local hooks and budgets, rollback, ship and report |
| `references/platforms/` | One guide per CI system: where time goes, how to collect timings, and the platform's own levers |
| `references/stacks/toolchains.md` | Fast default tools per ecosystem (JavaScript and TypeScript, Python, Go, Rust, JVM, .NET, Ruby, PHP) and how to prove a switch |
| `references/quality/checklist.md` | Every item the report marks done, failing, not applicable, or not checked |
| `references/quality/anti-patterns.md` | Speed-ups that make CI lie, and what to do instead |
| `scripts/audit/ci_timings.py` | Collect timings from any CI into one format, record manual runs, and analyze p50 and p95 per bucket and job with budgets and cost |
| `scripts/rollback/rollback_check.py` | Scan rollback scripts, rollback jobs, and migrations for what makes a rollback slow, unsafe, or impossible, and time rollback drills |
| `scripts/shards/shard_plan.py` | Plan shards from recorded test times, print one shard's files inside CI, and verify every file ran |
| `assets/templates/ci-report.md` | The final report structure |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.

## Notes

- Use `python3` on macOS and Linux and `python` or `py -3` on Windows. The scripts use only the standard library.
- Every number in the report comes from a real run, never from an estimate presented as a measurement. Mark estimates as estimates.
- API tokens come from environment variables the user already set; never ask the user to paste a token into chat.
- Speed never justifies a weaker check. When a change makes CI faster and less strict, it is not done.
