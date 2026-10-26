<div align="center">

# Video to Skill

> Turn a tutorial video into a working agent skill

**Generates a complete, ready-to-use `SKILL.md` from a YouTube video by cross-referencing the transcript with keyframes of the code, terminals, and UI shown on screen.**

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

Tutorial videos show the real workflow: commands typed in a terminal, files opened in an editor, settings clicked in a UI. Much of that never reaches the spoken audio, so a transcript alone produces incomplete instructions.

Video to Skill reads both channels, resolves conflicts in favor of what is shown on screen, and synthesizes the result into an actionable `SKILL.md` that another agent can follow without watching the video.

```text
  YouTube URL + skill context
          │
          ├──> get_transcript.py ──────────────> timestamped transcript
          │
          ├──> yt-dlp + extract_frames.py ─────> keyframes (code, UI, file trees)
          │
          v
  agent cross-checks audio against visuals
          │
          v
  <skill-name>/SKILL.md  (English, with the language Core Rule)
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Collect the context needed to write a useful skill | Start from a bare URL. It asks for name, purpose, and triggers first. |
| Extract a timestamped transcript and keyframes | Install the generated skill into your harness |
| Write `SKILL.md` with frontmatter, triggers, steps, examples, and notes | Download private, members-only, or region-locked videos |
| Install its own dependencies on first use | Copy the transcript verbatim into the skill |

## Features

- **Multimodal analysis:** combines captions with frames of code, terminals, file trees, and configuration screens
- **Visual-first accuracy:** commands and paths shown on screen take priority over what is spoken
- **Caption fallback:** transcribes locally with Whisper when a video has no captions
- **Context gathering:** refuses to guess and asks for the skill identity and triggers it needs
- **Repository compliant:** every generated skill is in English and includes the language Core Rule
- **Self-installing:** `dependencies.py` detects the platform and installs missing tools

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| Python | 3.8+ | Runs the helper scripts | No |
| [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api) | 1.x | Fetches YouTube captions | Yes |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Latest | Downloads video for frames or transcription | Yes |
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
cp -r skills/video-to-skill ~/.claude/skills/
```

Windows (PowerShell):

```powershell
Copy-Item -Recurse skills\video-to-skill "$env:USERPROFILE\.claude\skills\"
```

