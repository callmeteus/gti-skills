# Other CI systems

For CircleCI, Buildkite, Drone, Azure Pipelines, Bitbucket Pipelines, TeamCity, Concourse, and anything else, the workflow is the same. Only the collection and the platform levers change.

## Collect timings

Export the last 150 runs from the system's API or UI into the normalized CSV, one row per job per run:

```text
platform,run_id,job,event,ref,status,attempt,run_created,queued,started,finished,setup_s,approx
buildkite,1842,test,pull_request,feat/x,passed,1,2026-11-20T10:00:00Z,2026-11-20T10:00:00Z,2026-11-20T10:00:09Z,2026-11-20T10:01:02Z,14,false
```

- `queued` is when the job became runnable, `started` when it began on an agent, `finished` when it ended.
- `setup_s` is the seconds spent in clone, toolchain, dependency install, and cache restore inside the job; leave it empty and set `approx` to `true` when unknown.
- Write a small script for the export when the API is paginated; keep it in `~/.gti/fast-ci/<project>/`, not in the repository.

Then analyze as usual:

```bash
python3 <skill-dir>/scripts/audit/ci_timings.py analyze runs.csv
```

## Map the levers

For each workflow step, find the platform's equivalent:

| Need | Look for |
|------|----------|
| Warm runners | Agent pools with minimum idle agents, persistent agents, self-hosted runners |
| Cancel superseded runs | Auto-cancel redundant builds, build cancellation on new commit |
| Baked toolchain | Custom images or agent images |
| Cache seeded from main | Cache keys with a fallback to the default branch |
| Parallel jobs and shards | Parallelism settings, matrix, test splitting by timing data |
| Full suite before main | Merge queue or the platform's gated merge; else branch protection with up-to-date required checks |
| Budget that fails | Job or step timeouts |

Record the mapping in `state.md` so the report can show which lever was used where.
