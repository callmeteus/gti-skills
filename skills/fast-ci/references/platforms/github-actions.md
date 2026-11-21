# GitHub Actions

## Collect timings

```bash
python3 <skill-dir>/scripts/audit/ci_timings.py collect github --repo owner/app --limit 150
python3 <skill-dir>/scripts/audit/ci_timings.py collect github --repo owner/app --event pull_request
```

Uses `gh api` with the user's existing `gh auth login`. Job `created_at` to `started_at` is waiting; steps split setup from running. `run_attempt` above 1 counts as a rerun.

## Levers

| Bucket | Lever |
|--------|-------|
| Waiting | Faster warm runners from a vendor (change `runs-on:`; vendor needs a GitHub App install, so it is pending for the user) or larger hosted runners; self-hosted with ARC and `minRunners` (see the Kubernetes guide) |
| Waiting | `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: ${{ github.event_name == 'pull_request' }} }` so main and the merge queue are never cancelled |
| Setup | `actions/checkout` with `filter: blob:none` (and `fetch-depth: 0` only when history is needed) or `fetch-depth: 1` |
| Setup | Toolchain baked into a custom runner image, or a container job (`container:`) from a prebuilt image |
| Setup | `actions/cache` on the installed folder (`node_modules`, `.venv`) keyed by `hashFiles('bun.lock')` plus the runtime version; a `push` to main job saves the caches so PRs restore from the base branch |
| Setup | Skip the install step when `steps.cache.outputs.cache-hit == 'true'` |
| Running | Parallel jobs with no `needs:` between required checks; `strategy.matrix` for shards with `fail-fast: false` so every shard reports |
| Running | `paths-filter` style selection only for PR feedback, never to skip required checks on main |
| Gate | Merge queue (`merge_group` event in `on:`), with required checks that run the full suite in the queue |
| Budget | `timeout-minutes` on each job plus `timeout 35s` on long steps |

## Notes

- Required checks must exist on both `pull_request` and `merge_group`; a selected-out job must still report success on PRs (a job that is skipped by `if:` counts as success; a workflow that does not run at all leaves a required check pending).
- Caches are scoped: a PR can restore caches from its own branch and the base branch, not from other PRs. Seeding from main is what gets PR hits above 95%.
- Cache storage per repository is limited and evicts least recently used entries; check the cache list (`gh cache list`) when hit rates drop.
- Store shard timing JUnit files from main as an artifact or cache entry, and download the latest in each shard job.
