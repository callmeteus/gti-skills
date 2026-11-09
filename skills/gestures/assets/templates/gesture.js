/**
 * gesture.js - framework-free drag, swipe, sheet, and hold gestures.
 *
 * Copy this file into the project. It has no dependencies and works in any framework
 * (attach in a mount hook, detach in the unmount hook) or in plain HTML.
 *
 * Rules it implements:
 * - Track phase: while the pointer is down, the element follows it 1:1 through a direct
 *   `transform` write on the element. No easing, no spring, no framework state per move.
 * - Release phase: a spring seeded with the release velocity finishes the motion.
 * - Interruptible: pressing the element mid-animation stops the spring where it is and
 *   tracking resumes from that exact position.
 * - Rubber band past the bounds, linked values through one onUpdate callback, and
 *   reduced motion (no velocity carry-over, no overshoot).
 */

const SPRING = { stiffness: 400, damping: 40, mass: 1 };

/** iOS-style rubber band: the further past the edge, the less the element moves. */
export function rubberband(overshoot, dimension, constant = 0.55) {
    if (overshoot === 0 || dimension <= 0) return 0;
    const sign = Math.sign(overshoot);
    const distance = Math.abs(overshoot);
    return sign * (1 - 1 / ((distance * constant) / dimension + 1)) * dimension;
}

/** Applies bounds to a raw value, with rubber band resistance past them when enabled. */
export function applyBounds(value, bounds, dimension, elastic = true) {
    const min = bounds?.min ?? -Infinity;
    const max = bounds?.max ?? Infinity;
    if (value < min) return elastic ? min + rubberband(value - min, dimension) : min;
    if (value > max) return elastic ? max + rubberband(value - max, dimension) : max;
    return value;
}

/**
 * Velocity from the last ~100 ms of pointer samples, in px per second.
 * Returns 0 when the pointer stopped before release, so a held-still release does not fling.
 */
export function createVelocityTracker(windowMs = 100, stillMs = 40) {
    let samples = [];
    return {
        reset() {
            samples = [];
        },
        add(time, value) {
            samples.push({ time, value });
            while (samples.length > 2 && time - samples[0].time > windowMs) samples.shift();
        },
        velocity(now = samples.at(-1)?.time ?? 0) {
            if (samples.length < 2) return 0;
            const last = samples.at(-1);
            if (now - last.time > stillMs) return 0;
            const first = samples[0];
            const elapsed = (last.time - first.time) / 1000;
            return elapsed > 0 ? (last.value - first.value) / elapsed : 0;
        },
    };
}

/** One spring step (semi-implicit Euler). Returns the next { value, velocity }. */
export function stepSpring(state, target, config, dt) {
    const { stiffness, damping, mass } = { ...SPRING, ...config };
    const force = -stiffness * (state.value - target) - damping * state.velocity;
    const velocity = state.velocity + (force / mass) * dt;
    return { value: state.value + velocity * dt, velocity };
}

/** True when the spring has settled at the target. */
export function atRest(state, target, restDelta = 0.5, restSpeed = 10) {
    return Math.abs(state.value - target) < restDelta && Math.abs(state.velocity) < restSpeed;
}

/**
 * Release decision for dismissible elements: past a share of the travel distance, or a
 * fast enough flick in the dismiss direction, even over a short distance.
 */
export function shouldDismiss({ offset, velocity, distance, threshold = 0.4, velocityThreshold = 500, direction = 1 }) {
    const towards = Math.sign(direction);
    return offset * towards > distance * threshold || velocity * towards > velocityThreshold;
}

/**
 * Snap point for a release: projects where a free fling would coast to, then picks the
 * nearest point. A flick toward the next point reaches it even from a short drag.
 */
export function nearestSnap(value, velocity, points, projectionSeconds = 0.2) {
    const projected = value + velocity * projectionSeconds;
    return points.reduce((best, point) => (Math.abs(point - projected) < Math.abs(best - projected) ? point : best), points[0]);
}

/** Spring for reduced motion: critically damped or more, so it never overshoots. */
export function reducedSpring(config) {
    const { stiffness, mass } = { ...SPRING, ...config };
    return { ...SPRING, ...config, damping: Math.max(config?.damping ?? SPRING.damping, 2 * Math.sqrt(stiffness * mass)) };
}

