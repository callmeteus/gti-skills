# Step 9: Ship and report

Goal: every change lands small and measured, and the user gets one report with total time and cost, before and after.

## One small change per pull request

- One concern per branch and pull request: cancel superseded runs, cache seeding, image bake, one tool switch, sharding, selection, hooks, budgets.
- Each description has the before and after numbers **from real runs**: time to result p50 and p95, the bucket it targets, and billable minutes. Collect at least 10 runs after the change (or as many as exist, and say how many).
- Push and open pull requests only when the user allowed it. Otherwise commit locally on separate branches, or write patches, and list them as pending.
- Order: changes that need nothing from the user first (cancel superseded runs, clone filters, caches, job shape, tool switches, shards, selection, hooks, budgets), then the list below.

## What needs the user

Bring everything that needs an account, a secret, or a bigger bill as **one list**, each with:

- What it is and which bucket it fixes, with the measured gap it closes.
- The exact step the user takes (sign up, install the app, add the secret named `X`, enable the merge queue in settings, raise the runner pool from 2 to 6).
- The expected monthly cost, computed from the audit: billable minutes per month times the new price, compared with the current cost. Mark it as an estimate.

Never sign up, add secrets, change repository settings, or start paid plans yourself.

## Report

Write the report from [../../assets/templates/ci-report.md](../../assets/templates/ci-report.md) to `~/.gti/fast-ci/<project>/reports/ci-report-<date>.md`. It ends with **total CI time and cost, before and after**: time to result p50 and p95, billable minutes per month, and cost per month, all from the same collector and analysis command on real runs. When the after numbers are not available yet (changes not merged), say so and give the command to produce them.

Go through [../quality/checklist.md](../quality/checklist.md) and mark each item done, failing, not applicable, or not checked. Summarize the top changes in chat and give the report path.

## Done when

Every change is its own small branch or pull request with numbers, the pending list has costs, and the report has total time and cost before and after.
