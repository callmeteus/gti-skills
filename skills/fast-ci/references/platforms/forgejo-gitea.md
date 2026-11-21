# Forgejo and Gitea Actions

Both run GitHub-Actions-style workflows with `act_runner` (Gitea) or `forgejo-runner` (Forgejo). Most workflow syntax carries over; the runners, caches, and APIs differ.

## Collect timings

```bash
export FORGEJO_TOKEN=...   # or GITEA_TOKEN; read scope on the repository
python3 <skill-dir>/scripts/audit/ci_timings.py collect forgejo --server https://git.example.com --repo team/app
```

The collector first tries the GitHub-compatible runs and jobs endpoints (`/api/v1/repos/{owner}/{repo}/actions/runs`, available in recent Gitea versions), which give step detail. When they are missing, it falls back to `/actions/tasks`, which gives one row per job with no steps and approximates the finish time with `updated_at`; those rows are marked approximate. Endpoints differ between versions: when both fail, time a few runs with `record`, or read job durations from the web UI into the normalized CSV.

## Levers

| Bucket | Lever |
|--------|-------|
| Waiting | Runner `capacity` above 1 and enough runners for the widest run; runners kept online, not started per job |
| Waiting | Docker or Kubernetes backends: CI image already on the host (pre-pull, local registry mirror, `pull: false` in the job container where the runner supports it) |
| Waiting | `concurrency` with `cancel-in-progress` for PR refs, where the server version supports it; otherwise cancel from a first step that checks for newer commits |
| Setup | Labels that map to a prebuilt image with the toolchain (`runs-on: ubuntu-latest` maps to whatever image the runner config names; point it to a baked image) |
| Setup | The runner's built-in cache server (`cache.enabled` in the runner config) for `actions/cache`; seed it from a job on pushes to main. For several runner hosts, use one shared cache server or an S3-backed cache |
| Setup | `actions/checkout` with `fetch-depth: 1`; some runner versions ignore `filter`, so measure |
| Setup | Mirror actions locally (`DEFAULT_ACTIONS_URL` set to your own instance) so `uses:` does not fetch from the internet every run |
| Running | Parallel jobs, matrix shards, folded small checks |
| Gate | No native merge queue: protect the branch with required status checks and "block merge on outdated branch", so the full suite runs on the up-to-date PR head before merge; or run the full suite on a staging branch and fast-forward main from it |
| Budget | `timeout-minutes` where supported, plus `timeout` in steps |

## Notes

- On Kubernetes or K3s, act_runner and forgejo-runner usually run docker-in-docker or use a Kubernetes backend: read the Kubernetes guide for image pulls and warm pods.
- Check the server and runner versions before using a feature; record the versions in `state.md`.
