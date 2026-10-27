# Shared video scripts

Python scripts for downloading videos, fetching transcripts, and extracting frames, shared by two skills.

## Overview

This package owns the scripts that [Video to Skill](../../../skills/video-to-skill/README.md) and [Video to Markdown](../../../skills/video-to-markdown/README.md) both need. `node packages/cli build` copies `scripts/` into each skill, because a skill folder must be self-contained when installed.

It uses the Python standard library, plus the public FixupX (FxTwitter) API for X posts, `youtube-transcript-api` 1.x for captions and optional Whisper for audio without captions. It does not hold anything specific to one skill; scripts used by only one skill live in that skill.

## Run

Scripts are run from an installed skill. To run them from the repository root:

```bash
python packages/python/shared/scripts/setup/check_dependencies.py
python packages/python/shared/scripts/transcript/get_transcript.py VIDEO_ID --format markdown
```

## Layout

| Path | Responsibility |
|------|----------------|
| `scripts/lib/` | Shared helpers: video ID parsing, timestamps, process runner, transcript shape, and `fixupx.py` for X posts |
| `scripts/setup/` | `check_dependencies.py`: reports and installs `yt-dlp`, `ffmpeg`, `youtube-transcript-api`, and Whisper |
| `scripts/download/` | `download_video.py`: video, audio, or metadata with `yt-dlp`, or through the FixupX API for X posts |
| `scripts/transcript/` | `get_transcript.py` for captions, `transcribe_audio.py` for Whisper |
| `scripts/frames/` | `extract_frames.py`: timestamped keyframes by interval or scene change |
| `tests/` | Unit tests |

## Scripts

| Script | Output |
|--------|--------|
| `check_dependencies.py [--install] [--with-whisper]` | JSON status report |
| `download_video.py URL --mode metadata\|video\|audio --out DIR [--index N]` | JSON with file paths, `metadata.json` for metadata |
| `get_transcript.py VIDEO --lang pt,en --format text\|json\|srt\|markdown --out FILE` | Transcript; exit code 2 when the video has no captions or is an X post |
| `transcribe_audio.py FILE --model base --language en --out FILE` | Transcript JSON from Whisper |
| `extract_frames.py VIDEO --mode interval\|scene --out DIR` | `frame_0001.jpg` files and `manifest.json` with each frame time |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `FIXUPX_API_BASE` | `https://api.fxtwitter.com` | Base URL of the FixupX (FxTwitter) status API used for X posts |

## Testing

```bash
python -m unittest discover -s packages/python/shared/tests -v
```

The tests cover video ID parsing, timestamp formatting, install planning per operating system, command building, caption selection, subtitle rendering, and frame time planning. They do not touch the network.

See [../../../README.md](../../../README.md) for the full repository.
