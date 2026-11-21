# Render check

Use this once, while reading the first `plan --json`. The plan can prove structure; it cannot prove taste. Taste stays with the user in the studio.

## Before rendering

- `plan.warnings` is empty or every warning is understood. A scene with no audio stream must have `volume: 0`; a silent source with default volume produces a warning and no audio segment.
- `plan.duration` equals the sum of scene durations and matches the user's intended length.
- Scene order matches the user's order. There is no overlap in version 1.
- Every source path in `plan.inputs` is one the user supplied or one the agent copied into `scope.mediaDir`.
- Text overlays use a font file when the exact look matters; without one, ffmpeg's default font is used and its metrics vary by build.
- `plan.width`, `plan.height`, and `plan.fps` match the requested format.
- The output path is inside `scope.exportsDir` unless the user named a destination.

## After rendering

- The returned `path` exists and the reported format matches the request.
- Play the first seconds and the last seconds in the studio. Fades at a cut should finish before the next scene starts.
- Text must not run off the canvas. Long strings need a smaller `fontSize` or an explicit `x` and `y`.
- `contain` scenes show intentional padding in `canvas.background`, not unexpected black bars from a wrong aspect ratio.
- Music volume should sit under dialogue or scene audio; a value near 1 usually overwhelms it.

## One fix pass

When something is wrong, change the named scene or overlay, re-run `plan`, then render once more. Report what changed. Do not audit, tweak, and render in a loop. If a defect survives the one fix pass, say it in one sentence and leave the file for the user to judge.
