# Step 2: Audit

Goal: know where the time goes, from real runs, before changing anything.

## Collect

Pull the last 150 completed runs. Every collector writes the same normalized rows to `~/.gti/fast-ci/<project>/timings/`.

```bash
python3 <skill-dir>/scripts/audit/ci_timings.py collect github --repo owner/app
python3 <skill-dir>/scripts/audit/ci_timings.py collect github --repo owner/app --event pull_request
python3 <skill-dir>/scripts/audit/ci_timings.py collect forgejo --server https://git.example.com --repo team/app
python3 <skill-dir>/scripts/audit/ci_timings.py collect woodpecker --server https://ci.example.com --repo-id 12
python3 <skill-dir>/scripts/audit/ci_timings.py collect gitlab --server https://gitlab.com --gitlab-project group/app
python3 <skill-dir>/scripts/audit/ci_timings.py collect jenkins --server https://jenkins.example.com --job team/app/main
python3 <skill-dir>/scripts/audit/ci_timings.py collect k8s --namespace ci --selector app.kubernetes.io/managed-by=tekton-pipelines --run-label tekton.dev/pipelineRun --job-label tekton.dev/pipelineTask
```

Tokens come from environment variables the user already has (`GITEA_TOKEN` or `FORGEJO_TOKEN`, `WOODPECKER_TOKEN`, `GITLAB_TOKEN`, `JENKINS_USER` and `JENKINS_TOKEN`). GitHub uses the `gh` login. Kubernetes uses the current `kubectl` context, or `--file` with saved `kubectl get pods -o json` output. Never ask the user to paste a token into chat. When no access is available, use local timing (below) and list the real-run audit as pending with the exact command.

For manual CI, or when there is no API, time each step for at least ten runs. `record` runs the command, appends a row, and returns the command's exit code:

```bash
python3 <skill-dir>/scripts/audit/ci_timings.py record --job install --setup --run r1 -- bun install --frozen-lockfile
python3 <skill-dir>/scripts/audit/ci_timings.py record --job lint --run r1 -- bun lint
```

For any other system, write the normalized rows yourself as CSV with the columns `platform,run_id,job,event,ref,status,attempt,run_created,queued,started,finished,setup_s,approx` (dates as ISO 8601 or epoch seconds) and pass the CSV to `analyze`.

## Analyze

```bash
python3 <skill-dir>/scripts/audit/ci_timings.py analyze ~/.gti/fast-ci/<project>/timings/github-*.jsonl --price-per-minute 0.008
```

The analysis reports:

- **Time to result** per run: from the run's creation to its last job finishing, p50 and p95. This is the number the user feels.
- **Critical path buckets:** the slowest job of each run split into waiting (queued to started), setup (clone, toolchain, dependencies, cache restore), and running.
- **Per job:** p50 and p95 for each bucket, slowest p95 first.
- **Over budget:** each job and bucket over the budgets in SKILL.md. Override them with `--budgets budgets.json`, for example `{"job": 45, "per_job": {"e2e": 60}}`.
- **Billable minutes** per run and per month, and the cost when `--price-per-minute` is given.
- **Rerun share:** runs with more than one attempt. Each rerun is a hidden failure (rule 2).

Setup is split from running by step names (checkout, set up, cache, install, restore, pull, and similar). When the platform gives no step detail (GitLab jobs, Forgejo tasks), setup counts as running and the rows are marked approximate: find setup in the job log, or add timing markers to the job (see the platform guide). Pass `--setup-pattern` to adjust the step names.

## Read it

- Split PR runs from main runs (`--event pull_request` on GitHub, filter by `event` elsewhere). The PR number is the target; main runs the full suite.
- Fix the biggest bucket first. Typical order: waiting (no warm runners, image pulls), then setup (no cache, full clones, installs), then running (serial jobs, one fat test job).
- Find the job that everything waits on (`needs:`, stages). A required job that waits on another adds both times.
- Read p95 as well as p50: a fast median with a slow tail usually means cold caches, cold runners, or one slow shard.

## Baseline

Write the baseline into `state.md`: time to result p50 and p95, each bucket, the slowest jobs, billable minutes per month, cost per month, rerun share, and the date range of the runs. Every later change is compared to this baseline with the same command.

## Done when

The baseline is saved and the biggest bucket of the critical path is named.
