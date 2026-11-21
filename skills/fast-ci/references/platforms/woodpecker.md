# Woodpecker

## Collect timings

```bash
export WOODPECKER_TOKEN=...   # personal token from the Woodpecker UI
python3 <skill-dir>/scripts/audit/ci_timings.py collect woodpecker --server https://ci.example.com --repo-id 12
```

The repository id is in the repository settings or the API (`/api/repos/lookup/owner/name`). The collector reads `/api/repos/{id}/pipelines` and each pipeline's workflows and steps (older servers call them `procs`). Pipeline `created` to workflow `started` is waiting; steps named clone, install, cache, restore, and similar are setup.

## Levers

| Bucket | Lever |
|--------|-------|
| Waiting | Enough agents and `WOODPECKER_MAX_WORKFLOWS` per agent for the widest pipeline; agents always online |
| Waiting | Kubernetes backend: CI images pre-pulled on the nodes, in-cluster registry mirror (see the Kubernetes guide) |
| Waiting | Cancel previous pipelines for the same branch on push and pull request events (repository setting); leave it off for the main branch |
| Setup | Step images that already contain the toolchain, pinned by digest; no `apk add` or `apt-get install` in steps |
| Setup | Clone settings: `clone: git: settings: depth: 1` (or `partial: true` for a blobless clone when history is needed) |
| Setup | Cache: a volume mounted on trusted repositories, or an S3 cache plugin; key by lockfile hash; seed from main |
| Running | Separate workflows (files in `.woodpecker/`) run in parallel; inside one workflow, steps run in order unless `depends_on` is used to make a graph, so give independent steps an empty `depends_on: []` |
| Running | Matrix for shards |
| Gate | No native merge queue: require the pipeline on the forge's branch protection with "branch up to date", or run the full suite on a staging branch that fast-forwards main |
| Budget | Repository timeout for the whole pipeline, and `timeout` in step commands for second-level budgets |

## Notes

- Volumes and privileged steps need a trusted repository; changing trust is a setting for the user.
- Record the server and agent versions; field names and settings changed between major versions.
