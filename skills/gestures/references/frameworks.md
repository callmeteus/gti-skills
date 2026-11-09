# Framework Recipes

The rules are the same everywhere; only two things change per stack:

1. **Where to attach and detach** the gesture: after the element is in the DOM, and before it leaves.
2. **How to keep the framework out of the move loop.** Per-move values live outside framework state and are written straight to `element.style`. Only outcomes (opened, closed, dismissed, reordered, confirmed) go into state.

Copy `assets/templates/gesture.js` from this skill into the project once (for example `src/lib/gesture.js`) and import it from the recipes below. When the project already uses a gesture or animation library that tracks 1:1 and releases with a velocity-seeded spring, use it instead and apply the same rules.

## Plain HTML and JavaScript

```html
<script type="module">
  import { createDrag, shouldDismiss } from "./gesture.js";
  const card = document.querySelector(".card");
  const drag = createDrag(card, {
    axis: "x",
    onUpdate: (x) => { card.style.opacity = String(1 - Math.min(Math.abs(x) / card.offsetWidth, 1)); },
    onRelease: ({ offset, velocity }) =>
      shouldDismiss({ offset, velocity, distance: card.offsetWidth }) ? card.offsetWidth * 1.2 : 0,
  });
</script>
```

Web components: create the gesture in `connectedCallback` and call `destroy()` in `disconnectedCallback`.

## React

Two good options:

- **Motion (`motion/react`)**, when the project already uses it. Its drag props follow these rules: `drag="y"`, `dragConstraints`, `dragElastic` (about 0.2 for the rubber band), and `onDragEnd(event, info)` with `info.offset` and `info.velocity` for the distance-or-velocity decision. Drive linked values with `useMotionValue` and `useTransform`, which bypass React rendering. Set `dragMomentum={false}` when the element should stop where the finger stops.
- **The bundled module**, with no new dependency:

```jsx
import { useEffect, useRef } from "react";
import { createDrag, shouldDismiss } from "@/lib/gesture";

export function Sheet({ onClose, children }) {
  const sheet = useRef(null);
  const overlay = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const el = sheet.current;
    const drag = createDrag(el, {
      axis: "y",
      bounds: { min: 0 },
      onUpdate: (y) => { overlay.current.style.opacity = String(0.4 * (1 - y / el.offsetHeight)); },
      onRelease: ({ offset, velocity }) =>
        shouldDismiss({ offset, velocity, distance: el.offsetHeight }) ? el.offsetHeight : 0,
      onRest: (y) => { if (y > 0) close.current(); },
    });
    return () => drag.destroy();
  }, []);

  return (
    <>
      <div ref={overlay} className="overlay" />
      <div ref={sheet} className="sheet">{children}</div>
    </>
  );
}
```

- Never call `setState` inside `onUpdate`; write to refs' `style`. Keep callbacks in a ref, as above, so the effect does not re-create the gesture on every render.
- Drawers: Vaul. Mark interactive children with `data-vaul-no-drag` there, or `data-no-drag` with the bundled module.
- Reorder: a sortable library such as dnd-kit.

## Vue 3

```vue
<script setup>
import { onBeforeUnmount, onMounted, useTemplateRef } from "vue";
import { createDrag, shouldDismiss } from "@/lib/gesture";

const emit = defineEmits(["close"]);
const sheet = useTemplateRef("sheet");
const overlay = useTemplateRef("overlay");
let drag;

onMounted(() => {
  const el = sheet.value;
  drag = createDrag(el, {
    axis: "y",
    bounds: { min: 0 },
    onUpdate: (y) => { overlay.value.style.opacity = String(0.4 * (1 - y / el.offsetHeight)); },
    onRelease: ({ offset, velocity }) =>
      shouldDismiss({ offset, velocity, distance: el.offsetHeight }) ? el.offsetHeight : 0,
    onRest: (y) => { if (y > 0) emit("close"); },
  });
});
onBeforeUnmount(() => drag?.destroy());
</script>

<template>
  <div ref="overlay" class="overlay" />
  <div ref="sheet" class="sheet"><slot /></div>
</template>
```

