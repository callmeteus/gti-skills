import { existsSync } from "node:fs";
import { join } from "node:path";

import { Json } from "./Json";
import type { ProjectScope } from "./Types";

/** One measured result from a step. */
export interface Check {
    name: string;
    ok: boolean;
    measured: string | number | boolean;
    expected?: string | number | boolean;
    detail?: string;
}

/** A step recorded in the review state. */
export interface CheckStep {
    command: string;
    at: string;
    checks: Check[];
    inputs: string[];
    summary?: string;
}

/** Persisted review state. */
interface CheckLog {
    steps: CheckStep[];
}

/** Where the review log lives in a request. */
function logPath(scope: ProjectScope): string {
    return join(scope.stateDir, "checks.json");
}

/** Reads the recorded checks and inputs, newest first. */
export function readSteps(scope: ProjectScope): CheckStep[] {
    const log = Json.maybe<CheckLog>(logPath(scope));
    return log?.steps ?? [];
}

/**
 * Appends the checks and inputs of one command to the review state.
 * Keeps the last 60 steps so the file stays small.
 */
export function recordStep(
    scope: ProjectScope,
    command: string,
    checks: Check[],
    inputs: string[] = [],
    summary?: string
): CheckStep[] {
    const steps = readSteps(scope);
    const step: CheckStep = {
        command,
        at: new Date().toISOString(),
        checks,
        inputs: [...new Set(inputs)],
        summary
    };
    const updated = [...steps, step].slice(-60);
    Json.write(logPath(scope), { steps: updated } satisfies CheckLog);
    return updated;
}

/** All distinct input paths seen across steps and the timeline. */
export function collectInputs(scope: ProjectScope): string[] {
    const fromSteps = readSteps(scope).flatMap((step) => step.inputs);
    let fromSpec: string[] = [];

    if (existsSync(scope.specPath)) {
        const spec = Json.read<{ scenes?: Array<{ source: string }>; music?: Array<{ source: string }> }>(scope.specPath);
        fromSpec = [
            ...(spec.scenes ?? []).map((scene) => scene.source),
            ...(spec.music ?? []).map((track) => track.source)
        ];
    }

    return [...new Set([...fromSteps, ...fromSpec])].filter(Boolean);
}

/** Shorthand for a passing check. */
export function check(name: string, measured: Check["measured"], detail?: string): Check {
    return { name, ok: true, measured, ...(detail ? { detail } : {}) };
}

/** Shorthand for a failing check. */
export function fail(name: string, measured: Check["measured"], detail: string): Check {
    return { name, ok: false, measured, detail };
}

/** Options for comparing an expected value with a measured one. */
export interface CompareOptions {
    /** Absolute tolerance for numeric comparisons. */
    tolerance?: number;
    detail?: string;
}

/**
 * Builds a check that FAILS when the expected and measured values differ.
 * Numbers use an optional absolute tolerance; strings compare case insensitively.
 */
export function compareCheck(
    name: string,
    expected: Check["measured"],
    actual: Check["measured"],
    options: CompareOptions = {}
): Check {
    let ok: boolean;

    if (typeof expected === "number" && typeof actual === "number") {
        ok = Math.abs(expected - actual) <= (options.tolerance ?? 0);
    } else {
        ok = String(expected).toLowerCase() === String(actual).toLowerCase();
    }

    return {
        name,
        ok,
        measured: actual,
        expected,
        ...(options.detail ? { detail: options.detail } : {})
    };
}

/** Human readable size from ffprobe capabilities. */
export function sizeOf(caps: { width?: number; height?: number }): string {
    return caps.width && caps.height ? `${caps.width}x${caps.height}` : "unknown";
}

/** Numeric frame rate from an ffprobe r_frame_rate value. */
export function fpsNumber(rate?: string): number {
    if (!rate) {
        return 0;
    }
    const parts = rate.split("/").map(Number);
    const numerator = parts[0];
    const denominator = parts[1];

    if (numerator === undefined || !Number.isFinite(numerator)) {
        return 0;
    }
    const value = denominator && Number.isFinite(denominator) ? numerator / denominator : numerator;
    return Number.isFinite(value) ? value : 0;
}

/** Numeric aspect ratio from ffprobe capabilities. */
export function aspectOf(caps: { width?: number; height?: number }): number {
    return caps.width && caps.height ? caps.width / caps.height : 0;
}
