# Step 8: Rollback

Goal: when a release is bad, one command brings back the last good version in under 5 minutes, verified healthy, from CI, by anyone on the team. Fast CI is only safe when a fast rollback stands behind it.

## Rules

1. **Redeploy, never rebuild.** A rollback deploys the stored artifact or image digest of the last good release. It never builds from source, because a rebuild is slow and may not reproduce what worked.
2. **Pin the target.** The target is a version, a revision, or a digest recorded at deploy time, never `latest`, "the previous one", or a branch name.
3. **Fail loudly.** The rollback stops at the first failed step and fails when the health check fails. No `|| true`, `continue-on-error`, `allow_failure`, or ignored exit codes, the same as rule 2 for CI.
4. **Verify healthy.** Wait on the rollout status (`kubectl rollout status`, `helm --wait`, `argocd app wait`), then run a health check, with a timeout. A fixed `sleep` is not a check.
5. **Runs unattended.** It takes the target as an argument, never from a prompt, and runs from the CI system (a manual job, `workflow_dispatch`, a Jenkins parameter, a Woodpecker `deployment` event), not from one person's laptop.
6. **App and schema roll back apart.** Every migration keeps the previous app version working (expand and contract), so rolling back the app never needs a down migration. A down migration that drops data is a data restore, approved and run on its own.
7. **Drilled.** A rollback that has never run does not work. Drill it against staging on every release or at least monthly, and time it.

## Budget

| Stage | Budget |
|-------|--------|
| Decision to rollback started | under 1 minute: one command or one button, no manual steps |
| Rollback started to healthy | under 5 minutes at p95 in drills |
| Since the last passing drill | under 30 days |

## Scan

```bash
python3 <skill-dir>/scripts/rollback/rollback_check.py scan --root .
```

The scan finds rollback scripts (`rollback`, `revert`, `downgrade`, `undo` in the file name), rollback jobs and stages in CI config on every supported platform (GitHub, Forgejo, Gitea, Woodpecker, GitLab, Jenkins, Drone, CircleCI, Azure, Bitbucket, Makefile, justfile, Taskfile, `package.json`), Kubernetes manifests (Argo Rollouts, Tekton, Argo CD), and database migrations (golang-migrate and dbmate pairs, Flyway, Liquibase, Alembic, Django, Rails, Knex, TypeORM, Sequelize, Laravel, Prisma). It writes Markdown and JSON to `~/.gti/fast-ci/<project>/rollback/`.

| Rule | Severity | What it catches |
|------|----------|-----------------|
| RP001 | blocker | The repository deploys but has no rollback script or job |
| RP002 | major | A rollback script no CI job or make target runs, so it is never drilled |
| RB001 | blocker | A shell script without `set -e`, or PowerShell without `$ErrorActionPreference = 'Stop'` |
| RB002 | major | Error swallowing: `\|\| true`, `continue-on-error`, `allow_failure`, `SilentlyContinue` |
| RB003 | major | `latest` as the rollback target |
| RB004 | major | `kubectl rollout undo` without `--to-revision` (twice returns to the broken revision) |
| RB005 | major | Changes what runs but never checks it came back healthy |
| RB006 | major | Rebuilds from source during the rollback |
| RB007 | blocker | Force-pushes |
| RB008 | major | `helm rollback` without `--wait` |
| RB009 | minor | A fixed `sleep` instead of a status wait |
| RB010 | major | Waits for keyboard input |
| RB011 | blocker | Drops or truncates data |
| RB012 | major | `git reset --hard` |
| RB013 | minor | No time limit |
| RB014 | minor | `helm upgrade` without `--atomic` (Helm 3) or `--rollback-on-failure` (Helm 4) |
| MG001 | major | An `.up.sql` with no `.down.sql` |
| MG002 | major | An empty down migration (`pass`, `{}`) that reports success and changes nothing |
| MG003 | major | A migration declared irreversible |
| MG004 | major | Django `RunPython` or `RunSQL` with no reverse |
| MG005 | major | Liquibase change sets without `<rollback>` |
| MG006 | major | A one-step drop, rename, or type change in an up migration (breaks the previous app version) |
| MG007 | info | Flyway without undo scripts, or Prisma: schema changes roll forward only |

The scan is static and matches patterns. Read each finding in context before changing anything: a drop in an up migration may be the contract half of an expand and contract that already shipped. Record false positives in the report with the reason.

## Platform levers

| Platform | Rollback lever |
|----------|----------------|
| Kubernetes and K3s | `kubectl set image` to the recorded digest, or `kubectl rollout undo --to-revision=N`, then `kubectl rollout status --timeout`. Keep `revisionHistoryLimit` above the number of releases you may roll back to. Argo Rollouts and Flagger abort and roll back on failed analysis by themselves |
| Helm | `helm rollback <release> <revision> --wait --timeout 5m`; deploy with `--atomic` (Helm 3) or `--rollback-on-failure` (Helm 4) |
| Argo CD and Flux | Revert the Git commit that changed the version and let the controller sync; `argocd app rollback` only when auto-sync is off |
| GitHub, Forgejo, Gitea Actions | A `workflow_dispatch` job with the version or digest as an input, protected by an environment |
| GitLab | A `when: manual` rollback job in the deploy stage, or re-run the deploy job of the last good pipeline |
| Woodpecker | A pipeline on the `deployment` event with the target as a parameter |
| Jenkins | A parameterized rollback job, or re-run the deploy stage of the last good build with its archived artifact |
| Manual CI and build boxes | One `make rollback VERSION=...` target, with releases kept as versioned folders or images and a `current` symlink switched atomically |
| Serverless and PaaS | Platform aliases or release history (for example traffic to the previous version), pinned by version id |

## Drill

```bash
python3 <skill-dir>/scripts/rollback/rollback_check.py drill --name staging --verify "curl -fsS https://staging.example.com/healthz" -- ./scripts/rollback.sh v1.42.0
```

The drill runs the rollback, then the health check, and appends the time to roll back, the time to healthy, and both exit codes to `rollback/drills.jsonl`. The next scan reports drills, passes, p50 and p95 against the budget, and whether the last drill passed.

- Drill only against staging, a preview environment, or a throwaway namespace. Never run a drill against production unless the user asked for it in this session; list it as pending instead.
- A drill that rolls back to the release before the current one, then forward again, proves both directions.
- When the drill fails or is over budget, fix the rollback before anything else in this step.
- Make the drill a CI job (scheduled, or on every release to staging) so it keeps passing after this skill is done.

## Done when

The scan has no blocker, every major finding is fixed or recorded with a reason, at least one drill passed against a non-production environment within budget, and the rollback runs from CI. Add the rollback table to the report.
