# Step 5: Check, Repeat Until Done, and Finish

## Check with fresh eyes

After the list from step 4 is done, have fresh sub-agents search for special cases, hidden links, needless links, and surplus. Give each one:

- one part of the codebase (or one kind of problem across all of it);
- the four definitions and the evidence list from `references/workflow/02-list-problems.md`;
- the current outputs of `skeleton.py`, `deps.py`, `cochange.py`, and `special_cases.py --list`;
- the "Kept, with reason" and "Leads dismissed" sections of the log, so they do not re-report settled items;
- an instruction to return each issue as `file:line`, kind, and one sentence, and to say "nothing worth fixing" when that is the honest answer.

They must not receive your plan or your reasoning; their job is to see what you no longer see. Without sub-agents, start a fresh session or re-read the code from the skeleton up after clearing your notes from context, and treat its findings the same way.

Add every issue worth fixing to the log, go back to step 2 for it, and repeat. **Do not stop until there is nothing worth fixing left.** An issue is not worth fixing when the fix would add more coupling than it removes, or when it is kept on purpose with a reason in the log.

After each round:

```bash
python3 <skill-dir>/scripts/measure/special_cases.py . --compare .untangle/baseline.json
python3 <skill-dir>/scripts/map/deps.py . --depth 2
```

The special-case total should fall round after round. If it stops falling while sub-agents still report issues, the remaining issues are probably special cases being fixed one by one: go back to step 3.

## Done criteria

You are done when all of these hold:

- **As few special cases are left in the system as possible.** How many remain is the best measure of how close you are. Every one that remains is real and listed under "Kept, with reason".
- **A typical change lands in one place.** Pick three recent feature commits from history and check that the same change would now touch one folder.
- **Every import is reasonable.** No cycles, and nothing imports anything more volatile than itself unless the log says why (entry points and composition roots import everything by design).
- **Sub-agents have no issues left** that are worth fixing.
- **Intended behavior is the same as when you started**, apart from bugs the refactor fixed. Test this at the end (below).

## Behavior check

1. Run the full baseline commands from step 1 (tests, type check, lint, build) and compare with the baseline: no new failures, and every baseline failure either still fails the same way or is fixed and recorded.
2. Run any end-to-end, smoke, or example scripts the project has.
3. For public surfaces in scope, diff them against the base commit: exported symbols, routes, CLI help output, schemas. Any difference must be approved in the log.
4. List every bug the refactor fixed, with the test that covers it.

## Final report

Write `.untangle/report.md` from `assets/templates/final-report.md` and summarize it to the user in chat:

- scope, base commit, branch, and number of fix commits;
- before and after: special-case counts by category, cycles, volatile imports, and test results;
- the main fixes, each in one line;
- special cases kept and why;
- public surface changes the user approved;
- bugs fixed along the way;
- what is left, if the user stopped early.

Do not merge or push the branch. Leave that to the user.
