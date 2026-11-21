# Motion quality checks

Use these once while planning and once when reading the render checks. They are deterministic checks and one human look, not an endless polish loop.

## Before rendering

- The composition exposes `window.__ready` and `window.__seek(t)`, and `data-width`, `data-height`, `data-duration`, and `data-fps` match the requested canvas.
- Every animated property is set on every call, including `t = 0` and the last frame. No wall-clock timers or `.play()`.
- Copy is native HTML text in marked sections and reads correctly at the chosen size.
- Primary text clears the platform safe area: 18% from the bottom for Reels and Shorts, 22% for TikTok, 8% for YouTube.
- Font size is at least 48px in a 1080px-wide canvas; short-video captions should be larger.
- Palette roles come from the brand kit through CSS variables. There are no stray raw brand colors.
- The guide's pacing is visible in the timing: a social hook lands in the first 0.5s, a lower third holds long enough to read.

## From the render checks

| Check | Expected |
|-------|----------|
| `size` | Exactly the preset canvas, for example 1080x1920 for reels |
| `fps` | The requested frame rate, tolerance 0.05 |
| `duration` | The requested seconds, tolerance 0.2s |
| `frame count` | `fps * duration`, tolerance 1 |
| `codec` | `h264` for MP4, `vp9` for alpha WebM |

A failing check is a real problem. Re-read the composition's data attributes and the render flags, fix once, render once more. Do not change the design because of a taste hunch after the checks pass.

## After the render

- Watch the first and last second. Entrances should finish before the hold; exits should not clip the final word.
- Text should not run off the canvas or sit under the platform UI overlay in the review page.
- The motion should read at thumbnail size: one dominant idea per frame, not a collage.
- If the piece is an overlay, confirm the WebM has real transparency and that `motion add --as overlay` places it where the brief asks.
- If a defect survives one fix pass, say it in one sentence and leave the file for the user to judge.

Style guide ideas come from OpenMotion Motion.md guides (Apache-2.0); the guides and quality rules here are original. See `packages/videoeditor/NOTICE.md`.
