<div align="center">

# Video to Skill

> Turn a tutorial video into a working agent skill

**Generates a complete, validated skill folder from a YouTube or X video by cross-referencing the transcript with keyframes of the code, terminals, and UI shown on screen.**

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

Tutorial videos show the real workflow: commands typed in a terminal, files opened in an editor, settings clicked in a UI. Much of that never reaches the spoken audio, so a transcript alone produces incomplete instructions.

Video to Skill reads both channels, resolves conflicts in favor of what is shown on screen, and synthesizes the result into a skill folder that another agent can follow without watching the video. The skill is scaffolded with the standard subfolders and checked by a validator before delivery.

```text
  YouTube URL, X post, or local file + skill context
          │
          ├──> download_video.py ──> metadata and chapters
          ├──> get_transcript.py ──> timestamped transcript (Whisper without captions)
          ├──> extract_frames.py ──> timestamped keyframes (code, UI, file trees)
          │
          v
  agent cross-checks audio against visuals
          │
          v
  scaffold_skill.py ──> <skill-name>/SKILL.md, references/, scripts/, assets/
          │
          v
  validate_skill.py ──> errors fixed, then delivered
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Collect the context needed to write a useful skill | Start from a bare URL. It asks for name, purpose, and triggers first. |
| Extract metadata, a timestamped transcript, and keyframes | Install the generated skill into your agent |
| Scaffold and fill a skill with `references/`, `scripts/`, and `assets/` | Download private, members-only, or region-locked videos |
| Validate the result against the Agent Skills standard | Copy the transcript verbatim into the skill |

## Features

- **Multimodal analysis:** combines captions with frames of code, terminals, file trees, and configuration screens
- **Visual-first accuracy:** commands and paths shown on screen take priority over what is spoken
- **Smart frames:** extracts by fixed interval or by scene change, with the time of every frame in a manifest
- **Caption fallback:** transcribes locally with Whisper when a video has no captions
- **X (Twitter) posts:** downloads post videos through the FixupX (FxTwitter) API, with no account or API key
- **Standard layout:** scaffolds the skill with progressive-disclosure subfolders
- **Built-in validator:** checks name, description, length, links, and the language Core Rule
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
node packages/cli install --harness claude --skill video-to-skill
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

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/video-to-skill` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/video-to-skill .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\video-to-skill .claude\skills\
```

Each agent has a short guide in `skills/video-to-skill/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

Optionally install the dependencies ahead of time (use `python` instead of `python3` on Windows):

```bash
python3 skills/video-to-skill/scripts/setup/check_dependencies.py --install
```

## Quick Start

Start a new agent session and describe the skill you want, including the video:

```text
Create a skill called "deploy-to-vercel" from https://youtube.com/watch?v=VIDEO_ID.
It should deploy a Next.js app to Vercel from the CLI. Use it when the user asks
to deploy or redeploy to Vercel. Target: Claude Code.
```

The agent extracts the transcript and frames, scaffolds `deploy-to-vercel/`, writes the skill, and runs the validator.

## Usage

### Required input

The agent stops and asks for anything missing from this table.

| Input | Example |
|-------|---------|
| Video source | YouTube URL, video ID, X (Twitter) post URL, or local video file |
| Skill name | `deploy-to-vercel` (kebab-case) |
| Purpose | What the skill does and what problem it solves |
| Triggers | The requests that should activate it |
| Target agent | Claude Code, Cursor, OpenCode, or any |

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

```text
Turn https://x.com/user/status/1234567890 into a skill "quick-git-bisect" that
runs when the user wants to find the commit that introduced a bug.
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
  ┌──────────────────┐     metadata, captions or Whisper,
  │ 2. Extract       │ ──> keyframes by interval or scene
  └────────┬─────────┘
           v
  ┌──────────────────┐     steps, commands, files,
  │ 3. Analyze       │ ──> gotchas, decision points
  └────────┬─────────┘
           v
  ┌──────────────────┐     scaffold_skill.py, then fill in
  │ 4. Write         │ ──> SKILL.md, references/, scripts/
  └────────┬─────────┘
           v
  ┌──────────────────┐     validate_skill.py until ok,
  │ 5. Validate      │ ──> then deliver in the user's language
  └──────────────────┘
```

Each step has a guide in `references/workflow/`, loaded only when the agent reaches it.

## Reference

All scripts print JSON (or the requested format) on stdout, errors on stderr, and exit `0` on success. Run them from any folder; the examples assume the repository root. Use `python` instead of `python3` on Windows.