For OpenCode, Cursor, and project-scoped paths, see the [installation table](../../README.md#installation) in the root README.

Optionally install the dependencies ahead of time:

```bash
python ~/.claude/skills/video-to-skill/scripts/dependencies.py
```

## Quick Start

Start a new agent session and describe the skill you want, including the video:

```text
Create a skill called "deploy-to-vercel" from https://youtube.com/watch?v=VIDEO_ID.
It should deploy a Next.js app to Vercel from the CLI. Use it when the user asks
to deploy or redeploy to Vercel. Target: Claude Code.
```

The agent fetches the transcript, samples frames, and writes `deploy-to-vercel/SKILL.md`.

## Usage

### Required input

The agent stops and asks for anything missing from this table.

| Input | Example |
|-------|---------|
| Video source | YouTube URL, video ID, or local video file |
| Skill name | `deploy-to-vercel` (kebab-case) |
| Purpose | What the skill does and what problem it solves |
| When to use | The requests that should trigger it |
| Target agent | Claude Code, OpenCode, or general use |

### Optional input

| Input | Why it helps |
|-------|--------------|
| Desired sections | Forces a specific structure in the output |
| Tools and commands | Guarantees the right CLIs or APIs are included |
| File outputs | Tells the skill which files it should create or edit |
| Constraints | Things the generated skill must never do |
| Reference skills | Existing `SKILL.md` files to match in style |

### Examples

```text
Make a skill from this video about setting up Docker Compose for Postgres.
Name it "compose-postgres". Trigger it when the user wants a local Postgres
database. It must never touch production hosts.
```

```text
Use ./recordings/onboarding.mp4 to create a skill "repo-onboarding" for OpenCode.
Match the style of skills/video-to-markdown/SKILL.md.
```

## How It Works

```text
  video + skill context
          │
          v
  ┌──────────────────┐     missing name, purpose,
  │ 1. Collect       │ ──> or triggers? ask the user
  └────────┬─────────┘
           v
  ┌──────────────────┐     get_transcript.py
  │ 2. Extract       │ ──> yt-dlp + extract_frames.py
  └────────┬─────────┘     Whisper when there are no captions
           v
  ┌──────────────────┐     steps, commands, files,
  │ 3. Analyze       │ ──> gotchas, decision points
  └────────┬─────────┘
           v
  ┌──────────────────┐
  │ 4. Generate      │ ──> <skill-name>/SKILL.md
  └────────┬─────────┘
           v
  ┌──────────────────┐     frontmatter, Core Rule,
  │ 5. Review        │ ──> actionable steps, kebab-case name
  └──────────────────┘
```

## Reference

All scripts exit with code `0` on success and `1` on failure, printing errors to stderr.

### dependencies.py

Detects the platform and installs missing Python packages (`youtube-transcript-api`, `requests`), system tools (`yt-dlp`, `ffmpeg`), and the right Whisper build (`mlx-whisper` on Apple Silicon, `openai-whisper` elsewhere). Takes no arguments.

```bash
python scripts/dependencies.py
```

### get_transcript.py

Fetches a YouTube transcript as plain text or JSON with timestamps.

```bash
python scripts/get_transcript.py VIDEO_ID --lang en --json
```

| Argument | Default | Description |
|----------|---------|-------------|
| `video_id` | Required | YouTube video ID (the `v=` value of the URL) |
| `--lang`, `-l` | `en` | Preferred transcript language, falls back to English |
| `--json`, `-j` | Off | Print `text`, `timestamped` entries, and `language` as JSON |

### extract_frames.py

Samples frames from a local video file at a fixed interval.

```bash
yt-dlp -f mp4 -o video.mp4 "https://youtube.com/watch?v=VIDEO_ID"
python scripts/extract_frames.py video.mp4 --output ./frames --interval 20 --max 30
```

| Argument | Default | Description |
|----------|---------|-------------|
| `video` | Required | Path to a local video file |
| `--output`, `-o` | `./frames` | Directory for `frame_001.jpg`, `frame_002.jpg`, and so on |
| `--interval`, `-i` | `20` | Seconds between frames |
| `--max`, `-m` | `30` | Maximum number of frames |

## Output

A single `SKILL.md` written in English:

```markdown
---
name: deploy-to-vercel
description: >-
  Deploy a Next.js app to Vercel from the CLI. Use when the user asks to
  deploy, redeploy, or promote a preview to production on Vercel.
---

# deploy-to-vercel

## Core Rule
Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## When to use
## Prerequisites
## Instructions
## Tools
## Examples
## Notes
```

| Section | Contents |
|---------|----------|
| Frontmatter | `name` and a `description` with concrete triggers |
| Core Rule | The language rule required in this repository |
| When to use | Specific trigger conditions |
| Prerequisites and Tools | What must be installed or configured |
| Instructions | Ordered, actionable steps with the exact commands from the video |
| Examples and Notes | Usage samples, gotchas, and tips mentioned in the video |

## Troubleshooting

<details>
<summary><strong>The video has no captions</strong></summary>

The agent downloads the audio with `yt-dlp` and transcribes it locally with Whisper. This is slower than fetching captions and uses CPU or GPU time on your machine.

</details>

<details>
<summary><strong><code>get_transcript.py</code> fails with an <code>AttributeError</code></strong></summary>

An older 0.x release of `youtube-transcript-api` is installed. The script requires 1.x:

```bash
python -m pip install --upgrade youtube-transcript-api
```

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
<summary><strong>The generated skill reads like a transcript</strong></summary>

The context given was too vague. The skill writes instructions for what you say it should do, so describe the purpose and triggers in more detail.

</details>

## Limitations

- Frames are sampled at a fixed interval, so very short on-screen moments can be missed. Lower `--interval` for fast-paced videos.
- Local Whisper transcription of long videos can take a significant amount of time.
- Only public videos that `yt-dlp` and `youtube-transcript-api` can access are supported.

## License

No license has been declared for this skill yet. See the [root README](../../README.md#license).
