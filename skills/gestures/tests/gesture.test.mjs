import assert from "node:assert/strict";
import test from "node:test";

import { applyBounds, atRest, createVelocityTracker, nearestSnap, reducedSpring, rubberband, shouldDismiss, stepSpring } from "../assets/templates/gesture.js";

function simulate(from, target, velocity, config) {
    let state = { value: from, velocity };
    let peak = from;
    for (let step = 0; step < 240 * 5; step++) {
        state = stepSpring(state, target, config, 1 / 240);
        peak = Math.max(peak, state.value);
        if (atRest(state, target)) return { state, peak, seconds: step / 240 };
    }
    return { state, peak, seconds: Infinity };
}

test("rubber band moves less the further past the edge, and never reaches the dimension", () => {
    const a = rubberband(50, 400);
    const b = rubberband(200, 400);
    assert.ok(a > 0 && a < 50);
    assert.ok(b > a && b - a < 150);
    assert.ok(rubberband(100000, 400) < 400);
    assert.equal(rubberband(-50, 400), -a);
    assert.equal(rubberband(0, 400), 0);
});

test("bounds clamp hard without elastic and resist with it", () => {
    assert.equal(applyBounds(-80, { min: 0 }, 400, false), 0);
    const elastic = applyBounds(-80, { min: 0 }, 400, true);
    assert.ok(elastic < 0 && elastic > -80);
    assert.equal(applyBounds(120, { min: 0, max: 300 }, 400), 120);
});

test("velocity comes from recent samples and is zero after the pointer holds still", () => {
    const tracker = createVelocityTracker();
    for (let t = 0; t <= 200; t += 10) tracker.add(t, t * 2);
    assert.equal(Math.round(tracker.velocity(200)), 2000);
    assert.equal(tracker.velocity(300), 0);
    tracker.reset();
    assert.equal(tracker.velocity(0), 0);
});

test("a flick dismisses even over a short distance, and a slow short drag snaps back", () => {
    assert.equal(shouldDismiss({ offset: 30, velocity: 900, distance: 400 }), true);
    assert.equal(shouldDismiss({ offset: 200, velocity: 0, distance: 400 }), true);
    assert.equal(shouldDismiss({ offset: 60, velocity: 100, distance: 400 }), false);
    assert.equal(shouldDismiss({ offset: -200, velocity: -900, distance: 400 }), false);
    assert.equal(shouldDismiss({ offset: -200, velocity: 0, distance: 400, direction: -1 }), true);
});

test("the release spring carries velocity and settles; reduced motion never overshoots", () => {
    const fling = simulate(0, 100, 3000, { stiffness: 400, damping: 20 });
    assert.ok(fling.peak > 100, "a fast fling overshoots a little");
    assert.ok(fling.seconds < 2);
    assert.ok(Math.abs(fling.state.value - 100) < 0.5);

    const calm = simulate(0, 100, 3000, reducedSpring({ stiffness: 400, damping: 20 }));
    assert.ok(calm.peak <= 100.5, `reduced motion peaked at ${calm.peak}`);
});

test("snap points follow the fling, not just the release position", () => {
    const points = [0, 300, 600];
    assert.equal(nearestSnap(250, 0, points), 300);
    assert.equal(nearestSnap(320, -1500, points), 0);
    assert.equal(nearestSnap(320, 2000, points), 600);
});
