# Decision Log Example

A problem list from step 2, then the same problems grouped under the fixes from step 3. Adapted from the upstream skill, with kind tags and a kept case added.

## Problems

```md
- [special] `ui/LogoutDialog.tsx:30` waits 100ms after closing and hopes the message input can take focus by then.
- [hidden] `ui/Toolbar.tsx:40` and `ui/Menu.tsx:22` call the same actions, each with its own check for when they're disabled.
- [needless] `checkout/submit.ts:9` depends directly on `payments/stripe.ts`.
- [hidden] `shortcuts/keymap.ts:18` has a switch with one case per action, separate from the menu's list.
- [hidden] `ui/CommandPalette.tsx:55` keeps its own list of actions, and it's missing the newer ones.
- [special] `ui/SettingsDialog.tsx:61` sets a global `skipRefocus` flag to stop the logout dialog it opens from sending focus to the message input.
- [special] `history/undo.ts:30` has a special case for every action that can be undone.
- [special] `refunds/refund.ts:22` wraps every Stripe call in `if (order.provider === "paypal")`.
- [hidden] Every action handler has to call `track()` by hand, and some don't.
- [hidden] `ui/Toolbar.test.tsx` and `ui/Menu.test.tsx` test the same actions separately.
- [special] `sync/upload.ts:88` retries three times with a 2s sleep.
```

## Fixes

```md
- Fix 1: Make the general `Dialog` give focus back to whatever had it before it opened, so the wait and the flag can both go.
  - `ui/LogoutDialog.tsx:30` waits 100ms after closing and hopes the message input can take focus by then.
  - `ui/SettingsDialog.tsx:61` sets a global `skipRefocus` flag to stop the logout dialog it opens from sending focus to the message input.
- Fix 2: Define a `PaymentProvider` interface that Stripe and PayPal both implement, so checkout and refunds no longer know which one they're using.
  - `checkout/submit.ts:9` depends directly on `payments/stripe.ts`.
  - `refunds/refund.ts:22` wraps every Stripe call in `if (order.provider === "paypal")`.
- Fix 3: Make every user action a command with a name, a handler and an undo, so the toolbar, menu, shortcuts, palette and undo history all run from one list.
  - `ui/Toolbar.tsx:40` and `ui/Menu.tsx:22` call the same actions, each with its own check for when they're disabled.
  - `shortcuts/keymap.ts:18` has a switch with one case per action, separate from the menu's list.
  - `ui/CommandPalette.tsx:55` keeps its own list of actions, and it's missing the newer ones.
  - `history/undo.ts:30` has a special case for every action that can be undone.
  - Every action handler has to call `track()` by hand, and some don't.
  - `ui/Toolbar.test.tsx` and `ui/Menu.test.tsx` test the same actions separately.
```

## Kept, with reason

```md
- `sync/upload.ts:88` retries three times with a 2s sleep: the storage provider documents rate limiting with Retry-After; the retry stays, moved into the storage client so callers no longer repeat it.
```

Fix 3 removes five special cases and two hidden links at once, and looks nothing like any single problem it solves. That is the shape to look for.
