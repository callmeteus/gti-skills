# Manual or script-based CI

Covers CI that is a script: a `Makefile`, `justfile`, `Taskfile.yml`, `scripts/ci.sh`, a cron job on a build box, or a person running `make ci` before merging.

## Collect timings

Wrap every step with `record` for at least ten runs. Give the steps of one run the same `--run` id (or set `CI_RUN_ID`), and mark setup steps with `--setup`:

```bash
RUN=$(date +%s)
python3 <skill-dir>/scripts/audit/ci_timings.py record --job install --setup --run $RUN -- make deps
python3 <skill-dir>/scripts/audit/ci_timings.py record --job lint --run $RUN -- make lint
python3 <skill-dir>/scripts/audit/ci_timings.py record --job test --run $RUN -- make test
python3 <skill-dir>/scripts/audit/ci_timings.py analyze ~/.gti/fast-ci/<project>/timings/manual.jsonl
```

PowerShell:

```powershell
$RUN = [DateTimeOffset]::Now.ToUnixTimeSeconds()
python <skill-dir>/scripts/audit/ci_timings.py record --job lint --run $RUN -- make lint
```

Waiting is zero for recorded steps; if people wait for a shared build box, note the wait by hand in `state.md`.

## Levers

| Bucket | Lever |
|--------|-------|
| Waiting | A shared build box: a lock with a queue, or one box per concurrent run |
| Setup | Dependencies installed once and reused while the lockfile is unchanged (`make` targets that depend on the lockfile file) |
| Running | Independent targets in parallel: `make -j$(nproc) lint typecheck test` with correct prerequisites, `just` with parallel recipes, or `xargs -P` |
| Running | Fold small checks into one target that runs all of them and reports every failure |
| Gate | A rule that main only moves after `make ci` passes on the exact commit: a pre-push hook on the main branch, or a server-side hook on the forge |
| Budget | `timeout 35 make test` (GNU coreutils) for each step |

## Notes

- Manual CI is the easiest place for checks to be skipped. Move the pre-push check into a hook manager (step 7) so it always runs.
- Suggest a real CI system only as a pending item; do not set one up unless the user asked.
