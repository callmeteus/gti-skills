<div align="center">

# Video to Markdown

> Turn any talk or tutorial into notes you can search, skim, and keep

**Converts a YouTube, X, or local video into structured Markdown with timestamp links, inline keyframes, and every command and code snippet extracted.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Python](https://img.shields.io/badge/python-3.8%2B-blue.svg)](#requirements)
[![Agents](https://img.shields.io/badge/agents-10%20supported-8A63D2.svg)](#installation)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](#requirements)
[![License](https://img.shields.io/badge/license-not%20declared-lightgrey.svg)](#license)

[Quick Start](#quick-start) • [Usage](#usage) • [Reference](#reference) • [Troubleshooting](#troubleshooting)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Reference](#reference)
- [Output](#output)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [License](#license)

## Overview

Talks and tutorials carry information in two channels: what is said and what is shown. Slides, diagrams, and terminal sessions often hold details the speaker never reads aloud.

Video to Markdown extracts the transcript, samples frames where slides, code, diagrams, or UI appear, builds a sectioned draft with links back to the exact moment in the video, and has the agent turn that draft into one of four formats: study notes, tutorial, full transcript, or meeting notes.

```text
  video URL or file + desired format
          │
          ├──> download_video.py ──> metadata and chapters
          ├──> get_transcript.py ──> timestamped transcript (Whisper without captions)
          ├──> extract_frames.py ──> timestamped keyframes
          │
          v
  assemble_draft.py ──> sections by chapter, frames placed, raw text in blockquotes
          │
          v
  agent condenses the draft into the chosen format
          │
          v
  notes.md  (frontmatter, linked sections, code blocks, frames)
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Ask what kind of document you want before extracting anything | Dump a raw transcript, except in the full transcript format |
| Extract metadata, a timestamped transcript, and keyframes | Publish or upload the result |
| Build a draft grouped by chapters with frames in the right section | Download private, members-only, or region-locked videos |
| Write Markdown with frontmatter, sections, code blocks, and source link | Summarize content it cannot see or hear |

## Features

- **Four formats:** study notes, tutorial, full transcript, and meeting notes, each with a template
- **Timestamp links:** every section heading jumps to its moment in the video
- **Chapter-aware drafts:** uses the video chapters when they exist, fixed time windows otherwise
- **Visual context:** keyframes of slides, code, diagrams, and UI placed in the section they belong to
- **Code extraction:** commands and snippets pulled into fenced blocks
- **Caption fallback:** transcribes locally with Whisper when a video has no captions
- **X (Twitter) posts:** downloads post videos through the FixupX (FxTwitter) API, with no account or API key
- **Self-installing:** `check_dependencies.py` detects the platform and installs missing tools

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| Python | 3.8+ | Runs the helper scripts | No |
| [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api) | 1.x | Fetches YouTube captions | Yes |
| [FxTwitter API](https://github.com/FxEmbed/FxEmbed) | Public service | Resolves X post videos to direct MP4 links; network only, nothing to install | - |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Latest | Downloads video, audio, and metadata | Yes |
| [ffmpeg](https://ffmpeg.org/) | Any recent | Extracts frames | Yes |
| [openai-whisper](https://github.com/openai/whisper) or [mlx-whisper](https://github.com/ml-explore/mlx-examples/tree/main/whisper) | Latest | Transcribes videos without captions (`--with-whisper`) | Yes |

| Platform | System package manager used |
|----------|-----------------------------|
| macOS | Homebrew (must already be installed) |
| Linux | `apt-get`, `dnf`, or `pacman` (uses `sudo` unless root) |
| Windows | `winget` |

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill video-to-markdown
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--scope user` to install for every project, and `--dry-run` to preview.

| Agent | Id | Project folder | User folder |
|-------|----|----------------|-------------|
| Cursor / Cursor CLI | `cursor` | `.cursor/skills` | `~/.cursor/skills` |
| Claude / Claude Code | `claude` | `.claude/skills` | `~/.claude/skills` |
| Antigravity | `antigravity` | `.agents/skills` | `~/.gemini/antigravity/skills` |
| OpenCode | `opencode` | `.opencode/skills` | `~/.config/opencode/skills` |
| Cline | `cline` | `.cline/skills` | `~/.cline/skills` |
| Kilo Code | `kilo` | `.kilocode/skills` | `~/.kilocode/skills` |
| Kiro | `kiro` | `.kiro/skills` | `~/.kiro/skills` |
| Codex | `codex` | `.agents/skills` | `~/.agents/skills` |
| GitHub Copilot | `copilot` | `.github/skills` | `~/.copilot/skills` |
| Muse Code | `muse` | `.agents/skills` | `~/.agents/skills` |

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/video-to-markdown` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/video-to-markdown .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\video-to-markdown .claude\skills\
```

Each agent has a short guide in `skills/video-to-markdown/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

Optionally install the dependencies ahead of time (use `python` instead of `python3` on Windows):

```bash
python3 skills/video-to-markdown/scripts/setup/check_dependencies.py --install
```

## Quick Start

Start a new agent session and ask:

```text
Convert https://youtube.com/watch?v=VIDEO_ID into study notes with timestamps and frames.
```

The agent confirms the format, extracts the transcript and frames, builds the draft, and writes the Markdown file.

## Usage

### Input

If a required input is missing, the agent asks before starting.

| Input | Required | Example |
|-------|:--------:|---------|
| Video source | Yes | YouTube URL, video ID, X (Twitter) post URL, or local file |
| Format | Yes | Study notes, tutorial, full transcript, or meeting notes |
| Timestamps | No | Link each section to its moment in the video (default on) |
| Frames | No | Extract and embed keyframes (default on for slides, code, and UI) |
| Focus | No | Topics to emphasize |
| Skip | No | Segments to ignore |
| Output location | No | Path for the Markdown file |

### Examples

```text
Create a tutorial in Markdown from this video, focusing only on the terminal commands.
Save it to docs/notes/setup.md.
```

```text
Turn ./recordings/team-sync.mp4 into meeting notes. Skip the first five minutes.
No frames.
```

```text
Write study notes from the second video in https://x.com/user/status/1234567890.
```

```text
Make a full transcript with slides from https://youtube.com/watch?v=VIDEO_ID,
grouped by topic, with timestamps.
```

## How It Works

```text
  video + desired format
          │
          v
  ┌──────────────────┐     missing format or source?
  │ 1. Collect       │ ──> ask the user, offer defaults
  └────────┬─────────┘
           v
  ┌──────────────────┐     metadata, captions or Whisper,
  │ 2. Extract       │ ──> keyframes by interval or scene
  └────────┬─────────┘
           v
  ┌──────────────────┐     assemble_draft.py: sections,
  │ 3. Draft         │ ──> frames, raw text, source links
  └────────┬─────────┘
           v
  ┌──────────────────┐     condense into the chosen format
  │ 4. Write         │ ──> using the template in assets/templates/
  └────────┬─────────┘
           v
  ┌──────────────────┐     references/quality/checklist.md,
  │ 5. Review        │ ──> then deliver in the user's language
  └──────────────────┘
```

Each step has a guide in `references/workflow/`, and each format has a guide in `references/formats/`, loaded only when needed.

## Reference

All scripts print JSON (or the requested format) on stdout, errors on stderr, and exit `0` on success. Run them from any folder; the examples assume the repository root. Use `python` instead of `python3` on Windows.

### check_dependencies.py

Reports which tools are present and, with `--install`, installs the missing ones.

```bash
python3 skills/video-to-markdown/scripts/setup/check_dependencies.py --install --with-whisper
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--install` | Off | Install missing Python packages and system tools |
| `--with-whisper` | Off | Also install Whisper (`mlx-whisper` on Apple Silicon, `openai-whisper` elsewhere) |

### download_video.py

Downloads metadata, audio, or video with `yt-dlp`. X post links (`x.com`, `twitter.com`, `fixupx.com`, `fxtwitter.com`) go through the FixupX API instead, and audio is extracted from the MP4 with ffmpeg.

```bash
python3 skills/video-to-markdown/scripts/download/download_video.py "URL" --out ./work --mode metadata
```

| Argument | Default | Description |
|----------|---------|-------------|
| `url` | Required | Video URL, YouTube video ID, or X post URL |
| `--out`, `-o` | `./work` | Output folder |
| `--mode`, `-m` | `metadata` | `metadata` (writes `metadata.json` with chapters), `video` (`video.mp4`), or `audio` (`audio.m4a`) |
| `--height` | `720` | Maximum video height for `--mode video` |
| `--index` | `1` | Which video of an X post with several videos |

Set `FIXUPX_API_BASE` to use another instance of the API (default `https://api.fxtwitter.com`).

### get_transcript.py

Fetches captions, preferring manual captions over auto-generated ones. X posts have no captions to fetch, so an X link always exits with code `2`; transcribe its audio with `transcribe_audio.py`.

```bash
python3 skills/video-to-markdown/scripts/transcript/get_transcript.py "URL" --lang en --format json --out ./work/transcript.json
```

| Argument | Default | Description |
|----------|---------|-------------|
| `video` | Required | Video ID or URL |
| `--lang`, `-l` | `en` | Comma separated language preference, for example `pt,en` |
| `--format`, `-f` | `text` | `text`, `json`, `srt`, or `markdown` (lines that link to the video moment) |
| `--json`, `-j` | Off | Shortcut for `--format json` |
| `--out`, `-o` | stdout | Write to a file |
| `--list` | Off | List the available caption tracks and exit |

Exit code `2` means the video has no captions.

### transcribe_audio.py

Transcribes a local audio or video file with Whisper and writes the same JSON shape.

```bash
python3 skills/video-to-markdown/scripts/transcript/transcribe_audio.py ./work/audio.m4a --out ./work/transcript.json
```

| Argument | Default | Description |
|----------|---------|-------------|
| `media` | Required | Audio or video file |
| `--model` | `base` | `tiny`, `base`, `small`, `medium`, or `large` |
| `--language` | Auto-detect | Spoken language code |
| `--out`, `-o` | stdout | Write to a file |

### extract_frames.py

Extracts timestamped frames and writes `manifest.json` next to them.

```bash
python3 skills/video-to-markdown/scripts/frames/extract_frames.py ./work/video.mp4 --out ./work/frames --mode scene --max 30
```

| Argument | Default | Description |
|----------|---------|-------------|
| `video` | Required | Local video file |
| `--out`, `-o` | `./frames` | Output folder for `frame_0001.jpg`, `frame_0002.jpg`, and so on |
| `--mode` | `interval` | `interval` or `scene` (frames where the picture changes a lot) |
| `--interval`, `-i` | `20` | Seconds between frames in interval mode |
| `--scene-threshold` | `0.3` | Scene change sensitivity from 0 to 1; lower finds more |
| `--max`, `-m` | `30` | Maximum number of frames |
| `--start`, `--end` | `0`, end of video | Time range in seconds |
| `--width` | `1280` | Maximum frame width in pixels |

### assemble_draft.py

Builds the sectioned Markdown draft the agent then rewrites.

```bash
python3 skills/video-to-markdown/scripts/render/assemble_draft.py --transcript ./work/transcript.json --video-id VIDEO_ID --frames ./work/frames/manifest.json --metadata ./work/metadata.json --out ./notes/draft.md
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--transcript` | Required | Transcript JSON |
| `--video-id` | None | YouTube video ID; section headings link to that moment |
| `--source-url` | `webpage_url` from `--metadata` | Source link when there is no YouTube ID, such as an X post |
| `--frames` | None | Frame `manifest.json`; places each frame in its section |
| `--metadata` | None | `metadata.json`; supplies title, channel, duration, and chapters |
| `--window` | `120` | Section length in seconds when the video has no chapters |
| `--frames-dir` | `frames` | Folder name used in image links |
| `--out`, `-o` | stdout | Write to a file |

## Output

```markdown
---
title: "Video Title"
source: "https://www.youtube.com/watch?v=VIDEO_ID"
channel: "Channel"
duration: "12:34"
---

# Video Title

## [00:00](https://youtu.be/VIDEO_ID?t=0) Section title
```

| Format | Structure | Template |
|--------|-----------|----------|
| Study notes | Overview, key points, linked sections, code, terms, resources, open questions | `assets/templates/study-notes.md` |
| Tutorial | Goal, prerequisites, numbered steps, verify, troubleshooting | `assets/templates/tutorial.md` |
| Full transcript | Linked sections of cleaned spoken text with frames | `assets/templates/full-transcript.md` |
| Meeting notes | Summary, attendees, decisions, action items, discussion | `assets/templates/meeting-notes.md` |

Frames are saved as image files in a `frames/` folder next to the Markdown file.

## Troubleshooting

<details>
<summary><strong>The video has no captions</strong></summary>

`get_transcript.py` exits with code `2`. Download the audio with `download_video.py --mode audio` and run `transcribe_audio.py`. Local Whisper is slower and uses CPU or GPU time on your machine.

</details>

<details>
<summary><strong><code>get_transcript.py</code> fails with an <code>AttributeError</code></strong></summary>

An older 0.x release of `youtube-transcript-api` is installed. The script requires 1.x:

```bash
python3 -m pip install --upgrade youtube-transcript-api
```

</details>

<details>
<summary><strong><code>check_dependencies.py</code> asks for a password on Linux</strong></summary>

System packages are installed with `sudo apt-get`, `dnf`, or `pacman`. If you do not want the script to use `sudo`, install `yt-dlp` and `ffmpeg` yourself first; the script skips anything already on `PATH`.

</details>

<details>
<summary><strong>Nothing installs on Windows</strong></summary>

The script uses `winget`. If it is not available, install [ffmpeg](https://ffmpeg.org/download.html) and [yt-dlp](https://github.com/yt-dlp/yt-dlp) manually and make sure both are on `PATH`.

</details>

<details>
<summary><strong>The agent does not see the skill</strong></summary>

Restart the agent session after installing, and confirm the folder is in the path your agent reads (see the table in [Installation](#installation)).

</details>

<details>
<summary><strong>The notes folder is too large</strong></summary>

Frames are saved as image files next to the Markdown. Ask for notes without frames, or limit frames to slides and code.

</details>

## Limitations

- Frames are sampled by interval or scene change, so very short on-screen moments can be missed.
- Local Whisper transcription of long videos can take a significant amount of time.
- Auto-generated captions can misspell names and jargon; the agent corrects what it can verify on screen.
- Only public videos that `yt-dlp`, `youtube-transcript-api`, or the FixupX API can access are supported. Private, deleted, and age-restricted X posts cannot be downloaded.
- X posts are always transcribed locally with Whisper, and their timestamps cannot link to a moment in the post.

## License

No license has been declared for this skill yet. See the [root README](../../README.md#license).
