# GitLab CI

## Collect timings

```bash
export GITLAB_TOKEN=...   # read_api scope
python3 <skill-dir>/scripts/audit/ci_timings.py collect gitlab --server https://gitlab.com --gitlab-project group/app
```

The collector reads finished pipelines and their jobs, including retried jobs (counted as reruns). It uses `queued_duration` for waiting. GitLab gives no step timing through the API, so rows are approximate: find setup in the job log (collapsible sections show their durations) or add markers with `section_start` and `section_end` in the script.

## Levers

| Bucket | Lever |
|--------|-------|
| Waiting | Runners with `concurrent` and autoscaling idle capacity (`IdleCount` for docker-autoscaler or instance executors) so jobs start on a warm machine; Kubernetes executor with images pre-pulled |
| Waiting | `interruptible: true` on PR jobs with "auto-cancel redundant pipelines" on; never on deploy or main-only jobs |
| Setup | `image:` with the toolchain baked in; `GIT_DEPTH: "1"` or `GIT_STRATEGY: fetch` on persistent runners; `GIT_CLONE_EXTRA_FLAGS: --filter=blob:none` where supported |
| Setup | `cache:` with `key: files: [bun.lock]`, `fallback_keys` pointing to main's key, `policy: pull` on PR jobs and `pull-push` on main; a distributed cache (S3) for autoscaled runners |
| Running | `needs: []` on every required job so they start at once instead of waiting for earlier stages (a DAG instead of stages) |
| Running | `parallel: N` with `CI_NODE_INDEX` and `CI_NODE_TOTAL` for shards, planned with `shard_plan.py list --index $CI_NODE_INDEX` |
| Running | `rules: changes:` only for PR feedback, never for jobs that gate the merge |
| Gate | Merge trains (merged results pipelines) run the full suite on the merged result before merge |
| Budget | `timeout:` on each job, plus `timeout` in the script for second-level budgets |

## Notes

- `allow_failure: true` and `retry:` on required jobs are hidden failures (rule 2). List and remove them.
- Artifacts with `reports: junit:` give per-file times for shard planning; keep main's latest as the source.
