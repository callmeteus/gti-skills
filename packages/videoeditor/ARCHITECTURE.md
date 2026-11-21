# Video Editor architecture

This note records the decisions that are not obvious from the code.

## Two layers, one contract

The timeline layer turns a JSON document into a single ffmpeg command for composed edits. The measured tool layer exposes one command per operation. Both share the same result envelope and the same `checks` array. `tools --json` publishes the inputs, outputs, and stability of every command so an agent can discover what exists without reading source.

## Measure, do not assume

Every edit command follows the same loop: validate the input, run the operation, measure the result with ffprobe or the filter's own JSON output, and return a check with the measured value. Checks are appended to `checks.json` in the request state, which is what the review page reads. A failing check means the agent must fix the input or flags, not ignore the result.

`loudnorm` is two pass. Its first pass can report non-finite values for synthetic audio, so non-finite measurements are replaced with safe defaults before the second pass. `reframe` computes the crop geometry in JavaScript and reports both the pixel loss and the placement, so the agent can explain what left the frame without guessing from the rendered video.

## Refuse before running ffmpeg

`validateInput` checks existence, regular file status, non-zero size, read access, extension, and expected kind. It runs before ffprobe or ffmpeg in every command that accepts media. Refusals use the `INPUT` error code and include a reason. This keeps a bad path or an empty download from turning into an opaque ffmpeg error.

## Captions without a cloud service

SRT and VTT parsing is local. When a local transcriber is installed, `doctor` detects it and `captions` uses word-level timestamps; omitting the language asks for auto detection, so English is never assumed. Imported cues get evenly distributed word timings and are reported as `estimated`. ASS is generated with karaoke fill tags and a bottom margin derived from the platform safe area. No subtitle service or API is called.

## Motion compositions are code, rendered by seeking

A motion composition is a standalone HTML file with HTML, CSS, SVG, and small JavaScript. It is deterministic: the page defines `window.__seek(t)` and sets `window.__ready = true`. Calling `__seek(t)` for a time must produce the same pixels every time, so animation state is derived from `t` alone, never from wall-clock timers or `.play()`. The root element declares `data-width`, `data-height`, `data-duration`, and `data-fps`. Brand kit values are injected as CSS variables (`--brand-*`, `--font-*`), so a composition reads the kit without importing a runtime.

`motion render` loads the file in headless Chromium with a viewport matching the canvas, calls `__seek(t)` once per frame at `t = index / fps`, screenshots each frame, then encodes the PNG sequence with ffmpeg. MP4 uses x264 and yuv420p; `--alpha` writes WebM with VP9 and yuva420p using transparent screenshots, which is what overlays need. The result is re-probed for size, fps, duration, frame count, and codec. This is the Art Director approach applied to time: the browser paints, ffmpeg records, no generative video API and no cloud service. The idea came from OpenMotion's HTML-to-video workflow (Apache-2.0); this implementation is original and shares no templates or code.

`motion analyze` measures a reference clip with ffmpeg scene detection and small downsampled raw frames. It reports cut times, shot lengths, motion intensity from low-threshold scene changes, a quantized palette, and frames with high edge density as text-heavy. It writes a brief and keyframes for the agent to read. No model is called. A rendered motion file can be added to the timeline as a scene or as a timed `overlays` entry, which the planner composites with ffmpeg's `overlay` filter.

## Static review first, server second

`review --out` writes a standalone HTML page with inputs, recorded checks, a phone-frame preview with a safe-area overlay, and a clickable timeline. Clicking an item and writing a note produces a copyable instruction for the agent. The page works from `file://`. The studio serves the same HTML with token-gated JSON endpoints and confined media, but it is optional; the static page is the default hand over.

## Local by default

The server binds to `127.0.0.1`. LAN or Tailscale exposure requires an explicit `--bind 0.0.0.0`; the result then lists Tailscale URLs when the host has one. Every route requires the token from `studio.json` and `/media/` is confined to `exports/`. The engine never uploads media.

## State lives outside the repository

Requests live in `<GTI_HOME>/video-editor/sessions/<workspace>/<session>/requests/<id>/` or, with `--permanent`, under `projects/<workspace>/`. The workspace path is only hashed into a folder name. Exports, checks, captions, presets, and the studio token file all stay there. A spec may reference media inside the user's workspace, but the CLI never writes into it.

## Version 1 scope

The timeline supports sequential scenes, fit modes, text overlays, fades, scene audio, music, timed motion overlays, and MP4, WebM, MOV, and GIF output. Motion compositions are 2D and seek based; they do not animate in 3D or use a physics engine. Not included: generative video, cloud rendering, subtitle file import beyond SRT/VTT, color grading, and speech transcription without a locally installed transcriber. Add features as new spec fields or tools with a contract entry, checks, and tests, not as ad hoc ffmpeg strings.
