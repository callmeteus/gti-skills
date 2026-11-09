---
name: gestures
description: >-
  Builds drag, swipe, sheet, and hold interactions that track the finger 1:1
  and stay interruptible, in any web stack: plain HTML and JavaScript, web
  components, React, Vue, Svelte, Angular, Solid, or any other framework.
  Ships a dependency-free gesture module (pointer tracking, rubber band,
  release velocity, interruptible spring, linked values, snap points, hold to
  confirm) plus a recipe per framework. Use when building or fixing anything
  the user drags, swipes, flings, holds, or dismisses with a gesture: drawers,
  bottom sheets, swipe-to-dismiss toasts and cards, drag-to-reorder,
  pull-to-refresh, hold-to-delete, or when a gesture feels laggy, trails the
  finger, jumps on release, or cannot be caught mid-animation. Do not use for
  native mobile apps (SwiftUI, UIKit, Jetpack Compose, React Native),
  scroll-driven or decorative animation with no gesture, or canvas and game
  input handling.
compatibility: Any browser with Pointer Events. The bundled module is plain ES2022 JavaScript with no dependencies; Node.js 18+ only to run its tests.
license: MIT, see LICENSE
metadata:
  display-name: Gestures
  upstream: https://github.com/emilkowalski/skills/tree/main/skills/gestures
---

# Gestures

## Core Rule

Always respond in the user's language, regardless of the language used in this skill or in the code you work on.

A gesture is direct manipulation: while the finger is down, the UI is the finger; the moment it lifts, physics takes over. Every rule below follows from that split, and none of it depends on the framework. The framework only decides where you attach the gesture and how you avoid re-rendering on every move.

## First decision: build it, or use something that exists?

A drawer done right needs momentum dragging, an overlay that fades with drag progress, velocity-aware dismissal, focus trapping, and Escape to close. That is weeks of edge cases.

1. **Find the stack.** Read `package.json` (or the HTML) for the framework and any gesture or animation library already in use. Reuse what the project has before adding anything.
2. **Drawer or bottom sheet:** use a maintained drawer library for that framework when one exists (Vaul in React, and its community ports for Vue and Svelte), after checking it is maintained. Otherwise build it on a native `<dialog>` (focus trap and Escape for free) with the bundled module. See [references/frameworks.md](references/frameworks.md).
3. **Anything else** (swipe cards, swipe-to-dismiss, custom drags, hold to confirm): use the project's gesture library if it follows the rules below, or copy the bundled module [assets/templates/gesture.js](assets/templates/gesture.js) into the project and attach it with the recipe for the framework in [references/frameworks.md](references/frameworks.md).
4. **Reorder lists:** use a sortable library for the stack (it handles auto-scroll, keyboard, and screen readers); see the patterns file below.

## The two phases of every gesture

Mixing the phases up is the most common cause of gestures that feel wrong.

```text
Is the pointer currently down?
├── Yes ─> TRACK phase: position maps 1:1 to the pointer.
│          No easing. No duration. No spring. The element IS the finger.
└── No  ─> RELEASE phase: physics finishes the motion.
           A spring seeded with the release velocity. Never a keyframe.
```

### Track phase rules

- **1:1 means 1:1.** Write the pointer position straight to the element. A spring or transition during tracking makes the element trail the finger, like dragging through syrup.
- **Write `transform` on the dragged element itself.** Never move children by changing a CSS variable on a parent: custom properties inherit, so every change restyles every descendant. This exact bug made Vaul's drag lag past about 20 list items.
- **No framework state per move event.** A React `setState`, a Vue `ref`, a Svelte `$state`, an Angular change-detection pass, or a Solid signal on every `pointermove` re-renders and drops frames. Keep the value outside the framework and write styles directly; publish only the outcome (opened, dismissed, reordered) to state.
- **Rubber band at the edges.** Past a boundary the element moves a fraction of the distance instead of stopping dead. A hard stop feels like hitting a wall; resistance says "nothing further" physically.

### Release phase rules

- **Finish with a spring seeded with the gesture's velocity.** The element leaves the finger at the speed it was moving. A fixed-duration ease makes every fling land the same way, which reads as fake.
- **Dismiss on distance OR velocity.** Past about 40 to 50 percent of the travel dismisses, and so does a fast flick over a short distance. Distance-only thresholds make flicks feel ignored.
- **Velocity is zero if the finger stopped.** Measure it over the last ~100 ms of movement; a finger that held still before lifting has no fling.
- **Bounce only at the end of a drag.** A drag applies force, so a slight bounce on release feels physical. The same element moved by a button press gets zero bounce: no force was applied. Smaller elements need a little more bounce to read the same.
- **Snap back fast.** Below the threshold, return quickly; a slow snap-back feels like the UI disagreeing with the user in slow motion.
- **Snap points use the projected position.** Pick the snap nearest to where the fling would coast (position plus velocity times about 0.2 s), not the nearest to where the finger lifted.

## Interruptibility is non-negotiable

The user must be able to catch a sheet mid-close and drag it back. A spring can be stopped where it is and tracking resumes from that exact value; retargeted mid-flight it keeps its velocity. CSS `@keyframes` restart from zero and cannot be caught. **Never use a keyframe animation on anything a gesture can touch.** Use a spring, or a CSS transition on the release only.

