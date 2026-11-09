# Gesture Patterns

Recipes for the common gesture interactions. They use the bundled `gesture.js`; the same decisions apply with any library that tracks 1:1 and releases with a velocity-seeded spring. Attach and detach them with the recipe for the framework in `references/frameworks.md`.

## Bottom sheet on a native dialog

A `<dialog>` opened with `showModal()` gives focus trapping, inert background, and Escape for free. The gesture only adds the drag.

```html
<dialog class="sheet" id="sheet">
  <div class="grip" aria-hidden="true"></div>
  <div class="content">...</div>
  <button data-no-drag id="close">Close</button>
</dialog>
```

```css
.sheet { margin: auto 0 0; width: 100%; max-width: none; max-height: 85vh; border: 0; border-radius: 16px 16px 0 0; padding: 12px 16px; }
.sheet::backdrop { background: rgb(0 0 0 / var(--backdrop, 0)); }
.sheet .content { overflow-y: auto; overscroll-behavior: contain; }
```

```js
import { createDrag, shouldDismiss } from "./gesture.js";

const sheet = document.getElementById("sheet");
const height = () => sheet.offsetHeight;
const drag = createDrag(sheet, {
  axis: "y",
  bounds: { min: 0 },
  onUpdate: (y) => sheet.style.setProperty("--backdrop", String(0.4 * (1 - Math.min(y / height(), 1)))),
  onRelease: ({ offset, velocity }) => shouldDismiss({ offset, velocity, distance: height() }) ? height() : 0,
  onRest: (y) => { if (y > 0) sheet.close(); },
});

function open() {
  sheet.showModal();
  drag.set(height());
  drag.animateTo(0);            // button-driven: no velocity, no bounce
}
sheet.addEventListener("cancel", (event) => {   // Escape
  event.preventDefault();
  drag.animateTo(height());
});
document.getElementById("close").onclick = () => drag.animateTo(height());
```

- `--backdrop` is set on the dialog itself, not a parent, so only the dialog and its backdrop restyle.
- **Scrollable content:** start a drag from the content only when it is scrolled to the top. Use the grip (or a header) as the `handle` option, or check `content.scrollTop === 0` before letting a downward drag start.
- Use a drawer library instead when the stack has a maintained one; see `SKILL.md`.

## Swipe to dismiss (toasts, cards, list rows)

```js
const drag = createDrag(toast, {
  axis: "y",                    // the axis it entered on: a toast from the bottom is swiped down
  bounds: { min: 0 },           // rubber band upwards, free downwards
  onUpdate: (y) => { toast.style.opacity = String(1 - Math.min(y / toast.offsetHeight, 1)); },
  onRelease: ({ offset, velocity }) =>
    shouldDismiss({ offset, velocity, distance: toast.offsetHeight }) ? toast.offsetHeight * 1.5 : 0,
  onRest: (y) => { if (y > 0) removeToast(); },
});
```

- Remove the element once it is off screen; do not wait for the spring to settle on an exit.
- Pause any auto-dismiss timer while the pointer is down.
- Keep a visible dismiss button for keyboard and screen reader users.

## Snap points

```js
import { createDrag, nearestSnap } from "./gesture.js";

const points = [0, 300, 560];       // open, half, peek (translateY values)
const drag = createDrag(sheet, {
  axis: "y",
  bounds: { min: 0, max: 560 },
  onRelease: ({ value, velocity }) => nearestSnap(value, velocity, points),
});
```

`nearestSnap` projects where the fling would coast (about 0.2 s of travel) and picks the nearest point, so a flick moves one snap even from a short drag. Recompute the points when the viewport size changes.

## Drag to reorder

Reordering needs auto-scroll near the edges, keyboard reordering, screen reader announcements, and layout animation of the other items. Use a sortable library rather than hand-rolling it: SortableJS works with any framework or none, dnd-kit fits React, and `@angular/cdk/drag-drop` fits Angular. Check that it follows the track rules: the dragged item moves with `transform` 1:1, the other items animate with transitions, and nothing re-renders per move.

## Pull to refresh

```js
const threshold = 72;
const drag = createDrag(list, {
  axis: "y",
  handle: list,
  bounds: { min: 0, max: 0 },   // any pull is overscroll: full rubber band
  onUpdate: (y) => { spinner.style.opacity = String(Math.min(y / threshold, 1)); },
  onRelease: ({ value }) => (value > threshold * 0.6 ? threshold * 0.6 : 0),
  onRest: (y) => { if (y > 0) refresh().finally(() => drag.animateTo(0)); },
});
```

- Only start when the list is scrolled to the top; otherwise let the browser scroll.
- Set `overscroll-behavior-y: contain` on the scroller so the browser's own pull-to-refresh does not fire as well.
- A refresh button is still needed for keyboard and mouse users.

## Hold to confirm

```js
import { createHold } from "./gesture.js";

createHold(deleteButton, {
  duration: 1200,
  onProgress: (p) => { fill.style.transform = `scaleX(${p})`; },
  onComplete: () => deleteItem(),
});
```

Linear while held, fast ease-out on early release (see `SKILL.md`). Announce completion for screen readers, and support a keyboard path (for example, a confirm dialog on Enter).

## Horizontal carousels and pagers

Prefer native CSS scroll snapping (`scroll-snap-type: x mandatory` with `scroll-snap-align` on the items): the browser already tracks 1:1, carries momentum, and is accessible. Build a custom drag only when the design needs something scrolling cannot do, such as cards that rotate as they leave.
