# Step 3: Redesign from First Principles

Work out the fixes as if the system had known today's requirements from the start.

## Find the fix behind several problems

- Group the problems by the requirement they point to. Special cases are the best clues: three `if` statements for three providers say "the system has providers"; a sleep before focus says "dialogs should restore focus".
- Look for the one fix behind several problems. It often looks nothing like them: a missing concept (a `Command`, a `PaymentProvider`, a `Dialog` that restores focus), a list that should be the single source for several consumers, or a boundary that should own a piece of state.
- Do not fix special cases one by one. A fix that removes one `if` and adds another has not found the requirement.

## Test every fix against the same rule

Ask the same thing of every fix, even one that looks better in the code:

- Pieces that change together end up together.
- Pieces that do not change together are not tied.
- Everything depends on what changes less than itself.

A fix that adds a layer, an interface, or configuration must remove more coupling than it adds. If it only moves code, it is not a fix.

## Write the plan

In the "Fixes" section of the decision log, write each fix as one line saying what changes and why, with the problems it solves indented under it, as in `assets/examples/decision-log-example.md`. Every problem from step 2 ends up under a fix or under "Kept, with reason".

For each fix, also note:

- **Order:** what it depends on. Fixes that create a shared concept come before the fixes that move code onto it.
- **Risk:** which public surfaces it touches (see `references/quality/guardrails.md`), and which tests cover the code it moves.
- **Size:** if a fix would take more than one reviewable commit, split it into steps that each leave the code working.

When a fix needs a public surface to change, or the right design depends on a product decision you cannot see in the code, stop and ask the user before step 4. Group these questions into one message.
