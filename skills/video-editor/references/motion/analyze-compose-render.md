# Analyze, compose, render, review

This is the motion loop. Do not skip a step and do not keep rendering to chase taste.

## 1. Analyze the reference

```bash
videoeditor motion analyze --source ref.mp4 --json
```

The engine uses ffmpeg scene detection and small downsampled frames. It returns:

- `cuts`: time, shot number, and shot length for each hard cut.
- `motionIntensity`: low-threshold scene changes per second.
- `palette`: the five or six most common quantized colors with their share.
- `textHeavy`: times whose keyframes have high edge density, a proxy for on-screen text.
- `brief`: path to `motion-brief.md`, plus keyframe PNG paths.

Read the brief. Note the shot order, how long each shot holds, where text appears, and the palette. No model is called, so the brief is a measurement, not an interpretation. Trust the numbers you can see in the keyframes.

## 2. Choose and compose

```bash
videoeditor motion styles --json
videoeditor motion new --template lower-third --text "Ada Lovelace" --accent "Mathematician" --preset reels --json
```

Pick the guide whose mood and pacing are closest to the reference, then the template that carries the same job. Write the returned `path` to disk as returned; it is an editable HTML composition under `~/.gti/video-editor`. Edit that file to change copy, colors, or timing. Keep the `window.__seek(t)` contract from [composition-contract.md](composition-contract.md) intact. Pair it with a `brand.json` when the user has one.

## 3. Render

```bash
videoeditor motion render --preset reels --duration 1 --json
```

`render` uses the last composition from `motion new` unless `--source` points to another file. It captures one frame per `1/fps` second in Chromium and encodes with ffmpeg. For an overlay, add `--alpha` to write WebM with transparency.

Read the checks: `size`, `fps`, `duration`, `frame count`, and `codec` come from ffprobe on the written file. For a one second 30 fps render, expect 30 frames. A mismatch means the composition or the flags are wrong; fix once and render again. If Playwright or Chromium is missing, `doctor` reports it and render fails with the install command. Run `npm install && npx playwright install chromium` in `packages/videoeditor` once, then continue.

## 4. Add and review

```bash
videoeditor motion add --as overlay --at 1.2 --duration 1 --json
videoeditor review --out review.html --json
```

`--as clip` appends a scene to the timeline. `--as overlay` adds a timed overlay that the planner composites over the timeline using ffmpeg's `overlay` filter; it is centered unless the spec supplies `x` and `y`. The review page shows motion overlays in its timeline and a badge in the phone preview.

Write the static review page, give the user the path, and stop. A note on a motion item becomes a copyable instruction for the next edit. In autonomous mode do not open a browser; report the render path, the checks, and the review path.

## 5. Export

When the user accepts the motion clip, run the normal `export --preset` flow if the project is a composed timeline, or hand over the rendered MP4 from `motion render` if the motion piece is the deliverable. The same size, fps, codec, and loudness checks apply.
