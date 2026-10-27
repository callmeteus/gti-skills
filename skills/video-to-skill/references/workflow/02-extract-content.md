# Step 2: Extract content

Work in a temporary folder outside the skill, for example `./work`. All commands below run from the skill folder; replace `<skill-dir>` with its path.

## 1. Metadata and chapters

```bash
python3 <skill-dir>/scripts/download/download_video.py "<url>" --out ./work --mode metadata
```

Writes `work/metadata.json` with title, channel, duration, and chapters. Chapters are free structure: use them to split the analysis.

## 2. Transcript

With captions (most YouTube videos):

```bash
python3 <skill-dir>/scripts/transcript/get_transcript.py "<url>" --lang en --format json --out ./work/transcript.json
```

- `--list` shows the available caption tracks.
- `--lang pt,en` tries Portuguese first, then English. Manual captions win over auto-generated ones.
- Exit code `2` means the video has no captions. Use the fallback below.

Without captions:

```bash
python3 <skill-dir>/scripts/setup/check_dependencies.py --install --with-whisper
python3 <skill-dir>/scripts/download/download_video.py "<url>" --out ./work --mode audio
python3 <skill-dir>/scripts/transcript/transcribe_audio.py ./work/audio.m4a --out ./work/transcript.json
```

Local files skip the download: pass the file to `transcribe_audio.py` directly.

### X (Twitter) posts

`download_video.py` recognizes `x.com`, `twitter.com`, `fixupx.com`, and `fxtwitter.com` post links and fetches them through the FixupX (FxTwitter) API instead of yt-dlp. Metadata uses the post text as title and the author as channel; there are no chapters. When a post has several videos, pick one with `--index 2`, `--index 3`, and so on.

X has no captions to fetch: `get_transcript.py` always exits with `2` for a post link, so go straight to the Whisper fallback above. Private, deleted, and age-restricted posts cannot be downloaded.

## 3. Keyframes

Download the video once (a local file needs no download):

```bash
python3 <skill-dir>/scripts/download/download_video.py "<url>" --out ./work --mode video --height 720
```

Then extract frames. Pick the mode by video type:

| Video type | Command |
|------------|---------|
| Terminal or code walkthrough | `--mode scene --scene-threshold 0.2 --max 40` |
| Slides or talk | `--mode scene --max 30` |
| Continuous screen recording | `--mode interval --interval 15 --max 40` |
| Short clip under 3 minutes | `--mode interval --interval 5` |

```bash
python3 <skill-dir>/scripts/frames/extract_frames.py ./work/video.mp4 --out ./work/frames --mode scene --max 40
```

`work/frames/manifest.json` maps every frame to its time, so a frame can be matched to the transcript line spoken at that moment.

## 4. Read the frames

Open the frames that matter and read what is on screen: commands, file trees, settings, error messages. Prioritize frames near transcript lines that say "run", "type", "click", "open", "set", or "add".

## Budget

Do not open every frame. Start with the chapter boundaries and the frames near command words, then fill gaps. For videos over 30 minutes, work chapter by chapter.
