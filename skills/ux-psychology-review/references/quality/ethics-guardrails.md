# Ethics guardrails

Every recommendation must pass this check before it reaches the user. The principles make a good decision easier; they must not trick anyone into a decision they would not make with clear information.

## The test

Ask of each change: would the user still agree with the outcome if they understood exactly how the screen was built? If not, rewrite or drop the change.

## Reject these

| Pattern | Example | Honest alternative |
|---------|---------|--------------------|
| Fake progress | Starting a bar at 20% when nothing is done | Count a real completed step, such as account creation |
| False urgency | A countdown that resets, or a deadline that does not exist | State the real date or condition, or no date at all |
| False scarcity | "Only 2 left" when stock is not limited | Show real availability or nothing |
| Confirmshaming | Dismiss labels like "I'll risk it" or "No, I don't want to save money" | Neutral labels: "Not now", "No thanks" |
| Pre-selected costs | Paid add-ons, higher tiers, or donations checked by default | Paid items start unselected |
| Pre-checked consent | Marketing or data-sharing boxes ticked by default | Consent starts unticked (also a legal requirement in many regions) |
| Misleading comparison | A monthly fee shown as a percentage of a one-time price | Compare on the same billing basis |
| Decoy that cannot be bought | A plan listed only to make another look cheap | Every listed option is real |
| Hostage results | Withholding a result after the user did the work | Give a useful part first, then ask |
| Hostage work | Deleting what the user built if they do not sign up | Keep it, or let them export it |
| Fake social proof | Invented reviews, counts, or "most popular" labels | Use real data or omit it |

## Reporting

In the review, list any change you rewrote or rejected under "Ethics notes", with one line on why. If the user explicitly asks for one of the rejected patterns, explain the risk (user trust, chargebacks, regulatory exposure in consumer protection and privacy law) and offer the honest alternative instead.
