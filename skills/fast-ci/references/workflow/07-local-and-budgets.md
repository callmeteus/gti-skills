# Step 7: Local hooks and budgets

Goal: catch most failures before the push, in under 9 s, and keep CI fast by making slowness fail.

## Local hooks, under 9 seconds

- **Pre-commit formats and lints the staged files only.** Format with fixes applied and re-staged, lint with the same config as CI.
- **Pre-push runs the same check as CI**: the folded small-checks job and the tests the diff can reach, with the same commands, so a push that passes locally passes in CI.
- **Use a hook manager, not a line in `AGENTS.md`.** Agents skip steps written as instructions; a hook runs every time. The source prompt's default is `hk`; `lefthook`, `pre-commit`, and Husky with lint-staged also work. Choose the one that meets 9 s on this repository and runs on every developer platform in use.
- **Share the commands.** CI and hooks call the same script or task (`bun run ci:fast`, `make check`, `just check`), so they cannot drift.
- **Never `--no-verify` in automation.** If a hook is too slow, make it faster.

## Budgets that fail

A budget that only shows up in a report slowly stops being met. Fail any job that exceeds its budget:

| Platform | How |
|----------|-----|
| GitHub Actions, Forgejo, Gitea | `timeout-minutes` on the job (minute granularity) plus a step-level `timeout` command for second-level budgets |
| GitLab CI | `timeout:` on the job, or `timeout` in the script |
| Woodpecker | Repository timeout for the pipeline, plus `timeout` in the step commands |
| Jenkins | `timeout(time: 35, unit: 'SECONDS')` around the stage, or `options { timeout(...) }` |
| Tekton | `timeout` on the Task in the Pipeline, or `timeouts` on the PipelineRun |
| Argo Workflows | `activeDeadlineSeconds` on the template |
| Kubernetes Jobs | `activeDeadlineSeconds` on the Job spec |
| Manual or script CI | `timeout 35 <command>` (GNU coreutils), or the language's own timeout |

A budget timeout is not a wider timeout (rule 2): it is tighter than before, and when it fires, the fix is to make the job faster or split it, never to raise the budget quietly. Raising a budget needs a measured reason in the report.

Add a scheduled audit (weekly, or after every 50 runs on main) that runs `ci_timings.py analyze` with the same budgets, so slow drift is visible before it trips a timeout. The scheduled job is a CI change the user approves.

## Done when

Pre-commit and pre-push hooks run in under 9 s with the same commands as CI, and every job fails when it exceeds its budget.
