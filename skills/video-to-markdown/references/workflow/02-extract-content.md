# Step 2: Extract content

Work in a temporary folder, for example `./work`. All commands run from anywhere; replace `<skill-dir>` with the skill folder path.

## 1. Metadata and chapters

```bash
python3 <skill-dir>/scripts/download/download_video.py "<url>" --out ./work --mode metadata
```

Writes `work/metadata.json` with title, channel, duration, and chapters. Chapters become the draft's sections.

## 2. Transcript

```bash
python3 <skill-dir>/scripts/transcript/get_transcript.py "<url>" --lang en --format json --out ./work/transcript.json
```

- `--list` shows the caption tracks. `--lang pt,en` sets a preference order.
- Manual captions win over auto-generated ones. Auto-generated text needs cleanup of names and jargon.
- Exit code `2` means no captions. Fall back to Whisper:

```bash
python3 <skill-dir>/scripts/setup/check_dependencies.py --install --with-whisper
python3 <skill-dir>/scripts/download/download_video.py "<url>" --out ./work --mode audio
python3 <skill-dir>/scripts/transcript/transcribe_audio.py ./work/audio.m4a --out ./work/transcript.json
```

For a local file, pass it straight to `transcribe_audio.py`.

### X (Twitter) posts

`download_video.py` recognizes `x.com`, `twitter.com`, `fixupx.com`, and `fxtwitter.com` post links and fetches them through the FixupX (FxTwitter) API instead of yt-dlp. Metadata uses the post text as title and the author as channel; there are no chapters. When a post has several videos, pick one with `--index 2`, `--index 3`, and so on.

X has no captions to fetch: `get_transcript.py` always exits with `2` for a post link, so go straight to the Whisper fallback above. Private, deleted, and age-restricted posts cannot be downloaded.

## 3. Frames (skip when the user does not want them)

```bash
python3 <skill-dir>/scripts/download/download_video.py "<url>" --out ./work --mode video --height 720
python3 <skill-dir>/scripts/frames/extract_frames.py ./work/video.mp4 --out ./work/frames --mode scene --max 30
```

| Video type | Mode |
|------------|------|
| Slides or lecture | `--mode scene --max 30` |
| Code or terminal walkthrough | `--mode scene --scene-threshold 0.2 --max 40` |
| Continuous screen recording | `--mode interval --interval 15` |
| Talking head | Skip frames |

`work/frames/manifest.json` records each frame's time.

## Long videos

For videos over 45 minutes, extract and write chapter by chapter. Use `--start` and `--end` on `extract_frames.py` and the chapters from the metadata.
