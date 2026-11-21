# Step 5: Tests and shards

Goal: under 30 s per test shard, every file run, no leaks between tests, and fewer tests only on evidence.

## Make the suite parallel-safe

- **Isolate modules, not processes.** Fresh module state per test file inside a shared process is much cheaper than a process per file. Use the runner's module isolation and reserve process isolation for files that truly need it.
- **Reset state after every file:** mocks, timers, environment variables, globals, singletons, module caches, and database rows.
- **Run in random order** (`bun test --randomize` where supported, `vitest --sequence.shuffle`, `pytest -p randomly`, `go test -shuffle=on`, `cargo nextest` with a shuffled order, RSpec `--order random`) to flush out leaks. A test that fails only in some orders has a leak: fix the leak, never pin the order.
- **No sleeps.** Wait on the condition, not on the clock.

## Cores before shards

1. **Buy cores before shards.** One machine with more cores has no extra setup cost; each shard pays waiting and setup again. Move to a bigger runner first (on the pending list when it costs money).
2. **Match workers to cores.** Set the runner's worker count to the core count of the machine (or core count minus one when the database runs on the same machine). More workers than cores is slower.
3. **Then shard.** Add shards only when one machine at full width still exceeds 30 s.

## Shards

- **Each shard gets its own throwaway database:** a database per shard (and per worker), created from a template or migrated snapshot in seconds, destroyed after. Never share one database between shards.
- **Split any test file over 20 s.** A file longer than the shard budget's share decides the shard time on its own.
- **Balance from recorded file times.** Every full run on main writes JUnit XML (or a JSON map of file to seconds) and keeps it as an artifact or cache. Shards plan from main's latest times, not from file counts:

  ```bash
  python3 <skill-dir>/scripts/shards/shard_plan.py plan --timings main-junit/*.xml --shards 4 --files "src/**/*.test.ts"
  ```

  Inside each CI shard, print that shard's files and pass them to the runner. `list` writes nothing, so it is safe in CI:

  ```bash
  python3 <skill-dir>/scripts/shards/shard_plan.py list --timings main-junit/*.xml --shards 4 --index 2 --files "src/**/*.test.ts"
  ```

  Files with no recorded time (new files) get the median time, so they still spread out. Files that no longer exist show as stale.

- **Prove the shards together ran every file.** A final step collects every shard's JUnit report and fails when any expected test file is missing:

  ```bash
  python3 <skill-dir>/scripts/shards/shard_plan.py verify --files "src/**/*.test.ts" --ran shard-*/junit.xml
  ```

  Copy the script into the repository only when the user asks; otherwise use the runner's own sharding with timing data and an equivalent count check written in the CI config.

## Fewer tests, on evidence

1. **For two weeks, log every test failure you fix** in `~/.gti/fast-ci/<project>/failures.md`: date, test file, and the verdict: **caught regression** (it found a real bug) or **change detector** (it failed only because the code changed on purpose, such as snapshot churn, mocks of internals, or asserting call order).
2. **Delete the files that only detect change**, after the two weeks, with the log as evidence and the user's approval. Deleting tests is gated: list the candidates as pending until the user says yes.
3. **Ban their patterns** in the repository's `AGENTS.md` (for example "no snapshot tests of whole components", "no mocks of internal modules") so they do not come back.
4. **Never delete tests for authorization, privacy, migrations, or concurrency**, even when they look like change detectors. Rewrite them instead.

## Done when

The suite passes in random order, each shard is under 30 s with its own database, shards are balanced from main's recorded times, a verify step proves every file ran, and the failure log has started.
