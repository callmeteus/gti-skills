# Pass 7: Actions and structure

## Goal

Each view has one obvious thing to do. Lists show what the user compares and one action per item; forms, options, and actions that belong to one item or one state appear only where and when they apply. Every action stays reachable: this pass moves actions, it does not remove them.

## Before and after

These come from an auction page built by an agent, not from the source clip.

| Element | Before | After |
|---------|--------|-------|
| Item cards in a grid | Each card holds a bid field, a filled "Place bid" button, an auto-bid field, an outlined "Turn on auto-bid" button, and a "Cancel auto-bid" link | Each card shows the title, current bid, leader, and one "Place a bid" button that opens a modal with the bid form |
| Auto-bid | A second form in every card | A toggle inside the bid modal: "Bid automatically up to" with its field shown when the toggle is on |
| "Cancel auto-bid" | Shown on every card, with or without an active auto-bid | Shown only on a card whose auto-bid is active, next to the auto-bid status |
| Bid limits | One sentence: "Minimum bid: R$ 50,00 Maximum: R$ 1.000,00." | Label and value pairs in the modal, next to the field they constrain |
| Filled buttons | One large filled primary per card, three or more on one screen | None in the list; the filled primary is the confirm button inside the modal |
| Access notice | "This auction is for attendees with a confirmed ticket. Get a ticket" in a gray box inside every card | One notice under the section heading, with one "Get a ticket" link |
| Filters | A boxed panel of 11 underlined filter chips in four groups above 4 items | No filters; the two sections already split the items |

## Steps

1. Count the primary actions on the view. Keep one filled primary for the main task, two at most. Repeated actions on list items become secondary (outline or plain) buttons; actions used rarely move into an overflow menu or the item's detail.
2. Take forms out of list items. A list or grid item shows the facts the user compares and one action. Its form opens in a modal, a sheet, or the detail page for the item the user picked. This follows the creation-in-a-modal rule for new items.
3. Fold advanced options into the main form. Auto-bid, recurrence, scheduling, and similar options sit behind a toggle or a disclosure inside the one form, not as a second form next to it.
4. Show state actions only in their state. "Cancel auto-bid" appears only while auto-bid is on, "Retry" only after a failure, "Undo" only after the action. Do not show a disabled control for a state the user is not in unless it explains how to reach that state.
5. Show facts as data. Limits, prices, dates, and counts are label and value pairs, aligned like a small table, not sentences with values buried inside.
6. Keep each action next to what it acts on. A field's limits sit by the field; an item's action sits in the item, at the same place in every item.
7. Say shared facts once, above the list. When every item carries the same notice ("This auction is for attendees with a confirmed ticket. Get a ticket") or repeats a fact the section heading already gives ("Attendees only", "Online or local"), state it once for the section: one notice with its one link, and the shared facts in the section header. Each item keeps only what differs: its title, its own facts, its value, and its action.
8. Add filters only when the list needs them. A list that fits on a screen or two needs no filters: show the items. Never put more filter options on the page than there are items. When a list grows, start with one control (search, or one segmented filter on the facet users narrow by most) and add more only when people use them. Facets that split the page into sections (attendees only, open to all) are already filters; do not repeat them as chips.
9. When the app runs, measure it: `node <skill-dir>/scripts/lintapple/probe.mjs <url>` reports `repeated-form` (fields inside the items of one list), `competing-primaries` (more than two filled, saturated buttons in the first viewport), `repeated-item-text` (text every item repeats), and `filters-outweigh-items` (more filter options than items).

## Check

- One filled primary per view, two at most, and the probe reports no `competing-primaries`.
- No list or grid item carries a form; the probe reports no `repeated-form`.
- Every action that was on the screen before is still reachable, now from the place it belongs.
- No action is shown in a state where it cannot apply.
- Limits and values read as label and value pairs.
- No notice or fact repeats in every item; the probe reports no `repeated-item-text`.
- No filter panel on a list that fits on a screen or two; the probe reports no `filters-outweigh-items`.
