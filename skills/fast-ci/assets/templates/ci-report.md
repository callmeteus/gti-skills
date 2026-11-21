# CI report: <repository>

- **Date:** <YYYY-MM-DD>
- **CI system:** <GitHub Actions | Forgejo | Woodpecker | GitLab | Jenkins | Kubernetes or K3s (Tekton, Argo, ARC) | manual>
- **Runners:** <hosted, vendor, self-hosted VM, K3s pods; cores and memory>
- **Runs measured:** <N before (date range), N after (date range)>
- **Data used:** <collector command and analysis file paths>

## Summary

<Three to five sentences: PR time to result before and after, the biggest bucket and what fixed it, what still needs the user.>

## Before and after

All numbers are from real runs, collected and analyzed with the same command.

| Metric | Before | After | Budget |
|--------|--------|-------|--------|
| PR time to result p50 | <8m40s> | <52s> | 60 s |
| PR time to result p95 | | | 120 s |
| Waiting p50 (critical path) | | | 5 s |
| Setup p50 (critical path) | | | 15 s |
| Slowest job p50 | | | 35 s |
| Lint / format / typecheck | | | 1 s / 1 s / 5 s |
| Slowest test shard p50 | | | 30 s |
| Local hooks | | | 9 s |
| PR cache hit rate | | | above 95% |
| Rerun share | | | 0% |
| Billable minutes per month | | | |
| Cost per month | | | |

## Changes

One row per pull request or branch, in the order they shipped.

| # | Change | Bucket | Before | After | Runs | Link or branch |
|---|--------|--------|--------|-------|------|----------------|
| 1 | <Cancel superseded PR runs> | <waiting> | <p50 25s> | <p50 4s> | <12> | <branch or PR> |

## Tool switches

| Job | Old | New | Missed by new | How closed | Old time | New time |
|-----|-----|-----|---------------|------------|----------|----------|
| <Lint> | <ESLint> | <bun lint> | <2 rules> | <enabled in .oxlintrc.json> | <14s> | <0.4s> |

## Selection check

| Planted change | Where | Selector caught it | CI went red |
|----------------|-------|--------------------|-------------|
| <Broke a helper only imported indirectly> | <src/lib/x.ts> | <yes> | <yes, run link> |

## Hidden failures found

| Where | What | Status |
|-------|------|--------|
| <.github/workflows/ci.yml> | <retry: 2 on e2e> | <removed after fixing the race in checkout.test.ts> |

## Rollback

From `rollback_check.py scan` and the drill log.

| Metric | Value | Budget |
|--------|-------|--------|
| Rollback path | <one command: scripts/rollback.sh DIGEST, run by the rollback workflow> | one command from CI |
| Drills passed / run | <3 / 3> | |
| Last passing drill | <YYYY-MM-DD, staging> | under 30 days ago |
| Time to healthy p50 / p95 | <1m40s / 2m10s> | under 5 min at p95 |
| Scan findings | <0 blocker, 1 major, 2 minor> | 0 blocker |

| Where | Finding | Status |
|-------|---------|--------|
| <scripts/rollback.sh:4> | <RB004 rollout undo without --to-revision> | <fixed: sets the recorded digest> |
| <db/migrations/012_drop_email.up.sql:1> | <MG006 one-step column drop> | <split into expand and contract> |

## Pending: needs the user

Everything that needs an account, a secret, a setting, or a bigger bill.

| Item | Fixes | Step for the user | Expected monthly cost (estimate) |
|------|-------|-------------------|----------------------------------|
| <Move jobs to a warm runner vendor> | <waiting 25s to under 5s> | <Install the vendor's GitHub App, merge branch fast-ci/runners> | <about $X, from N billable minutes at $Y> |
| <Enable the merge queue> | <rule 1> | <Settings, Branches, main, Require merge queue> | <none> |

## Checklist

<The checklist items marked done, failing, not applicable, or not checked.>

## Not verified

- <What could not be measured and why, with the command that would measure it>

## Total CI time and cost

| | Before | After |
|---|--------|-------|
| PR time to result p50 / p95 | | |
| Billable minutes per month | | |
| Cost per month | | |
