<div align="center">

# Video to Markdown

> Turn any talk or tutorial into notes you can search, skim, and keep

**Converts a YouTube or local video into structured Markdown with timestamps, inline keyframes, and every command and code snippet extracted.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Python](https://img.shields.io/badge/python-3.8%2B-blue.svg)](#requirements)
[![Harnesses](https://img.shields.io/badge/harness-Claude%20Code%20%7C%20OpenCode%20%7C%20Cursor-8A63D2.svg)](#installation)
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

Video to Markdown extracts the transcript, samples frames where slides, code, diagrams, or UI appear, and organizes everything into scannable Markdown with links back to the exact moment in the video.

```text
  video URL or file + desired output
          │
          ├──> youtube-transcript-api ─────────> timestamped transcript
          │    (yt-dlp + Whisper without captions)
          │
          ├──> yt-dlp + ffmpeg ────────────────> keyframes (slides, code, diagrams)
          │
          v
  agent organizes content into sections
          │
          v
  notes.md  (overview, key points, timestamped content, code, resources)
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Ask what kind of document you want before extracting anything | Dump a raw transcript |
| Extract a timestamped transcript and keyframes | Publish or upload the result |
| Write Markdown with frontmatter, sections, code blocks, and source link | Download private, members-only, or region-locked videos |
| Install its own dependencies on first use | Summarize content it cannot see or hear |

## Features

- **Transcript extraction:** full or summarized, with timestamps when available
- **Visual context:** keyframes of slides, code, diagrams, and UI placed inline where they add information
- **Timestamp links:** jump from any section back to the moment in the video
- **Code extraction:** commands and snippets pulled into fenced blocks
- **Focus and skip:** emphasize specific topics or ignore segments such as intros and sponsors
- **Caption fallback:** transcribes locally with Whisper when a video has no captions
- **Self-installing:** `dependencies.py` detects the platform and installs missing tools

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| Python | 3.8+ | Runs the dependency installer and transcript API | No |
| [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api) | 1.x | Fetches YouTube captions | Yes |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Latest | Downloads videos and metadata | Yes |
| [ffmpeg](https://ffmpeg.org/) | Any recent | Extracts frames | Yes |
| [openai-whisper](https://github.com/openai/whisper) or [mlx-whisper](https://github.com/ml-explore/mlx-examples/tree/main/whisper) | Latest | Transcribes videos without captions | Yes |

| Platform | System package manager used |
|----------|-----------------------------|
| macOS | Homebrew (must already be installed) |
| Linux | `apt`, `dnf`, or `pacman` (uses `sudo`) |
| Windows | `winget`, then `choco` |

## Installation

Copy the folder into the skills directory of your harness.

macOS and Linux:

```bash
cp -r skills/video-to-markdown ~/.claude/skills/
```

Windows (PowerShell):

```powershell
Copy-Item -Recurse skills\video-to-markdown "$env:USERPROFILE\.claude\skills\"
```

For OpenCode, Cursor, and project-scoped paths, see the [installation table](../../README.md#installation) in the root README.

Optionally install the dependencies ahead of time:

```bash
python ~/.claude/skills/video-to-markdown/scripts/dependencies.py
```

## Quick Start

Start a new agent session and ask:

```text
Convert https://youtube.com/watch?v=VIDEO_ID into study notes with timestamps and frames.
```

The agent confirms the output format, extracts the transcript and frames, and writes the Markdown file.

## Usage

### Input

If a required input is missing, the agent asks before starting.

| Input | Required | Example |
|-------|:--------:|---------|
| Video source | Yes | YouTube URL, video ID, or local file |
| Output purpose | Yes | Study notes, tutorial summary, full transcript with visuals |
| Target structure | Yes | Specific sections, or "use the default" |
| Timestamps | No | Link each section to its moment in the video |
| Frames | No | Extract and embed keyframes |
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
Make a full transcript with slides from https://youtube.com/watch?v=VIDEO_ID,
grouped by topic, with timestamps.
```

## How It Works

```text
  video + desired output
          │
          v
  ┌──────────────────┐     missing purpose or
  │ 1. Collect       │ ──> structure? ask the user
  └────────┬─────────┘
           v
  ┌──────────────────┐     youtube-transcript-api, or
  │ 2. Transcript    │ ──> yt-dlp + Whisper without captions
  └────────┬─────────┘
           v
  ┌──────────────────┐     every 15-30 seconds or on scene changes,
  │ 3. Keyframes     │ ──> prioritizing slides, code, diagrams, UI
  └────────┬─────────┘
           v
  ┌──────────────────┐
  │ 4. Markdown      │ ──> sections, inline frames, code blocks, links
  └──────────────────┘
```

## Reference

### dependencies.py

Detects the platform and installs missing Python packages (`youtube-transcript-api`, `requests`), system tools (`yt-dlp`, `ffmpeg`), and the right Whisper build (`mlx-whisper` on Apple Silicon, `openai-whisper` elsewhere). Takes no arguments.

```bash
python scripts/dependencies.py
```

### Extraction tools

The agent runs transcript and frame extraction directly with the tools in [Requirements](#requirements). For standalone extraction scripts, see `get_transcript.py` and `extract_frames.py` in the [Video to Skill reference](../video-to-skill/README.md#reference).

## Output

```markdown
---
title: "Video Title"
source: "https://youtube.com/watch?v=VIDEO_ID"
duration: "12:34"
date: "YYYY-MM-DD"
---

# Video Title

## Overview
## Key Points
## Content
## Code/Commands
## Resources
## Notes
```

| Section | Contents |
|---------|----------|
| Frontmatter | Title, source URL, duration, and date |
| Overview | A short summary of the video |
| Key Points | The main takeaways |
| Content | Timestamped sections with frames inline where they add information |
| Code/Commands | Every command and snippet shown or spoken, in fenced blocks |
| Resources | Links mentioned in the video |
| Notes | Additional context and caveats |

## Troubleshooting

<details>
<summary><strong>The video has no captions</strong></summary>

The agent downloads the audio with `yt-dlp` and transcribes it locally with Whisper. Long videos take a while and use CPU or GPU time on your machine.

</details>

<details>
<summary><strong><code>dependencies.py</code> asks for a password on Linux</strong></summary>

System packages are installed with `sudo apt`, `sudo dnf`, or `sudo pacman`. If you do not want the script to use `sudo`, install `yt-dlp` and `ffmpeg` yourself first; the script skips anything already on `PATH`.

</details>

<details>
<summary><strong>Nothing installs on Windows</strong></summary>

The script tries `winget`, then `choco`. If neither is available, install [ffmpeg](https://ffmpeg.org/download.html) and [yt-dlp](https://github.com/yt-dlp/yt-dlp) manually and make sure both are on `PATH`.

</details>

<details>
<summary><strong>Homebrew not found on macOS</strong></summary>

The script uses Homebrew for system tools. Install [Homebrew](https://brew.sh) and rerun `dependencies.py`, or install `ffmpeg` and `yt-dlp` another way.

</details>

<details>
<summary><strong>The notes folder is too large</strong></summary>

Frames are saved as image files next to the Markdown. Ask for notes without frames, or limit frames to slides and code.

</details>

## Limitations

- Frames are sampled at intervals, so very short on-screen moments can be missed.
- Local Whisper transcription of long videos can take a significant amount of time.
- Only public videos that `yt-dlp` and `youtube-transcript-api` can access are supported.

## License

No license has been declared for this skill yet. See the [root README](../../README.md#license).
