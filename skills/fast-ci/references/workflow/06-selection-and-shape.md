# Step 6: Selection and shape

Goal: the slowest job under 35 s, no required job waiting on another, and PRs running only what the diff can reach, without a blind spot.

## Shape

- **Run lint, typecheck, build, and tests in parallel.** Remove `needs:`, `depends_on:`, and serial stages between required checks. A test job that waits for a lint job adds both times to the PR.
- **Fold the small checks into one job that lists every failure.** Format, lint, typecheck, lockfile check, license headers, and similar sub-second checks run in one job, each with its exit code captured, so one failure does not hide the next. The job fails at the end when any check failed and prints all of them.

  ```bash
  status=0
  bun fmt --check || status=1
  bun lint || status=1
  bun check || status=1
  exit $status
  ```

- **One setup per job.** Folding checks saves a setup per check; splitting tests into shards costs a setup per shard. Choose by the audit numbers.
- **Build once.** When tests need the build, share the artifact or build inside the test process once.

## Selection on PRs

Run only the tests the diff can reach, on PRs only. Main and the merge queue run everything (rule 1).

- **Use a real dependency graph.** Monorepo tools (`nx affected`, `turbo run test --filter=...[origin/main]`, Bazel, Pants, Gradle with build cache), runner features (`vitest --changed`, `jest --changedSince`, `bun test` with a file list from the graph, `pytest-testmon`, `go list -deps` mapping packages to tests), or an import graph built by a script. Never select by file name alone.
- **List the inputs that rerun everything** and write them in the CI config: lockfiles, toolchain versions, runner images, CI config itself, shared test setup and fixtures, environment and config files, code generators and their inputs, database migrations and seeds, and anything read at runtime by path (JSON, SQL, templates). When the diff touches any of them, run the full suite.
- **Prove the selector cannot hide a failure.** Make a real change that breaks a test, place it where the selector should catch it (for example in a module only imported indirectly, or in a fixture file), push it on a scratch branch, and confirm CI goes red. Then do the same with each kind of rerun-everything input. If CI stays green, the selector has a blind spot: fix the graph or add the input to the list. Record each check in the report.
- **Fall back to everything when unsure.** If the graph cannot be computed (merge base missing, tool error), run the full suite, never nothing.

## Done when

Required jobs run in parallel, small checks share one job that reports every failure, PRs run selected tests with a written list of rerun-everything inputs, and the planted change turned CI red.
