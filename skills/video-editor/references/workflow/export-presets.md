# Export presets

`export` applies a whole platform delivery target in one measured command.

```bash
videoeditor export --source clip.mp4 --preset reels --json
```

## Preset table

| Preset | Size | FPS | Video / audio | Loudness | Safe bottom | Note |
|--------|------|-----|---------------|----------|-------------|------|
| `reels` | 1080x1920 | 30 | h264 / aac | -14 LUFS | 18% | Instagram Reels |
| `shorts` | 1080x1920 | 30 | h264 / aac | -14 LUFS | 18% | YouTube Shorts |
| `tiktok` | 1080x1920 | 30 | h264 / aac | -14 LUFS | 22% | TikTok leaves more UI space |
| `youtube` | 1920x1080 | 30 | h264 / aac | -14 LUFS | 8% | Landscape YouTube |

## What the tool does

1. Runs two-pass loudnorm to the preset target.
2. Crops to the preset aspect and scales to the preset size with `fps` and `setsar` normalized.
3. Encodes h264 with yuv420p and AAC at 192k, with `+faststart`.
4. Writes `preset.json` in the request state so the review page can show the target and safe area.

## Checks to read

`preset`, `size`, `fps`, `codec`, `loudness target`, `measured source LUFS`, `safe area bottom`, `cropped percent`, and `output`.

A high `cropped percent` means the source shape was very different from the preset. Look at the review page before accepting the export. Use [reframe.md](reframe.md) to understand the crop geometry, and burn captions with the matching `--preset` so they use the same safe area; see [captions.md](captions.md).

Export writes to a new path in `exports/`. It never overwrites an existing file unless `--out` names that file explicitly.
