# Pass 2: Corner radius

## Goal

A small, consistent set of radii so every surface looks like it belongs to the same system.

## Before and after in the source

The clip marks the corners of the search field, the active nav item, and the stat and revenue cards.

- **Before:** the search field is a full pill, the active nav item is a rounded bar with a gradient, and the cards have a large, soft radius.
- **After:** the search field and the active nav item use the same moderate rounded rectangle, and the cards use a matching, slightly larger radius. Count badges lose their pill shape later (pass 5) and become plain numbers.

## Steps

1. List every `border-radius` (or `rounded-*` class) on the screen.
2. Keep at most three values: one for small controls (inputs, nav items, buttons), one for cards and panels, and full rounding only for elements that are truly circular (avatars, dots).
3. Replace pill shapes on inputs, nav items, and rectangular badges with the control radius.
4. When an element sits inside another with padding, make the inner radius smaller than the outer one so the corners look parallel. A common rule is inner radius = outer radius minus the padding. This rule is general guidance, not shown in the source.
5. Store the values as tokens (for example `--radius-control`, `--radius-card`).

## Check

- No more than three radius values remain.
- Inputs and nav items no longer look like pills.
