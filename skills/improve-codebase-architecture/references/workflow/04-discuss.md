# Step 4: work through the chosen candidate with the user

Once the user picks a candidate, settle every decision needed to do the refactor, one round of questions at a time. Keep using plain language from [../concepts/plain-language.md](../concepts/plain-language.md).

## Decision tree

Every decision opens the decisions that depend on it. Typical branches:

- What the merged module is called and which business word it uses.
- What its public API is: functions, parameters, errors, required config.
- What moves inside it and what stays with the callers.
- How it is tested: pure code, local stand-in, own service, or third-party API (see [../concepts/testing-by-dependency.md](../concepts/testing-by-dependency.md)).
- Which existing tests are replaced and which are deleted.
- How to migrate callers: all at once, or behind the old functions first.

## Rounds

The open questions are the decisions whose prerequisites are already settled. Ask all of them in one round, numbered, each with your recommended answer, worded so "yes" accepts the recommendation. Wait for the answers, then compute the next round. A question that depends on another question in the same round waits for the next round.

```text
**Q1 - Module name:** The merged module needs a name. The glossary calls this concept "Order intake". Name it `OrderIntake`?

Recommended: yes, `OrderIntake` in `src/orders/OrderIntake.ts`.

---

**Q2 - Testing:** It reads and writes orders in Postgres. Test it against SQLite in the test suite?

Recommended: yes; the repository already has a SQLite test helper in `test/db.ts`.
```

## Facts are your job, decisions are the user's

- Look up anything the code or tools can answer (who calls a function, whether a test helper exists) instead of asking. Use a subagent when the lookup is large; ask the other open questions meanwhile.
- Put every real choice to the user and wait for the answer.

## Keep the project docs current

Update docs as decisions are made, not at the end. See [../concepts/project-docs.md](../concepts/project-docs.md).

- **New business word** for the module, or a fuzzy term made precise: update `GLOSSARY.md` now, creating it if needed.
- **Candidate rejected for a lasting reason:** offer to record an ADR so future reviews do not suggest it again. Skip temporary reasons ("not now") and obvious ones.

## When to stop

Stop when no open question is left and nothing is assumed silently. Summarize the agreed plan and ask the user to confirm before changing any code. To compare several API designs first, go to [05-design-options.md](05-design-options.md).
