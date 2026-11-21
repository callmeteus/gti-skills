<div align="center">

# Video Editor

> Measured, local-first video editing for coding agents

**Probe, plan, run, read the checks, review, fix, export. Every edit reports what ffmpeg actually did.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Node](https://img.shields.io/badge/node-%3E%3D20-blue.svg)](#requirements)
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
- [Architecture](#architecture)
- [Security](#security)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Overview

Video Editor is a local editing workflow for agents. The user describes a cut. The agent probes the sources, runs the right measured tool, reads the returned checks, writes a static review page, and only exports when the result is right. Composed edits use a small JSON timeline that becomes one inspectable ffmpeg command. Motion graphics are editable HTML/CSS/SVG compositions rendered locally by seeking, the Art Director way. No generative video API and no cloud service.

```text
  user request
      |
      v
  doctor -> probe -> plan -> run -> read checks -> review -> fix -> export
                  ^                                   |
                  +--------- named change note -------+

  motion: analyze -> compose -> render -> add -> review -> fix
                          ^                         |
                          +----- named change note -+
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Cut, trim silence, change speed, reframe, normalize loudness, caption, export, and render seekable motion graphics with measured checks | Download, transcribe without a local tool, or generate media |
| Show the exact ffmpeg command and the measured result of every step | Hide filter state inside an opaque renderer |
| Write a static HTML review page with a phone safe area and clickable timeline notes | Require a running server to review |
| Keep every request, checks log, and export under `~/.gti/video-editor` | Write generated files into the user's repository |
| Bind the review server to localhost unless explicitly told otherwise | Expose the server on the LAN or Tailscale by default |

## Features

- **Measured edit tools:** `cut`, `trim-silence`, `speed`, `reframe`, `loudness`, `export`, `waveform`, `frame`, `captions`, and every `motion` command, each returning a `checks` array
- **Pre-flight refusal:** unreadable, empty, unsupported, and wrong-kind inputs are refused with a reason before ffmpeg runs
- **Tool contract:** `tools --json` lists every tool with inputs, outputs, and `stable` or `experimental` stability
- **Doctor:** detects ffmpeg, required filters, local transcribers, Playwright, Chromium, and a usable font
- **Honest reframe:** reports cropped pixels, cropped percent, and the exact crop placement
- **Two-pass loudness:** reports measured LUFS, true peak, LRA, and audio/video duration delta
- **Captions:** imports SRT/VTT or transcribes with word timestamps when a local transcriber is installed, burns ASS with word-by-word highlighting and platform safe-area margins, and never assumes English
- **Platform presets:** Reels, Shorts, TikTok, and YouTube with size, fps, codec, and loudness target
- **Motion graphics:** 8 original Motion.md guides, 7 parameterized templates, a brand kit, reference analysis with no AI model, Chromium seek rendering, MP4 or alpha WebM output, and timed overlays
- **Static review page:** inputs, checks from every step, phone-frame preview with UI safe area, and a clickable timeline of clips, captions, motion, and audio that produces a copyable agent instruction
- **Chat-isolated state:** each chat gets its own requests under `~/.gti/video-editor`, with `--permanent` for work that outlives the chat
- **Agent-native CLI:** every command accepts `--json` and returns a stable result envelope

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| Node.js | 20+ | Runs the CLI and review studio (declared in `engines`) | No |
| npm | Bundled with Node | Installs engine dev dependencies and runs scripts | No |
| ffmpeg | Recent release with `silencedetect`, `loudnorm`, `ass`, `showwavespic`, `drawtext` | Measures and renders video | No |
| ffprobe | Bundled with ffmpeg | Reports streams before planning | No |
| Playwright | 1.64.1 | Seeks HTML compositions and captures frames | Yes, by `npm install` |
| Chromium | Matched to Playwright | Renders motion compositions headlessly | No, run `npx playwright install chromium` |
| faster-whisper, whisper.cpp, or whisper | Optional | Word-level transcription when no subtitle file is supplied | No |
| Video Editor package | 0.1.0 | CLI, tools, planner, and review page behind this skill | No, build once |

| Platform | CLI wrapper used by the skill |
|----------|-------------------------------|
| macOS and Linux | `scripts/videoeditor` |
| Windows | `scripts/videoeditor.cmd` |

## Installation

Build the engine once. The skill drives `packages/videoeditor`, so it must be built on the machine that runs the agent:

```bash
cd packages/videoeditor
npm install
npm run build
cd ../..
node packages/cli install --harness claude --skill video-editor
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--scope user` for every project, `--dest <dir>` to choose the project folder, and `--dry-run` to preview.

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

Install ffmpeg with your system package manager (`winget install Gyan.FFmpeg` on Windows, `brew install ffmpeg` on macOS, or your distribution package on Linux). For motion graphics also run `npx playwright install chromium` once inside `packages/videoeditor`. The skill does not install system binaries for you. Run `doctor --json` after installing to confirm the filters, Playwright, and Chromium are present.

> **Keep the package in place.** The installer writes the absolute path of `packages/videoeditor` to `scripts/videoeditor.root` inside the installed skill. If you move the repository, run `install` again, or set `VIDEOEDITOR_HOME` to the package folder.

To copy by hand, put the `skills/video-editor` folder in your agent's folder and set `VIDEOEDITOR_HOME`. Each agent has a guide in `skills/video-editor/harnesses/<id>/GUIDE.md`.

## Quick Start

With the skill installed, start a new agent session and ask:

```text
Cut this interview to 30 seconds, add captions in the reels style, and export for Reels.
```

The agent checks tools, probes the source, runs the measured edits, writes a static review page, and hands over the export path and the checks.

## Usage

### Input

| Input | Required | Example |
|-------|:--------:|---------|
| Edit request | Yes | "Trim the intro to 4 seconds and join it to the demo" |
| Media files | Yes | Local paths, or files copied into the request `media/` folder |
| Subtitle file | No | An SRT or VTT file, otherwise a local transcriber is used |
| Reference video | No | For motion graphics, a clip to analyze with `motion analyze` |
| Brand kit | No | A `brand.json` for motion compositions |
| Canvas and format | No | Defaults to 1920x1080 at 30 fps, MP4 final |
| Platform | No | reels, shorts, tiktok, or youtube |
| Destination | No | Defaults to `scope.exportsDir` |

### Examples

```text
Join these clips in order, fade between them, and export MP4.
```

```text
Reframe this to 9:16 and tell me how much of the frame was cut.
```

```text
Burn these captions for TikTok and keep them above the UI.
```

```text
Analyze this reference, build a lower third with our brand kit, and export it for Reels.
```

Drive the CLI by hand from the repository root:

```bash
node packages/videoeditor/dist/bin/videoeditor.js doctor --json
node packages/videoeditor/dist/bin/videoeditor.js probe --source clip.mp4 --json
node packages/videoeditor/dist/bin/videoeditor.js cut --source clip.mp4 --start 0.5 --end 2 --json
node packages/videoeditor/dist/bin/videoeditor.js reframe --source clip.mp4 --aspect 9:16 --json
node packages/videoeditor/dist/bin/videoeditor.js motion new --template lower-third --text "Ada Lovelace" --preset reels --json
node packages/videoeditor/dist/bin/videoeditor.js motion render --preset reels --duration 1 --json
node packages/videoeditor/dist/bin/videoeditor.js review --out review.html --json
```

A full sample with no ffmpeg needed:

```bash
node packages/videoeditor/dist/bin/videoeditor.js demo --out ./video-editor-demo --json
```

## How It Works

```text
doctor -> probe -> plan -> run -> read checks -> review -> fix -> export
                    |        |         |
                    |        |         +-- checks.json in the request state
                    |        +------------ deterministic ffmpeg argv
                    +--------------------- validated source capabilities
```

1. `doctor` checks tools, filters, transcribers, Playwright, Chromium, and fonts.
2. `probe` refuses bad inputs, then reports streams and duration.
3. `plan` produces one command for composed edits, or a measured tool handles a single operation.
4. The tool runs ffmpeg and measures the output.
5. The checks are read. A failing check means fix and rerun once, never ignore.
6. `review --out` writes a standalone page with inputs, checks, phone preview, and a clickable timeline.
7. A note on the page becomes a copyable instruction for the next fix.
8. `export --preset` applies size, fps, codec, and loudness target with its own checks.
9. For motion graphics the loop is `motion analyze`, `motion styles`, `motion new`, `motion render`, `motion add`, then `review --out`. Each step prints measured checks.

## Reference

```bash
videoeditor <command> [flags] [--json]
```

Agents use the wrapper in the installed skill (`scripts/videoeditor` on macOS and Linux, `scripts/videoeditor.cmd` on Windows). Every command accepts `--json`, and most accept `--session`, `--request`, `--root`, and `--permanent`. Full flags, fields, and error codes are in [references/workflow/commands.md](references/workflow/commands.md). The timeline schema is in [references/workflow/spec.md](references/workflow/spec.md).

### Detect and contract

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `doctor` | Check ffmpeg, filters, transcribers, Playwright, Chromium, and fonts | |
| `tools` | List tools with inputs, outputs, and stability | |
| `status` | Tool availability, active request, paths, and renders | |
| `help` | Show the command list | |

### Edit and measure

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `probe` | Refuse bad inputs, then report streams | `--source`, `--all` |
| `cut` | Cut between two times and measure the result | `--source`, `--start`, `--end` |
| `trim-silence` | Detect and remove silent ranges | `--source`, `--noise`, `--min` |
| `speed` | Change playback speed and warn outside 0.5x to 2x | `--source`, `--rate` |
| `reframe` | Crop to an aspect and report what left the frame | `--source`, `--aspect`, `--preset` |
| `loudness` | Two-pass loudnorm with measured LUFS and A/V delta | `--source`, `--target` |
| `export` | Apply a platform preset | `--source`, `--preset` |
| `waveform` | Waveform PNG around a cut point | `--source`, `--at`, `--window` |
| `frame` | Frame PNG, optionally side by side | `--source`, `--at`, `--compare-at` |
| `captions` | Import or transcribe, then burn styled ASS captions | `--source`, `--srt`, `--vtt`, `--language`, `--style`, `--preset`, `--safe` |

### Motion graphics (experimental)

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `motion styles` | List the starter Motion.md guides | |
| `motion new` | Write an editable composition from a template and brand kit | `--template`, `--brand`, `--text`, `--title`, `--accent`, `--preset`, `--size`, `--fps`, `--duration` |
| `motion render` | Seek a composition in Chromium and encode it | `--source`, `--preset`, `--size`, `--fps`, `--duration`, `--alpha`, `--out` |
| `motion analyze` | Measure cuts, pacing, palette, and keyframes from a reference | `--source` |
| `motion add` | Add a rendered motion clip as a clip or timed overlay | `--source`, `--as`, `--at`, `--duration` |

Deep guides: [composition contract](references/motion/composition-contract.md), [style guides and brand kit](references/motion/style-and-brand.md), [analyze, compose, render, review](references/motion/analyze-compose-render.md), and [quality checks](references/motion/quality.md).

### Timeline, review, and state

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `plan` | Print the ffmpeg command without rendering | `--spec`, `--format` |
| `render` | Run the plan and write a video | `--spec`, `--format`, `--out` |
| `review` | Write the static HTML review page | `--out` |
| `studio` | Start or reuse the local review server | `--open`, `--port`, `--bind` |
| `init` | Create a request or return the current one | `--name`, `--new`, `--permanent` |
| `scene add` / `music add` | Extend the timeline | `--source`, `--duration` and others |
| `history` / `resume` / `demo` | List requests, summarize, or write a sample | `--out` |

Feature guides: [cut and speed](references/workflow/cut-and-speed.md), [reframe](references/workflow/reframe.md), [audio and loudness](references/workflow/audio-loudness.md), [captions](references/workflow/captions.md), [export presets](references/workflow/export-presets.md), and [review](references/workflow/review.md).

### Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `GTI_HOME` | `~/.gti` | Root of all generated state |
| `VIDEOEDITOR_SESSION` | unset | Chat id when the agent exposes none |
| `VIDEOEDITOR_STORAGE` | unset | Set to `repository` to make requests permanent |
| `VIDEOEDITOR_PORT` | `4870` | Preferred studio port |
| `VIDEOEDITOR_JSON` | unset | Set to `1` to force JSON output |
| `VIDEOEDITOR_HOME` | unset | Package folder for a by hand install |
| `VIDEOEDITOR_BIN` | unset | Explicit built CLI path |

## Output

A measured edit returns a JSON envelope with the path and the checks array:

```json
{
  "ok": true,
  "command": "reframe",
  "summary": "Reframed to 9:16; removed 68.438% of the frame.",
  "data": {
    "path": ".../exports/reframe.mp4",
    "croppedPixels": 157680,
    "croppedPercent": 68.438,
    "checks": [
      { "name": "cropped pixels", "ok": true, "measured": 157680 },
      { "name": "placement", "ok": true, "measured": "center x=219 y=0" }
    ]
  }
}
```

The request folder contains:

| Path | Contents |
|------|----------|
| `project.json` | Request name, phase, workspace, and last render path |
| `timeline.json` | The editable timeline |
| `checks.json` | Checks and inputs from every step, used by the review page |
| `captions.ass` / `captions.json` | Generated ASS and caption metadata |
| `preset.json` | The last export preset |
| `media/` | Optional copies of source media |
| `exports/` | Rendered videos, images, and `review.html` |

## Architecture

| Path | Responsibility |
|------|----------------|
| `SKILL.md` | Agent instructions, measure loop, and rules |
| `scripts/videoeditor.mjs` | Wrapper that resolves and runs the local engine |
| `references/workflow/` | One guide per feature area plus commands and schema |
| `references/quality/` | Render check and ffmpeg notes |
| `assets/templates/timeline.json` | Starter timeline |
| `tests/wrapper.test.mjs` | Wrapper and manifest checks |
| `harnesses/<agent>/GUIDE.md` | Generated per agent install and verify notes |

The engine design is documented in [packages/videoeditor/ARCHITECTURE.md](../../packages/videoeditor/ARCHITECTURE.md).

## Security

- The engine validates every input before running ffmpeg. Refusals include the reason.
- The review server binds to `127.0.0.1` by default. Do not pass `--bind 0.0.0.0` unless the user asks for LAN or Tailscale access. Treat its token URL as a secret.
- `/media/` on the server is confined to `exports/`. The static review page reads only files the user opens locally.
- No media, tokens, or telemetry leave the machine. The skill never uploads a render.

## Development

| Command | Action |
|---------|--------|
| `node packages/cli validate` | Validate every skill against the standard |
| `node packages/cli build` | Regenerate harness guides and validate |
| `node packages/cli check` | Fail when generated files are stale |
| `npm test` | Run CLI, skill, and Python test suites; engine tests run in `packages/videoeditor` |

## Troubleshooting

<details>
<summary><strong>doctor reports a missing filter or transcriber</strong></summary>

The engine does not install system binaries or ML packages. Install ffmpeg with your platform package manager, or install `faster-whisper` or whisper.cpp if you want transcription. Without a transcriber, import an SRT or VTT file with `--srt` or `--vtt`.

</details>

<details>
<summary><strong>A command refuses a source before ffmpeg runs</strong></summary>

Read the `INPUT` reason. The file may be empty, unreadable, an unsupported extension, or the wrong kind for the tool. Use `probe --source <path> --json` to see what the engine can read, and copy media into `scope.mediaDir` when paths are unstable.

</details>

<details>
<summary><strong>The wrapper cannot find the CLI</strong></summary>

Build the engine with `npm install` and `npm run build` in `packages/videoeditor`. If you copied the skill folder by hand, set `VIDEOEDITOR_HOME` to that folder or reinstall with `node packages/cli install`.

</details>

<details>
<summary><strong>loudness fails on a synthetic audio track</strong></summary>

The engine replaces non-finite loudnorm measurements with safe defaults. If it still fails, inspect the source with `probe --source <path> --json` to confirm it really has an audio stream.

</details>

<details>
<summary><strong>The studio URL does not open from another device</strong></summary>

The default bind is local only. The user must ask for LAN or Tailscale access, then start the server with `--bind 0.0.0.0` and use one of the `tailscaleUrls` from `studio --json`. Do not replace the host with `localhost` on the other device. For a no-server option use `review --out`.

</details>

## Limitations

- The timeline supports one sequential track plus timed motion overlays, not layers, picture in picture, or keyframe animation.
- Motion compositions are 2D and seek based; there is no generative video, 3D animation, or cloud rendering.
- No subtitle import beyond SRT/VTT, no color grading, and no LUTs.
- Transcription requires a locally installed transcriber; English is never assumed, but accuracy depends on the tool and model.
- Imported SRT/VTT word highlights are estimated from cue duration, not spoken timing.
- Text uses the first existing common system font, or the ffmpeg default; set `--style` and a font file in the spec for exact typography.
- The static review page shows files by local path; it is not a hosted review link.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [kajisho5/ffmpeg-skill](https://github.com/kajisho5/ffmpeg-skill) | MIT | Tool contract and measured edit-loop ideas, reimplemented in original code |
| [kajisho5/subtitle-skill](https://github.com/kajisho5/subtitle-skill) | MIT | Caption ideas; SRT/VTT parsing and ASS burning are original code |
| [nexu-io/openmotion](https://github.com/nexu-io/openmotion) | Apache-2.0 | Motion.md style guides, brand kit, reference breakdown, and verified HTML-to-video export ideas; the renderer, templates, guides, and analyzer here are original code |
| ffmpeg, ffprobe, and Playwright with Chromium | LGPL/GPL builds and Apache-2.0 | Local measurement, encoding, and deterministic frame capture |

The captions repo linked to X user `pratyushrungta` could not be found. The search record and full credits are in [packages/videoeditor/NOTICE.md](../../packages/videoeditor/NOTICE.md).

## License

No license has been declared for this skill yet. See the [repository license section](../../README.md#license) for details.
