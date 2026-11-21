# Jenkins

## Collect timings

```bash
export JENKINS_USER=me JENKINS_TOKEN=...   # an API token, not the password
python3 <skill-dir>/scripts/audit/ci_timings.py collect jenkins --server https://jenkins.example.com --job team/app/main
```

The job path is the folder and job names from the URL (`/job/team/job/app/job/main` becomes `team/app/main`; for a multibranch PR build, use the branch job such as `team/app/PR-42`). The collector reads `wfapi/describe` from the Pipeline Stage View plugin: `queueDurationMillis` is waiting, stages named checkout or set up are setup. Without that plugin, read build durations from `/api/json` and the stage times from the Blue Ocean or Pipeline Graph views into the normalized CSV.

## Levers

| Bucket | Lever |
|--------|-------|
| Waiting | Enough executors and agents kept online for the widest build; on Kubernetes, the Kubernetes plugin with a pod template whose image is pre-pulled, and an idle pod count above zero where the plugin version supports it |
| Waiting | `disableConcurrentBuilds(abortPrevious: true)` in `options` for PR jobs, so a new commit stops the old build; not on main |
| Setup | Agent images with the toolchain baked in; `checkout scm` with shallow clone and reference repository options, or a persistent workspace that only fetches |
| Setup | Dependency cache on a persistent volume or with the Job Cacher plugin, keyed by lockfile hash; seed it from main |
| Running | `parallel` stages (or `matrix`) for lint, typecheck, build, and test shards; `failFast false` so every branch reports |
| Running | Stash or archive the build once and unstash it in test branches |
| Gate | No native merge queue: build the PR merged with the target (multibranch "merge with target" strategy) and require it on the forge; or use a gating system in front (Zuul, Gerrit) when the user already has one |
| Budget | `timeout(time: 35, unit: 'SECONDS') { ... }` around stages, and `options { timeout(...) }` on the pipeline |

## Notes

- `retry(n)` blocks and the Naginator plugin are hidden failures (rule 2). List and remove them.
- Shared libraries can hide slow steps; read them as part of the pipeline.
- Agents and plugins are server administration; changes there are pending for the user unless they asked for them.
