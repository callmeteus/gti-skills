# Reframe

`reframe` changes the frame shape for short-video platforms and reports exactly what was removed.

```bash
videoeditor reframe --source clip.mp4 --aspect 9:16 --json
videoeditor reframe --source clip.mp4 --preset reels --json
```

## How the crop is chosen

The source aspect is compared with the requested aspect. If the source is wider, the tool keeps the full height and crops the width; if it is taller, it keeps the full width and crops the height. The crop window is centered. Even dimensions are used so the encoder accepts them. The cropped result is scaled to the platform output size.

For a 640x360 source at 9:16, the crop is 202x360 at x=219, y=0. That removes 157,680 pixels, or 68.438% of the source area.

The output size is chosen so the file really has the requested aspect. Portrait and square keep a 1080px short side: 9:16 writes 1080x1920, 4:5 writes 1080x1350, and 1:1 writes 1080x1080. Landscape uses a 1920px long side, so 16:9 writes 1920x1080. The `output size` and `output aspect` checks re-probe the written file and fail if it does not match.

## Checks to read

| Check | Meaning |
|-------|---------|
| `source` | Input width and height |
| `aspect` | Requested ratio |
| `crop box` | Kept rectangle and its offset |
| `cropped pixels` | Source area minus kept area, in pixels |
| `cropped percent` | The same loss as a percentage |
| `placement` | `center` plus the exact x and y of the kept region |
| `output size` | Final scaled dimensions |

Report the cropped percent and the placement to the user. A high cropped percent means important content may have left the frame: use the review page to look at the result, or suggest a different crop position in the spec before re-exporting.

`reframe --preset <name>` uses the preset's aspect but not its loudness or fps settings. Use `export --preset` for the complete platform treatment; see [export-presets.md](export-presets.md).