## Linked values

The dragged element is rarely alone: an overlay fades, the page behind scales. Derive these from the one dragged value on every update, never animate them separately:

```js
onUpdate: (y) => { overlay.style.opacity = String(0.4 * (1 - y / sheetHeight)); }
```

One source of truth keeps the overlay exactly as faded as the drawer is dismissed, including mid-gesture and when the user reverses. Two separate animations drift apart the moment a gesture is interrupted.

## The bundled module

[assets/templates/gesture.js](assets/templates/gesture.js) implements every rule above with Pointer Events and no dependencies. Copy it into the project (for example `src/lib/gesture.js`), then:

```js
import { createDrag, shouldDismiss } from "./gesture.js";

const drag = createDrag(sheet, {
  axis: "y",
  bounds: { min: 0 },
  onUpdate: (y) => { overlay.style.opacity = String(0.4 * (1 - y / sheet.offsetHeight)); },
  onRelease: ({ offset, velocity }) =>
    shouldDismiss({ offset, velocity, distance: sheet.offsetHeight }) ? sheet.offsetHeight : 0,
  onRest: (y) => { if (y > 0) close(); },
});
// Button-driven moves: no velocity, so no bounce.
openButton.onclick = () => drag.animateTo(0);
// On unmount:
drag.destroy();
```

| Export | Use |
|--------|-----|
| `createDrag(el, options)` | One-axis drag: 1:1 tracking, bounds with rubber band, velocity, interruptible release spring, `onUpdate` for linked values, `animateTo`, `set`, `destroy` |
| `createHold(el, options)` | Press and hold: linear progress while held, fast ease-out cancel, `onComplete` |
| `shouldDismiss({...})` | Distance-or-velocity decision |
| `nearestSnap(value, velocity, points)` | Snap point from the projected position |
| `rubberband`, `createVelocityTracker`, `stepSpring` | Building blocks for custom gestures |

It sets `touch-action` on the handle for the drag axis, ignores presses that start on buttons, links, inputs, and `[data-no-drag]`, and under `prefers-reduced-motion` releases without velocity or overshoot. A working page with a sheet, swipe-to-dismiss, and hold-to-delete is [assets/examples/demo.html](assets/examples/demo.html).

## Patterns

Recipes for the common interactions (bottom sheet on `<dialog>`, swipe-to-dismiss, snap points, drag-to-reorder, pull-to-refresh, hold to confirm, horizontal carousels) are in [references/patterns.md](references/patterns.md).

## Sheets without springs: the iOS curve

When a CSS transition is enough (no fling to carry), Vaul mimics the iOS sheet with `cubic-bezier(0.32, 0.72, 0, 1)` over **500 ms**. The curve is very steep at the start, so 500 ms still feels snappy and lands with a gentle settle. Apply it only on release, never during tracking.

- A **small floating drawer** (not touching the screen edge) should use about 200 ms with `cubic-bezier(0.165, 0.84, 0.44, 1)`; the 500 ms timing only reads right on a full-width, edge-attached sheet.
- **The component must feel like one thing.** If the drawer opens in 200 ms, its height changes and content crossfades use the same timing family.

## Spatial consistency

**An element dismisses in the direction it entered.** A toast that slides up from the bottom is swiped down to dismiss. A gesture that reverses the entrance is felt; one on an axis the element never moved on has to be learned.

## Hold gestures are asymmetric

Press-and-hold uses **linear** progress while held: it shows time passing, and time passes linearly. On early release, snap back fast with ease-out. The deliberate phase is slow and honest; the cancel is instant. Symmetric timing is a bug. `createHold` does this.

## Touch checklist

Run through this for every gesture you ship:

- **Test on a real phone.** Open the dev server by local IP. Trackpad simulation lies about touch, and a 60 Hz monitor hides roughness a 120 Hz phone shows.
- **Hit targets at least 44 by 44 px.** Grow a small visual target with an invisible `::before` hit area instead of growing the layout.
- **`touch-action`** for the drag axis (`pan-x` on a vertical drag, `pan-y` on a horizontal one) so the browser does not fight the gesture with scrolling.
- **`overscroll-behavior: contain`** on scrollable content inside a sheet, so scrolling to the end does not drag the page.
- **Gate hover effects** behind `@media (hover: hover) and (pointer: fine)`; touch fires phantom hovers on tap.
- **Keyboard and screen readers.** Every gesture has a non-gesture path: a close button and Escape for a sheet, a dismiss button for a toast, move buttons or keyboard reordering for a list.

## Reduced motion

Tracking is direct manipulation, the user is producing the motion, so it stays. What reduces under `prefers-reduced-motion`: momentum, bounce, and decorative motion around the gesture. Release settles with a short, non-overshooting move or an opacity change. The bundled module does this automatically.

## When it still feels wrong

- **A spring that feels odd** usually needs more `damping`.
- **A gesture that stutters** is a performance problem: re-check the track phase rules (direct `transform` writes, no state per move, no inherited CSS variables), then record a performance trace while dragging and look for layout or style recalculation on each frame.
- **A feeling you cannot name:** record the gesture on the phone's screen recorder and step through it frame by frame; look for the frame where the element and the finger separate.

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.
