# Step 1: Rules and scope

Goal: know what CI runs, where, how PRs merge, and what "done" means, before touching anything.

## The three rules

They outrank every budget in this skill.

1. **The full suite runs before anything reaches main.** Use a merge queue (GitHub merge queue, GitLab merge trains) or an equivalent gate on platforms without one (see the platform guide). Test selection only narrows the feedback a PR gets while it is open; it never decides what is allowed to merge.
2. **Never hide failures.** No retries (a `retry` action or keyword, `--retries`, `jest.retryTimes`, `pytest-rerunfailures`, flaky decorators, Jenkins `retry()`), no wider timeouts, no `skip`, `only`, `xfail`, `continue-on-error`, `allow_failure`, `failure: ignore`, or `|| true` added to make CI green. A check that needs a retry has a bug: find it. Retries that already exist are findings: list each and remove it once its cause is fixed.
3. **Never check less.** Lint rules and required checks only stay or grow. A faster linter that runs fewer rules is not faster, it is weaker. When a tool switch drops a rule, the switch waits until the rule exists, or the old tool keeps running that rule.

## Detect the CI system

| File or folder | System |
|----------------|--------|
| `.github/workflows/*.yml` | GitHub Actions (also read by Gitea and by Forgejo when configured) |
| `.forgejo/workflows/*.yml`, `.gitea/workflows/*.yml` | Forgejo or Gitea Actions |
| `.woodpecker.yml`, `.woodpecker/*.yml` | Woodpecker |
| `.gitlab-ci.yml` | GitLab CI |
| `Jenkinsfile`, `jenkins/`, Groovy files with `pipeline {` | Jenkins |
| Tekton `Task`, `Pipeline`, `PipelineRun` manifests, Argo `Workflow`, ARC `AutoscalingRunnerSet` or `RunnerDeployment` | Kubernetes or K3s based CI |
| `Makefile`, `justfile`, `Taskfile.yml`, `scripts/ci*`, `bin/ci`, a cron entry or a build box | Manual or script-based CI |
| `.circleci/`, `.buildkite/`, `.drone.yml`, `azure-pipelines.yml`, `bitbucket-pipelines.yml`, `.teamcity/` | Other: see `references/platforms/other.md` |

A repository can have several. Where the runners live matters as much as the CI system: Forgejo, Woodpecker, GitLab, and Jenkins runners often run on Kubernetes or K3s, so read both guides.

## Write down

Save to `~/.gti/fast-ci/<project>/state.md`:

- CI system, runner type (hosted, self-hosted VM, Kubernetes or K3s pods, a single box), and runner size (cores, memory).
- Stack, package manager, lockfile, test runner, linter, formatter, typechecker, and build tool.
- Every job, what it checks, which are required, and what waits on what (`needs:`, `depends_on:`, stages).
- How PRs merge: merge queue, merge train, required checks, "require branch up to date", or nothing.
- Existing retries, skips, `allow_failure`, and timeouts, each as a finding.
- What the user allowed: commits, pushes, pull requests, settings changes, and spending.

## Done when

The CI system, its runners, every job, the merge gate, and the list of hidden failures are in `state.md`.