- `useTemplateRef` needs Vue 3.5 or later; on older versions use `const sheet = ref(null)` with the same name as the `ref` attribute.
- Never write a `ref()` or `reactive()` value inside `onUpdate`; that schedules a render per move. Emit only the outcome.
- Simple swipe detection without physics (direction and distance only): VueUse `useSwipe` or `usePointerSwipe` are fine for triggering an action, not for a dragged element.
- Drawers: a Vaul port for Vue, if maintained; otherwise `<dialog>` plus the module.

## Svelte 5

Wrap the module in an action:

```js
// src/lib/draggable.js
import { createDrag } from "./gesture.js";

export function draggable(node, options) {
  const drag = createDrag(node, options);
  return { destroy: () => drag.destroy() };
}
```

```svelte
<script>
  import { draggable } from "$lib/draggable.js";
  import { shouldDismiss } from "$lib/gesture.js";
  let { onclose, children } = $props();
  let overlay;
</script>

<div bind:this={overlay} class="overlay"></div>
<div
  class="sheet"
  use:draggable={{
    axis: "y",
    bounds: { min: 0 },
    onUpdate: (y, { element }) => { overlay.style.opacity = String(0.4 * (1 - y / element.offsetHeight)); },
    onRelease: ({ offset, velocity, element }) =>
      shouldDismiss({ offset, velocity, distance: element.offsetHeight }) ? element.offsetHeight : 0,
    onRest: (y) => { if (y > 0) onclose(); },
  }}
>
  {@render children()}
</div>
```

- The callbacks receive `element`, so they measure the sheet without a binding, and a sheet whose height changes still dismisses correctly. The overlay comes first in the markup, so it is bound before the action runs.
- Do not bind a `$state` value to the drag position in the template; write styles directly and keep state for the outcome.
- `svelte/motion` springs suit button-driven values, not 1:1 tracking.
- Drawers: a Vaul port for Svelte, if maintained; otherwise `<dialog>` plus the module.

## Angular

Run the gesture outside the zone, so pointer events do not trigger change detection, and re-enter only for the outcome:

```ts
import { Directive, ElementRef, NgZone, OnDestroy, AfterViewInit, inject, output } from "@angular/core";
import { createDrag, shouldDismiss } from "./gesture.js";

@Directive({ selector: "[appSwipeDismiss]", standalone: true })
export class SwipeDismissDirective implements AfterViewInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private zone = inject(NgZone);
  dismissed = output<void>();
  private drag?: ReturnType<typeof createDrag>;

  ngAfterViewInit() {
    const el = this.el.nativeElement;
    this.zone.runOutsideAngular(() => {
      this.drag = createDrag(el, {
        axis: "x",
        onUpdate: (x) => { el.style.opacity = String(1 - Math.min(Math.abs(x) / el.offsetWidth, 1)); },
        onRelease: ({ offset, velocity }) =>
          shouldDismiss({ offset, velocity, distance: el.offsetWidth }) ? el.offsetWidth * 1.2 : 0,
        onRest: (x) => { if (x > 0) this.zone.run(() => this.dismissed.emit()); },
      });
    });
  }

  ngOnDestroy() {
    this.drag?.destroy();
  }
}
```

- With zoneless change detection, the same rule holds for signals: never `set` a signal per move.
- Reorder lists: `@angular/cdk/drag-drop`.

## Solid

```jsx
import { onCleanup, onMount } from "solid-js";
import { createDrag } from "~/lib/gesture";

function Card(props) {
  let el;
  onMount(() => {
    const drag = createDrag(el, { axis: "x", onRest: (x) => x !== 0 && props.onDismiss() });
    onCleanup(() => drag.destroy());
  });
  return <div ref={el} class="card">{props.children}</div>;
}
```

Never write a signal per move; signals update the DOM synchronously and add work to every frame.

## Any other framework

Find its "after mount" and "before unmount" hooks, attach in the first and `destroy()` in the second, keep per-move values out of its reactivity, and emit only outcomes.
