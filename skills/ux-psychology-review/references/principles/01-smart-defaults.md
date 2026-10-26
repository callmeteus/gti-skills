# Smart defaults

## Mechanism

Every empty field is a decision. Stacking several decisions before any result appears causes decision fatigue, and some users choose nothing and leave. A pre-filled value reads as a recommendation ("this is what most people pick"), so the task changes from filling in from scratch to scanning and adjusting.

## Bad screen

A "Book a Table" form with five empty inputs: `Select date`, `Select time`, `Number of guests`, a seating field, and a plain `Search` button. Nothing happens until the user has made every choice, and the button gives no hint of what they will get.

## Good screen

The same form, the same fields, filled with the most common answers:

- **Date:** `Tomorrow, Fri 25 Mar` instead of an empty date picker.
- **Time:** a row of chips (`6:00`, `6:30`, `7:00`, `7:30`) under a `POPULAR TIMES` tag, with `7:00` selected, plus a `View All Times` button for everything else.
- **Guests:** a stepper set to `2`.
- **Seating preference:** three tiles (`Indoor`, `Outdoor`, `Bar`) with `Indoor` selected.
- **Button:** `Search 12 Available Tables`, which states the result before the tap.

The video also shows a real-product pattern: a goal question ("What's your main goal?") with the most common answer pre-selected.

## Rules

- Pre-select the most common choice for every field where you know it from data or context (time, location, last value used).
- Replace free-text inputs with a short list of likely options, and keep a way to see all options.
- Make the call to action describe the outcome, with a real count when you have one.
- Keep every default visible and editable in one tap.

## Limits

- Never default to a paid add-on, a higher plan, a donation, consent to data sharing, or a marketing opt-in. Those must start unselected.
- A default must serve the user. If the common choice is not the best one for this user and you know it, use the better one.
- The count in the button must be real.
