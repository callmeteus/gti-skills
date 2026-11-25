# Pass 8: States and feel

## Goal

The interface feels native: it answers a tap at once, shows the shape of what is loading, lets people undo instead of asking them to confirm, and moves only where motion explains a change. People should not have to relearn habits their phone already taught them. This pass changes states and behavior, not layout or color.

## Before and after

| Element | Before | After |
|---------|--------|-------|
| Loading a list or page | A spinner in an empty box | A skeleton in the shape of the content (title bar, lines, image box) that the content replaces in place |
| Loading an image | An empty gray box | A blurred low-resolution preview or the dominant color, swapped for the image when it loads |
| Like, save, toggle, reorder | The control waits for the server before it changes | The screen updates on tap; the request runs in the background and the change rolls back with a message if it fails |
| Delete an item | A "Are you sure?" popup | The item goes away at once with an "Undo" button in a toast for a few seconds |
| Open a card | A hard cut to the next screen | The tapped card grows into the next screen (shared element transition) |
| A bottom sheet or drawer | Closes only with an X button | Also closes when the user drags it down |
| Verification code | Six separate boxes typed digit by digit | One field with `autocomplete="one-time-code"` and `inputmode="numeric"`, so the keyboard offers the code from the SMS |
| Saving | The button text stays "Save" while nothing seems to happen | "Saving…", then the result, and the button stays enabled until the request starts |

## Steps

1. **Skeletons, not spinners.** When content loads into a known layout, show a skeleton of that layout: the same boxes at the same sizes, in a muted surface color, so nothing jumps when the content arrives. Keep a spinner only for a short action on a button or for a wait with no known shape.
2. **Placeholders for images.** Give every image its `width` and `height` (or an `aspect-ratio`) and show a blurred preview or its dominant color until it loads. Never an empty gray box or a box that collapses to zero.
3. **Optimistic updates.** For actions that almost always succeed (like, save, follow, toggle, reorder, mark as read), change the screen on tap and send the request in the background. If it fails, put the old state back and say what failed and what to do.
4. **Undo instead of confirm.** For a delete or archive the user can reverse, act at once and show an "Undo" button for a few seconds. Keep a confirmation only for actions that cannot be reversed or that affect other people, and then name the action on the button ("Delete 3 files"), not "OK".
5. **Motion that explains.** Animate only `transform` and `opacity`, and name the properties (never `transition: all`). Use a shared element transition (the View Transitions API, or the framework's equivalent) when a tapped item opens into its own screen. Keep every animation interruptible and honor `prefers-reduced-motion` with a reduced or no-motion variant. Remove fade-and-slide-up entrances on every section, hover lifts on every card, and looping decoration: motion that nobody triggered is allowed once per page, for the one thing the reader must notice. Ask what each animation tells the user, and remove it when the answer is nothing.
6. **Gestures people expect.** Sheets and drawers close with a drag down, toasts and cards dismiss with a swipe, and each gesture also has a button and a keyboard path. Build them with the Gestures skill when it is installed.
7. **Forms that fill themselves.** Give inputs the right `type`, `inputmode`, `autocomplete`, and `name` (`one-time-code` for verification codes, `email`, `tel`, `postal-code`). Never block paste. Labels are clickable. Errors appear inline next to the field and say how to fix it, and the first error gets focus on submit.
8. **Busy controls show it.** A refresh button spins its icon while the request runs, sets `aria-busy="true"`, ignores clicks until it ends, and keeps its width. Any button that starts a request shows the same busy state. A "Live" indicator pulses only when an update arrives, not forever, and its tooltip says when it last updated.
9. **Visible feedback.** Every interactive element has a hover state and a visible `:focus-visible` ring; never remove the outline without a replacement. Loading labels end with an ellipsis ("Saving…"). Async messages (toasts, validation) are announced with `aria-live="polite"`.
10. **Every state exists.** Check the empty state, the loading state, the error state, a very long value, and a very short one. A screen that only works with ideal data is not finished.
11. When the app runs, measure it: `node <skill-dir>/scripts/lintapple/probe.mjs <url>` reports `transition-all`, and lintapple reports focus, label, and target size problems.

## Check

- No spinner sits where a skeleton of known content would fit; no image loads into an empty box.
- Frequent, reversible actions update on tap and roll back on failure.
- Reversible deletes use undo; confirmations remain only for irreversible actions and name the action.
- No `transition: all`; motion uses `transform` and `opacity` and respects `prefers-reduced-motion`.
- Sheets and drawers close with a drag as well as a button.
- Inputs have the right type, `inputmode`, and `autocomplete`; verification codes use `one-time-code`.
- Every interactive element has hover and `:focus-visible` states.
- A refresh or any request button shows a busy state (spinning icon, `aria-busy`) until the request ends.
- Empty, loading, error, long, and short states all render.
