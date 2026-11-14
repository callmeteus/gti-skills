# Anti-patterns

The failure modes below are the ones Maestro must actively avoid. Each one names the symptom, why it fails, and the fix.

## 1. Doing the work yourself

**Symptom:** Maestro edits a file, writes the component, or fixes the test because it is faster than another round.

**Why it fails:** The run loses the cheap-worker economy, the review trail, and the separation between making and judging. The strong model spends its budget on grunt work.

**Fix:** Write a tighter brief, send a numbered FIX to the worker chat, or reassign. Maestro only reads and verifies.

## 2. Context dumping

**Symptom:** The brief pastes the whole codebase, the full plan, or pages of logs.

**Why it fails:** Tokens are wasted, the actual task is buried, and the worker hallucinates connections that do not matter.

**Fix:** Point to the files, symbols, and sections. Give a scout task when the worker needs to explore. Keep the brief to one screen.

## 3. Agent overkill

**Symptom:** Six workers and three waves for a one-file rename.

**Why it fails:** Coordination costs more than the work, and the review surface grows.

**Fix:** Classify simple first. One worker, one review, done. Promote only when the evidence says the work is complex.

## 4. Retry and pray

**Symptom:** The same prompt is sent again after a failure, with no new information.

**Why it fails:** The same input produces the same failure, and the budget disappears.

**Fix:** Every retry changes something: a tighter scope, a missing file, a different tier, a different model family, or a split task. After two failures, reassign or escalate.

## 5. Review theater

**Symptom:** PASS because the worker wrote "all tests pass" and a tidy summary.

**Why it fails:** The summary can be wrong, stale, or optimistic. The run ships an unverified change.

**Fix:** Require the command, exit code, output, and diff. Read the diff and run the check yourself.

## 6. Orphan chats

**Symptom:** A new chat is opened for the review, so the reviewer has none of the worker's context.

**Why it fails:** The review misses what the worker knew, and the fix loses the thread. Cost goes up and quality goes down.

**Fix:** Record the chat id at spawn. Send the review and every fix to that chat. Open a new chat only for a second opinion or a reassignment, and record why.

## 7. Model mismatch

**Symptom:** The strongest model does routine edits, or the cheapest model reviews architecture.

**Why it fails:** The expensive model is wasted, or the cheap model misses the real problem.

**Fix:** T1 for read-only work, T2 for focused edits, T3 for ambiguity and risk. Review in the worker's chat; add a stronger fresh reviewer only for high risk.

## 8. Unbounded fan-out

**Symptom:** Every idea becomes a worker, and the wave has more tasks than the budget can review.

**Why it fails:** Parallel workers collide, the review queue grows, and the run never converges.

**Fix:** Two or three tasks per wave. One writer per file. A hard worker cap and a hard wave cap in `run.json`.

## 9. Plan drift

**Symptom:** The workers do more than the plan, or the plan is silently rewritten to match what they did.

**Why it fails:** The done criteria no longer match the goal, and the report cannot explain the change.

**Fix:** Append every plan change to `decisions.jsonl`. Mark superseded tasks. If the goal changes, treat it as a new run.

## 10. Silent partial success

**Symptom:** The report says "done" while a task is blocked, a check was skipped, or a platform was not tested.

**Why it fails:** The user trusts a result that does not exist.

**Fix:** List `pending` and `notVerified` in the report. A run that reports a gap is better than a run that hides one.

## 11. Scope creep

**Symptom:** The worker renames an unrelated file, upgrades a dependency, or "cleans up" a module.

**Why it fails:** The diff becomes hard to review, and the change may break something outside the task.

**Fix:** Name the scope and the non-goals in the brief. Send out-of-scope changes back as a FIX. Do not reward extra work.

## 12. Parallel collisions

**Symptom:** Two workers in the same wave edit the same file or run the same migration.

**Why it fails:** The changes conflict, the tests race, and the run cannot tell which worker caused the failure.

**Fix:** Check every pair of tasks before the wave. Serialize shared files, use separate worktrees, and let one integration worker merge.

## 13. Gated action by accident

**Symptom:** A worker pushes, deploys, deletes, or posts because the brief did not forbid it.

**Why it fails:** The action is irreversible or visible to others, and it was never approved.

**Fix:** Put the gated list in every brief. In autonomous mode, mark the action pending and stop before it.

## 14. Ledger amnesia

**Symptom:** After a compaction or a new session, Maestro starts over or asks the user to repeat the task.

**Why it fails:** Work is duplicated and the review trail is lost.

**Fix:** Read `run.json`, `workers.jsonl`, and the current task files before acting. The ledger is the memory.

## 15. Preference amnesia

**Symptom:** The user says "always use X" and the next run starts on Y. Or Maestro writes a preference from a one-off request.

**Why it fails:** The user repeats themselves, or a temporary choice becomes a permanent default.

**Fix:** Read both preference files at intake. Persist only durable statements ("always", "from now on"). A one-off stays in the run.

## 16. Hardcoded model IDs

**Symptom:** The skill or a brief contains a model ID that was not discovered or declared.

**Why it fails:** The model may not exist on this machine, or the provider may rename it.

**Fix:** Discover with the provider's command, store the catalog, and use the real ID. Mark unknown capabilities as `unknown`.

## 17. Retry on a rate limit

**Symptom:** A `429` is followed by the same model and the same prompt.

**Why it fails:** The limit has not reset, so the retry fails again and burns the budget.

**Fix:** Set a cooldown from `Retry-After` or the default, record the attempt, and use the next candidate.

## 18. Routing by vibes

**Symptom:** A model is chosen because it "feels better", with no task profile and no reason.

**Why it fails:** The choice cannot be audited, and it ignores context, cost, and health.

**Fix:** Use the router, record the weights, the candidates, and the reason.

## 19. Free-tier blindness

**Symptom:** A free model is used for every task, or a paid model is used when the free variant would pass.

**Why it fails:** Free tiers have lower limits and may fail under load; paid models waste budget on routine work.

**Fix:** Treat free and paid as separate models. Prefer free for cheap, low-difficulty work; keep paid for harder work and fallbacks.

## 20. Orchestrator self-switch

**Symptom:** Maestro says it switched to the preferred orchestrator model when the harness is still running the old one.

**Why it fails:** The user trusts a false claim.

**Fix:** The harness owns the main model. Compare, say once if it differs, and give the relaunch command. Use the preference for spawned planner and reviewer agents.

## 21. Context overflow by choice

**Symptom:** A small-context model is chosen for a repository-wide task because it is cheaper.

**Why it fails:** The worker truncates the input or misses files, and the result looks plausible.

**Fix:** Context is a hard filter. Choose a model that fits, or split the task into smaller scout tasks.
