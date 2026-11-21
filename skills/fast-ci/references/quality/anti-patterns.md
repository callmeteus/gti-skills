# Anti-patterns: speed-ups that make CI lie

Each of these makes CI faster or greener by checking less or hiding a failure. None of them is allowed. Check every change against this list before reporting.

| Anti-pattern | Why it lies | Do instead |
|--------------|-------------|------------|
| Retrying failed jobs or tests | A flaky test is a bug in the test or the code; a retry hides it until it ships | Find the cause (leak, race, order dependence, sleep) and fix it |
| Raising a timeout to stop a job failing | The job got slower; the timeout was the alarm | Make the job faster or split it; raise a budget only with a measured reason in the report |
| `skip`, `only`, `xfail`, `continue-on-error`, `allow_failure`, `\|\| true` | The check runs and reports nothing | Fix the check or remove it on evidence with the user's approval |
| Test selection on main or in the merge queue | Changes the selector cannot see reach main untested | Full suite before main; selection only on PRs |
| Path filters that skip required checks | A change outside the filter merges without its checks | Run the check and let the selector make it fast; keep a rerun-everything input list |
| Selection without a planted-failure check | Nobody knows what the selector misses | Hide a real change from it on purpose and confirm CI goes red |
| A faster linter with fewer rules | Lint is faster because it checks less | Close every rule gap before switching |
| Warnings instead of errors | Warnings in CI are read by nobody | Error level, or off with a written reason |
| Shards with no "every file ran" check | A glob or a crash can drop files silently | Verify the union of shard reports against the full file list |
| Shards sharing one database | Order-dependent failures that come and go | One throwaway database per shard and per worker |
| Fixed test order to stop a flake | The leak is still there | Random order, fix the leak |
| Caches keyed too broadly | Stale dependencies pass CI and fail elsewhere | Key by lockfile hash and toolchain version; fall back only to main's key for the same inputs |
| Deleting slow tests | Speed is not evidence a test is useless | Delete only change detectors, with two weeks of logged evidence and approval, never authorization, privacy, migration, or concurrency tests |
| A hook as a line in `AGENTS.md` | Agents and people skip written steps | A real hook that runs every time |
| `--no-verify` in scripts | Hooks exist but never run | Make the hook faster |
| Cancelling runs on main or the merge queue | The gate never finishes | Cancel superseded runs on PR branches only |
| Numbers from one run or from an estimate | One run is noise; estimates are not measurements | p50 and p95 from at least 10 real runs; label estimates |
