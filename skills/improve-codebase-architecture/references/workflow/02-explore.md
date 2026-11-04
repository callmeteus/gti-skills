# Step 2: explore and collect candidates

Walk the code in scope and note where it is hard to understand, change, or test. Use a subagent with a fresh context when the agent supports one, so the main conversation keeps only the findings. Explore freely instead of running a fixed checklist, but answer these questions for the area.

## Questions to answer

- **Bouncing:** to understand one feature, how many small files or classes must be opened? Which ones only forward calls?
- **Thin wrappers:** which modules have a public API about as big as their code? Apply the merge test from [../concepts/module-design.md](../concepts/module-design.md): would inlining them into callers repeat code, or change nothing?
- **Extracted for tests only:** where were pure helpers split out to be unit tested, while the bugs happen in how callers combine them?
- **Logic copied across callers:** where do several callers repeat the same sequence of calls, the same checks, or the same retry logic?
- **Tight coupling:** where does one module reach into another's internals, or depend on its call order?
- **Hard to test:** which code has no tests, or tests that mock three things to check one rule?

## What to record per candidate

Collect facts, not impressions. Each candidate needs:

| Field | Example |
|-------|---------|
| Files | `src/orders/OrderHandler.ts`, `src/orders/validateItems.ts` |
| What is wrong, with numbers | "Adding a field touches 5 files; tests mock 3 classes" |
| What to change | "Create `OrderIntake.submit()` and make the helpers private" |
| What gets better, with numbers | "1 file per new field; delete 11 mock-heavy tests" |
| Dependency type | Pure code, local stand-in, own service, or third-party API; see [../concepts/testing-by-dependency.md](../concepts/testing-by-dependency.md) |
| Effort | Small (hours), medium (a day or two), large (more) |
| Strength | Strong, worth exploring, or speculative |
| ADR conflict | The ADR number and why it is worth reopening, if any |

## Filter the list

- Keep three to six candidates. More is noise.
- Drop candidates that only move complexity around without reducing what callers must know.
- Drop candidates that an ADR rules out, unless the pain is real enough to reopen the decision; then keep it and fill the ADR conflict field.
- Do not design new public APIs yet. Name the change in one sentence; the design comes after the user picks a candidate.
