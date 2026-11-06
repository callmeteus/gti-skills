# Step 6: implement the agreed plan and report the change

Start only after the user confirmed the plan from step 4 (or the design chosen in step 5).

## Implement

- Change the code exactly as agreed. If the code shows that part of the plan cannot work, stop and bring the new fact back as a question; do not quietly change the plan.
- Move callers, replace or delete the tests agreed in step 4, and keep the full test suite green.
- Update `GLOSSARY.md` and ADRs if a decision changed while you worked.

## Report the change

When the work is done, tell the user what changed in a short message, in their language, using the rules in [../concepts/plain-language.md](../concepts/plain-language.md). The message has four parts, in this order:

1. **What is different now, from the user's side.** Start with the behavior or the effect on daily work, not with the files you edited. "Adding a discount now touches one file, `src/pricing/discounts.ts`" beats "Refactored the pricing module".
2. **A concrete example in the user's own terms.** Reuse the input, file, route, or scenario the user gave earlier, and say what happens with it now: which part is affected and which part stays as it was.
3. **Where it applies and where it does not.** State the exact condition, then the near-misses that do not trigger it. Name the cases a reader would wonder about: a partial match, a similar-looking input of another kind, a caller that was left out of the change on purpose.
4. **What you did not verify, and why.** One plain sentence for each check you could not run, with the reason ("I did not open the screen in the browser: the app was not running"). Do not hedge what you did verify, and do not leave out what you did not.

Keep it to a few short paragraphs. Leave out the list of edited files, test counts, and internal names unless the user asks or they are the point of the change; the diff already has them. No headings for a message this short.

## Example

The user's earlier request was "highlight /commands in the composer when they are real skills", with the sample text `use /create-skill and then /deploy`.

```text
A /name that matches an installed skill now shows in the theme's accent color,
in the middle of the sentence. In your example, /create-skill and /deploy would
be colored and the rest of the text stays normal.

The color appears only when the name is complete and the skill exists in that
agent. A half-typed name, a command that is not a skill, and a path like /tmp/...
stay plain.

I did not open the composer in the browser: the app was not running.
```

Part 1 is the first sentence, part 2 the second, part 3 the second paragraph, and part 4 the last line.

## Check

- The first sentence says what changed for the user, not what you edited.
- The example comes from the user's own words or code, not a made-up one.
- Every boundary a reader would ask about is answered: what triggers it and what does not.
- Every unverified check is named with its reason.
