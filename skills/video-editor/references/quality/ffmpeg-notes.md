# ffmpeg notes

The engine uses the `ffmpeg` and `ffprobe` binaries on PATH. It never downloads a binary and never calls a cloud encoder.

## Output presets

| Format | Video codec | Audio codec | Notes |
|--------|-------------|-------------|-------|
| `mp4` | libx264, `yuv420p` | aac, 192k | Preset veryfast for draft, medium for final; CRF 28 or 20; `+faststart` |
| `mov` | libx264, `yuv420p` | aac, 192k | Same quality settings as mp4 |
| `webm` | libvpx-vp9, CRF 36 or 30 | libopus, 128k | Constant quality with `-b:v 0` |
| `gif` | gif | none | Loops forever; audio is dropped |

`mp4` is the safe default for sharing and for the studio player. Use `webm` for browser embedding, `gif` for short silent clips, and `mov` when the user's editor requires it.

## Filters used

- `trim` and `asetpts` cut each scene to its in point and duration.
- `scale` with `force_original_aspect_ratio` plus `crop` or `pad` implements `cover`, `contain`, and `fill`.
- `fps`, `setsar`, and `settb=AVTB` make segments safe to join with `concat`.
- `drawtext` draws overlays with `expansion=none`, so percent signs are literal.
- `fade` and `afade` implement scene and music fades.
- `concat` joins scene video and scene audio; `amix` combines scene audio with music.

## Limits of version 1

- One sequential track: no picture in picture, no overlapping scenes, no keyframe animation.
- One text style per overlay; no shadows or outline beyond the optional box.
- No subtitle file import, no speech transcription, no automatic captions.
- No color grading or LUTs.
- Text uses the first existing common system font, or the ffmpeg default when none is found. Set `fontFile` for an exact typeface; some Windows ffmpeg builds crash on drawtext without a font.
- Sources must be readable by local ffmpeg. Network URLs are not fetched by the engine.
- A missing audio stream is skipped only when capabilities say it is missing, so run `probe --all` before trusting a plan for unfamiliar media.

Add new features as new spec fields with a matching planner branch and unit test, not as hand written ffmpeg strings in a timeline.