### check_dependencies.py

Reports which tools are present and, with `--install`, installs the missing ones.

```bash
python3 skills/video-to-skill/scripts/setup/check_dependencies.py --install --with-whisper
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--install` | Off | Install missing Python packages and system tools |
| `--with-whisper` | Off | Also install Whisper (`mlx-whisper` on Apple Silicon, `openai-whisper` elsewhere) |

### download_video.py

Downloads metadata, audio, or video with `yt-dlp`. X post links (`x.com`, `twitter.com`, `fixupx.com`, `fxtwitter.com`) go through the FixupX API instead, and audio is extracted from the MP4 with ffmpeg.

```bash
python3 skills/video-to-skill/scripts/download/download_video.py "URL" --out ./work --mode metadata
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
python3 skills/video-to-skill/scripts/transcript/get_transcript.py "URL" --lang pt,en --format json --out ./work/transcript.json
```

| Argument | Default | Description |
|----------|---------|-------------|
| `video` | Required | Video ID or URL |
| `--lang`, `-l` | `en` | Comma separated language preference |
| `--format`, `-f` | `text` | `text`, `json`, `srt`, or `markdown` (lines that link to the video moment) |
| `--json`, `-j` | Off | Shortcut for `--format json` |
| `--out`, `-o` | stdout | Write to a file |
| `--list` | Off | List the available caption tracks and exit |

Exit code `2` means the video has no captions.

### transcribe_audio.py

Transcribes a local audio or video file with Whisper and writes the same JSON shape.

```bash
python3 skills/video-to-skill/scripts/transcript/transcribe_audio.py ./work/audio.m4a --out ./work/transcript.json
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
python3 skills/video-to-skill/scripts/frames/extract_frames.py ./work/video.mp4 --out ./work/frames --mode scene --max 40
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

### scaffold_skill.py

Creates the new skill folder from `assets/templates/SKILL.template.md`.

```bash
python3 skills/video-to-skill/scripts/scaffold/scaffold_skill.py deploy-to-vercel -d "Deploys apps. Use when the user wants to deploy." -o ./skills
```

| Argument | Default | Description |
|----------|---------|-------------|
| `name` | Required | Skill name in kebab-case |
| `--description`, `-d` | Required | What the skill does and when to use it |
| `--out`, `-o` | `.` | Folder that will contain the skill |

### validate_skill.py

Checks a skill folder and exits `1` when there are errors.

```bash
python3 skills/video-to-skill/scripts/validate/validate_skill.py ./skills/deploy-to-vercel
```

| Argument | Default | Description |
|----------|---------|-------------|
| `path` | Required | Skill folder or `SKILL.md` |

It checks the name, description length, body length, the language Core Rule, relative links, and dash characters.

## Output

A skill folder in English, with the standard subfolders:

```text
deploy-to-vercel/
├── SKILL.md          # Frontmatter, Core Rule, triggers, steps
├── references/       # Detail the agent reads on demand
├── scripts/          # Helpers the agent runs
└── assets/           # Templates and examples
```

| Section of `SKILL.md` | Contents |
|-----------------------|----------|
| Frontmatter | `name` equal to the folder, and a `description` with triggers |
| Core Rule | The language rule required in this repository |
| When to use | Specific trigger conditions and one exclusion |
| Prerequisites | What must be installed or configured |
| Instructions | Ordered, actionable steps with the exact commands from the video |
| Examples and Notes | Usage samples, gotchas, and tips mentioned in the video |

A complete example is in `assets/examples/deploy-to-vercel/EXAMPLE-SKILL.md`.

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

Restart the agent session after installing, and confirm the folder is in the path your agent reads (see the table in [Installation](#installation)). `node packages/cli install --dry-run` prints the exact folder.

</details>

<details>
<summary><strong>The generated skill reads like a transcript</strong></summary>

The context given was too vague. The skill writes instructions for what you say it should do, so describe the purpose and triggers in more detail.

</details>

## Limitations

- Frames are sampled by interval or scene change, so very short on-screen moments can be missed. Lower `--interval` or `--scene-threshold` for fast-paced videos.
- Local Whisper transcription of long videos can take a significant amount of time.
- Only public videos that `yt-dlp`, `youtube-transcript-api`, or the FixupX API can access are supported. Private, deleted, and age-restricted X posts cannot be downloaded.
- X posts are always transcribed locally with Whisper, and their timestamps cannot link to a moment in the post.

## License

No license has been declared for this skill yet. See the [root README](../../README.md#license).
