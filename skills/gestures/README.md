<div align="center">

# Gestures

> Drags, swipes, and sheets that feel physical in any web stack

**Teaches the agent the track and release rules of direct manipulation and ships a dependency-free gesture module with a recipe for every framework.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Browser](https://img.shields.io/badge/browser-Pointer%20Events-blue.svg)](#requirements)
[![Agents](https://img.shields.io/badge/agents-10%20supported-8A63D2.svg)](#installation)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](#requirements)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](#license)

[Quick Start](#quick-start) • [Usage](#usage) • [Reference](#reference) • [Troubleshooting](#troubleshooting)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Reference](#reference)
- [Output](#output)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Overview

Gestures built by agents tend to animate the element toward the finger with a transition, update framework state on every pointer move, dismiss only on distance, and use keyframes that cannot be caught mid-flight. The result trails the finger, stutters, ignores flicks, and jumps when grabbed. Emil Kowalski's `gestures` skill explains the physics that fixes this, but its examples assume React with Motion and Vaul.

This version keeps the rules and makes them work everywhere: plain HTML and JavaScript, web components, React, Vue, Svelte, Angular, Solid, or anything else. It adds `gesture.js`, a small dependency-free module that implements every rule with Pointer Events, and one recipe per framework that shows where to attach it and how to keep the framework out of the move loop.

```text
  pointer down ──> TRACK: transform written 1:1, rubber band past bounds,
       │                  velocity sampled, no framework state per move
       v
  pointer up ────> RELEASE: distance-or-velocity decision (or snap point)
       │                    spring seeded with release velocity
       v
  grabbed again? ──> spring stops where it is, tracking resumes
       │
       v
  onUpdate ──> linked values (overlay, scale) from the one value
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Build and fix drawers, sheets, swipe-to-dismiss, snap points, pull-to-refresh, and hold-to-confirm in any web framework | Native mobile gestures (SwiftUI, UIKit, Compose, React Native) |
| Ship a copyable gesture module with no dependencies | Add a gesture library the project does not need |
| Show where each framework attaches the gesture and how to avoid re-renders per move | Scroll-driven or decorative animation with no gesture |
| Keep keyboard, screen reader, and reduced-motion paths | Canvas or game input handling |

## Features

- **Track and release rules:** 1:1 tracking with direct `transform` writes, rubber band at the edges, velocity-seeded springs, distance-or-velocity dismissal, fast snap-back, bounce only after a drag.
- **Interruptible by design:** grabbing an element mid-animation stops it where it is; keyframes are never used on anything a gesture can touch.
- **Linked values:** overlays and other dependent styles are derived from the one dragged value, so they never drift apart.
- **`gesture.js` (added):** `createDrag`, `createHold`, `shouldDismiss`, `nearestSnap`, and building blocks, with `touch-action`, ignored interactive children, and reduced motion handled.
- **Framework recipes (added):** plain JavaScript, web components, React (Motion or the module), Vue 3, Svelte 5 actions, Angular directives outside the zone, Solid, and a rule for any other framework.
- **Patterns (added):** bottom sheet on a native `<dialog>`, swipe to dismiss, snap points, drag to reorder, pull to refresh, hold to confirm, and carousels with CSS scroll snapping.
- **Demo page (added):** a working sheet, swipe-to-dismiss toast, and hold-to-delete button to try on a phone.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| A browser with Pointer Events | Any current browser | Runs the gestures | No |
| Node.js | 18+ | Only to run the module's tests | No |

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill gestures
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--scope user` to install for every project, and `--dry-run` to preview. The skill is in the `coding` and `design` packs.

| Agent | Id | Project folder | User folder |
|-------|----|----------------|-------------|
| Cursor / Cursor CLI | `cursor` | `.cursor/skills` | `~/.cursor/skills` |
| Claude / Claude Code | `claude` | `.claude/skills` | `~/.claude/skills` |
| Antigravity | `antigravity` | `.agents/skills` | `~/.gemini/antigravity/skills` |
| OpenCode | `opencode` | `.opencode/skills` | `~/.config/opencode/skills` |
| Cline | `cline` | `.cline/skills` | `~/.cline/skills` |
| Kilo Code | `kilo` | `.kilocode/skills` | `~/.kilocode/skills` |
| Kiro | `kiro` | `.kiro/skills` | `~/.kiro/skills` |
| Codex | `codex` | `.agents/skills` | `~/.agents/skills` |
| GitHub Copilot | `copilot` | `.github/skills` | `~/.copilot/skills` |
| Muse Code | `muse` | `.agents/skills` | `~/.agents/skills` |

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/gestures` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/gestures .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\gestures .claude\skills\
```

Each agent has a short guide in `skills/gestures/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

## Quick Start

```text
Make the notification toasts in this Vue app swipe-to-dismiss, and the filter panel a bottom sheet on mobile.
```

The agent finds the stack, copies `gesture.js` into the project, attaches it with the Vue recipe (`onMounted` and `onBeforeUnmount`, no reactive writes per move), dismisses toasts on distance or velocity in the direction they entered, and builds the filter panel as a `<dialog>` sheet with a linked backdrop, Escape, and a close button.

## Usage

### Input

| Input | Required | Example |
|-------|:--------:|---------|
| The interaction | Yes | "swipe to dismiss", "bottom sheet with snap points", "hold to delete" |
| Where it lives | No | A component, page, or file; the agent finds the framework itself |
| Symptom to fix | No | "lags behind my finger", "jumps when I let go", "can't grab it mid-close" |

### Examples

```text
The cart drawer lags behind my finger on mobile. Fix it.
```

```text
Add snap points at 30%, 60%, and full height to the map sheet. Plain JavaScript, no framework.
```

```text
Our Angular list needs swipe-left-to-archive on each row.
```

```text
Add hold-to-delete to the project card's delete button in this Svelte app.
```

## How It Works

```text
  1. Find the stack         package.json or HTML; existing gesture or drawer library?
          │
  2. Choose the tool        drawer library ─ project's gesture library ─ gesture.js
          │
  3. Attach                 framework recipe: mount / unmount hooks, no state per move
          │
  4. Apply the rules        track 1:1 ─ rubber band ─ release spring with velocity
                            ─ distance or velocity ─ linked values ─ interruptible
          │
  5. Check                  touch-action, 44 px targets, keyboard path, reduced motion,
                            test on a real phone
```

## Reference

### gesture.js

```js
import { createDrag, createHold, shouldDismiss, nearestSnap } from "./gesture.js";
```

`createDrag(element, options)`:

| Argument | Default | Description |
|----------|---------|-------------|
| `axis` | `"y"` | `"x"` or `"y"` |
| `bounds` | None | `{ min, max }` translate range in px |
| `elastic` | `true` | Rubber band past the bounds instead of a hard stop |
| `handle` | The element | Where the press starts, for example a grip |
| `ignore` | Buttons, links, inputs, `[data-no-drag]` | Selector for children that never start a drag |
| `onUpdate(value, info)` | None | Every new value, with `info.phase`, `info.velocity`, and `info.element`; derive linked values here |
| `onRelease(info)` | Settle in bounds | Return the value to settle at; `info` has `value`, `offset`, `velocity`, `element` |
| `onRest(value)` | None | The release spring stopped |
| `spring` | `{ stiffness: 400, damping: 40, mass: 1 }` | Release spring |
| `value` | `0` | Starting value |

Returns `{ value, dragging, animateTo(target, { velocity, spring }), set(value), stop(), destroy() }`.

`createHold(element, options)`:

| Argument | Default | Description |
|----------|---------|-------------|
| `duration` | `1500` | Milliseconds of holding to complete |
| `cancelDuration` | `150` | Milliseconds of the ease-out snap back |
| `onProgress(p)` | None | Progress from 0 to 1 |
| `onComplete()` | None | Held for the full duration |
| `onCancel()` | None | Released early |

Helpers:

| Function | Description |
|----------|-------------|
| `shouldDismiss({ offset, velocity, distance, threshold = 0.4, velocityThreshold = 500, direction = 1 })` | True past `threshold` of `distance`, or faster than `velocityThreshold` px/s, in `direction` |
| `nearestSnap(value, velocity, points, projectionSeconds = 0.2)` | Nearest snap point to the projected position |
| `rubberband(overshoot, dimension, constant = 0.55)` | iOS-style resistance |
| `createVelocityTracker(windowMs = 100, stillMs = 40)` | Release velocity in px/s, zero if the pointer stopped |
| `stepSpring`, `atRest`, `reducedSpring`, `applyBounds` | Building blocks for custom gestures |

### Reference files

| File | Purpose |
|------|---------|
| `references/frameworks.md` | Attach and detach recipes for plain JavaScript, web components, React, Vue, Svelte, Angular, Solid, and any other framework |
| `references/patterns.md` | Bottom sheet on `<dialog>`, swipe to dismiss, snap points, reorder, pull to refresh, hold to confirm, carousels |
| `assets/examples/demo.html` | Working demo of the module |

## Output

Code changes in the project: `gesture.js` copied once (for example `src/lib/gesture.js`) unless the project's own library is used, the gesture attached in the component, and the styles it needs.

```text
src/
├── lib/gesture.js            # copied from the skill, no dependencies
└── components/
    ├── Toast.vue             # createDrag on x or y, shouldDismiss, dismiss button kept
    └── FilterSheet.vue       # <dialog>, createDrag with linked backdrop, Escape, close button
```

| Section | Contents |
|---------|----------|
| Gesture code | The attach and detach calls, release decision, and linked values |
| Styles | `touch-action`, hit areas, `overscroll-behavior`, hover gated to fine pointers |
| Accessibility | The non-gesture path (button, Escape, keyboard) and reduced motion |

## Development

| Command | Action |
|---------|--------|
| `npm run test:skills` | Runs the `gesture.js` tests with the other skill script tests, from the repository root |
| `python -m http.server 8765` in `skills/gestures/assets` | Serves the demo at `http://127.0.0.1:8765/examples/demo.html` |
| `node packages/cli validate --skill gestures` | Checks the skill against the repository rules |

## Troubleshooting

<details>
<summary><strong>The element lags behind the finger</strong></summary>

Something animates during tracking: a CSS `transition` on `transform`, a spring, or a framework render per move. Remove the transition while dragging (apply it only on release), write `transform` directly, and keep per-move values out of framework state.

</details>

<details>
<summary><strong>The page scrolls instead of the element moving on a phone</strong></summary>

`touch-action` is missing on the dragged element or its handle. Set `touch-action: pan-x` for a vertical drag or `pan-y` for a horizontal one; `gesture.js` sets it when the element has none.

</details>

<details>
<summary><strong>Pressing a button inside the sheet starts a drag</strong></summary>

The button is not ignored. `gesture.js` ignores buttons, links, and inputs by default; add `data-no-drag` to other interactive children.

</details>

<details>
<summary><strong>The sheet starts in the wrong place</strong></summary>

Its closed position was measured before layout was ready. Measure inside the callbacks (they receive `element`) and set the position again on resize.

</details>

## Limitations

- Web only. Native mobile gesture systems have their own APIs and are out of scope.
- `gesture.js` drags on one axis at a time; free 2D dragging needs two values and is left to a library.
- Reordering lists is delegated to a sortable library because of auto-scroll and accessibility.
- The module was tested in a desktop Chromium browser with mouse and synthetic touch pointer events; test each gesture on a real phone, as the skill's checklist says.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [Emil Kowalski: skills, gestures](https://github.com/emilkowalski/skills/tree/main/skills/gestures) | MIT | The track and release rules, interruptibility, linked values, the iOS sheet curve, spatial consistency, hold asymmetry, and the touch checklist |
| [Vaul](https://vaul.emilkowal.ski/) | MIT | Lessons on drawer performance and timing cited by the rules |

## License

MIT, see [LICENSE](LICENSE). Copyright Emil Kowalski for the upstream skill; the additions in this repository follow the same license.
