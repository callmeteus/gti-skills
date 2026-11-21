# Checklist

Mark each item done, failing, not applicable, or not checked in the report.

## Rules (step 1)

1. The full suite runs before anything reaches main (merge queue, merge train, or an equivalent gate).
2. No retries on any required check.
3. No timeouts were widened; budgets only got tighter.
4. No new skips, `allow_failure`, `continue-on-error`, or `|| true`.
5. No lint rule or required check was removed or downgraded.

## Audit (step 2)

6. The last 150 runs (or all that exist) were collected and analyzed.
7. Waiting, setup, and running are split at p50 and p95 for the critical path and per job.
8. PR runs and main runs are measured separately.
9. The baseline, including billable minutes and cost per month, is saved in `state.md`.

## Waiting and setup (step 3)

10. Waiting p50 under 5 s.
11. Superseded PR runs are cancelled; main and merge queue runs never are.
12. Toolchain baked into the runner image.
13. PR cache hit rate above 95%, with caches seeded from main.
14. Installed dependencies are cached, and install is skipped on a hit.
15. Blobless or shallow clone.
16. Setup p50 under 15 s.

## Tools (step 4)

17. Each tool switch has a side-by-side run and no unclosed gap.
18. Every lint rule that can be on is on, at error level.
19. Lint under 1 s, format under 1 s, typecheck under 5 s.
20. Canary tools pinned to an exact version.

## Tests and shards (step 5)

21. Modules isolated, state reset after every file, random order.
22. Workers match cores; cores bought before shards.
23. Each shard has its own throwaway database.
24. No test file over 20 s.
25. Shards balanced from file times recorded on main.
26. A verify step proves the shards together ran every file.
27. Tests under 30 s per shard.
28. The two-week failure log has started; no tests deleted without evidence and approval.

## Selection and shape (step 6)

29. Lint, typecheck, build, and tests run in parallel; no required job waits on another.
30. Small checks folded into one job that lists every failure.
31. PRs run only the tests the diff can reach.
32. The inputs that rerun everything are listed in the CI config.
33. A hidden real change turned CI red.
34. Slowest job under 35 s.

## Local and budgets (step 7)

35. Pre-commit formats and lints staged files; pre-push runs the same check as CI.
36. Hooks are a hook manager, not a line in `AGENTS.md`, and run under 9 s.
37. Every job fails when it exceeds its budget.

## Ship (step 8)

38. One small change per pull request or branch, each with before and after numbers from real runs.
39. Everything needing an account, a secret, or a bigger bill is on one list with expected monthly cost.
40. The report ends with total CI time and cost, before and after.
41. PR time to result p50 under 60 s and p95 under 120 s.