function prefersReducedMotion() {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Captures the pointer so moves outside the element still arrive; harmless when capture is not possible. */
function capture(element, pointerId) {
    try {
        element.setPointerCapture?.(pointerId);
    } catch {
        // The pointer is no longer active (released already, or a synthetic event).
    }
}

const IGNORE = "[data-no-drag], button, a, input, textarea, select, label, [contenteditable]";

/**
 * Makes an element draggable along one axis.
 *
 * @param {HTMLElement} element The element that moves (its transform is written directly)
 * @param {object} options
 * @param {"x"|"y"} [options.axis="y"]
 * @param {{min?: number, max?: number}} [options.bounds] Allowed translate range in px
 * @param {boolean} [options.elastic=true] Rubber band past the bounds instead of a hard stop
 * @param {HTMLElement} [options.handle=element] Where the press starts
 * @param {string} [options.ignore] Selector for children that never start a drag
 * @param {(value: number, info: {phase: "track"|"release"|"set", velocity: number, element: HTMLElement}) => void} [options.onUpdate]
 *        Called for every new value. Derive linked values (overlay opacity, scale) here.
 * @param {(info: {value: number, offset: number, velocity: number, element: HTMLElement}) => number | void} [options.onRelease]
 *        Returns the value to settle at. Without it, the element settles where it is, clamped to the bounds.
 * @param {(value: number) => void} [options.onRest] Called when the release spring stops.
 * @param {object} [options.spring] { stiffness, damping, mass }
 * @param {number} [options.value=0] Starting value
 */
export function createDrag(element, options = {}) {
    const axis = options.axis ?? "y";
    const handle = options.handle ?? element;
    const ignore = options.ignore ?? IGNORE;
    const tracker = createVelocityTracker();
    let value = options.value ?? 0;
    let state = null;
    let frame = 0;
    let pointer = null;

    if (!handle.style.touchAction) handle.style.touchAction = axis === "y" ? "pan-x" : "pan-y";

    const dimension = () => (axis === "y" ? element.offsetHeight : element.offsetWidth) || 1;

    function write(next, phase, velocity = 0) {
        value = next;
        element.style.transform = axis === "y" ? `translate3d(0, ${next}px, 0)` : `translate3d(${next}px, 0, 0)`;
        options.onUpdate?.(next, { phase, velocity, element });
    }

    function stop() {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        state = null;
    }

    function animateTo(target, { velocity = 0, spring = options.spring } = {}) {
        stop();
        const reduced = prefersReducedMotion();
        const config = reduced ? reducedSpring(spring) : { ...SPRING, ...spring };
        state = { value, velocity: reduced ? 0 : velocity };
        let last = performance.now();
        const tick = (now) => {
            let remaining = Math.min((now - last) / 1000, 0.064);
            last = now;
            while (remaining > 0) {
                const dt = Math.min(remaining, 1 / 240);
                state = stepSpring(state, target, config, dt);
                remaining -= dt;
            }
            if (atRest(state, target)) {
                write(target, "release", 0);
                state = null;
                frame = 0;
                options.onRest?.(target);
                return;
            }
            write(state.value, "release", state.velocity);
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
    }

    function onDown(event) {
        if (event.button !== 0 || pointer !== null) return;
        if (ignore && event.target instanceof Element && event.target.closest(ignore) && event.target.closest(ignore) !== handle) return;
        stop();
        pointer = { id: event.pointerId, start: axis === "y" ? event.clientY : event.clientX, origin: value };
        tracker.reset();
        tracker.add(event.timeStamp, value);
        capture(handle, event.pointerId);
    }

    function onMove(event) {
        if (!pointer || event.pointerId !== pointer.id) return;
        const raw = pointer.origin + (axis === "y" ? event.clientY : event.clientX) - pointer.start;
        const next = applyBounds(raw, options.bounds, dimension(), options.elastic ?? true);
        tracker.add(event.timeStamp, next);
        write(next, "track", tracker.velocity(event.timeStamp));
    }

    function onUp(event) {
        if (!pointer || event.pointerId !== pointer.id) return;
        const velocity = event.type === "pointercancel" ? 0 : tracker.velocity(event.timeStamp);
        const offset = value - pointer.origin;
        pointer = null;
        const min = options.bounds?.min ?? -Infinity;
        const max = options.bounds?.max ?? Infinity;
        const chosen = options.onRelease?.({ value, offset, velocity, element });
        const target = typeof chosen === "number" ? chosen : Math.min(Math.max(value, min), max);
        animateTo(target, { velocity });
    }

    handle.addEventListener("pointerdown", onDown);
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
    write(value, "set");

    return {
        get value() {
            return value;
        },
        get dragging() {
            return pointer !== null;
        },
        /** Animates to a value with a spring. Pass no velocity for button-triggered moves: no force, no bounce. */
        animateTo,
        /** Jumps to a value without animation. */
        set(next) {
            stop();
            write(next, "set");
        },
        stop,
        destroy() {
            stop();
            handle.removeEventListener("pointerdown", onDown);
            handle.removeEventListener("pointermove", onMove);
            handle.removeEventListener("pointerup", onUp);
            handle.removeEventListener("pointercancel", onUp);
        },
    };
}

/**
 * Press-and-hold to confirm. Progress runs linearly while held (time passes linearly),
 * completes after `duration`, and snaps back fast with ease-out when released early.
 *
 * @param {HTMLElement} element
 * @param {{duration?: number, cancelDuration?: number, onProgress?: (p: number) => void, onComplete?: () => void, onCancel?: () => void}} options
 */
export function createHold(element, options = {}) {
    const duration = options.duration ?? 1500;
    const cancelDuration = options.cancelDuration ?? 150;
    let progress = 0;
    let frame = 0;
    let holding = false;

    const set = (p) => {
        progress = p;
        options.onProgress?.(p);
    };

    function run(from, to, ms, ease, done) {
        cancelAnimationFrame(frame);
        const start = performance.now();
        const tick = (now) => {
            const t = Math.min((now - start) / ms, 1);
            set(from + (to - from) * ease(t));
            if (t < 1) frame = requestAnimationFrame(tick);
            else done?.();
        };
        frame = requestAnimationFrame(tick);
    }

    const onDown = (event) => {
        if (event.button !== 0) return;
        holding = true;
        capture(element, event.pointerId);
        run(progress, 1, duration * (1 - progress), (t) => t, () => {
            holding = false;
            options.onComplete?.();
        });
    };
    const onUp = () => {
        if (!holding) return;
        holding = false;
        run(progress, 0, cancelDuration, (t) => 1 - (1 - t) ** 3);
        options.onCancel?.();
    };

    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onUp);
    element.addEventListener("pointerleave", onUp);
    return {
        reset() {
            cancelAnimationFrame(frame);
            holding = false;
            set(0);
        },
        destroy() {
            cancelAnimationFrame(frame);
            element.removeEventListener("pointerdown", onDown);
            element.removeEventListener("pointerup", onUp);
            element.removeEventListener("pointercancel", onUp);
            element.removeEventListener("pointerleave", onUp);
        },
    };
}
