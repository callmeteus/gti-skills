---
name: video-editor
description: >-
  Local-first, measured video editing with ffmpeg: cut, trim silence, change
  speed, reframe, normalize loudness, caption, export for Reels, Shorts, TikTok,
  or YouTube, and review in a static page. Use when the user asks to edit, cut,
  trim, join, caption, add text or music to, reframe, reformat, loudness-match,
  or export a video, or mentions Video Editor, videoeditor, ffmpeg timeline, or
  a review page. Do not use for downloading or transcribing videos without
  captions (Video to Skill, Video to Markdown), editing still images (Art
  Director), or uploading a video to a service.
compatibility: Requires Node.js 20+, ffmpeg and ffprobe on PATH, and the Video Editor package from the gti-skills repository (build it once with npm run build). Works in any Agent Skills harness.
metadata:
  display-name: Video Editor
---

# Video Editor

## Core Rule

Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## Autonomous Mode

When the user says to work on your own, for example "do it yourself", "faz você mesmo", "you don't need to ask me", "não precisa me chamar", or "just do it", or when the request runs unattended:

- **Do not stop for input.** Skip questions, confirmations, and pauses that wait for the user. At each decision, take the option this skill recommends, or the safest default, and note the decision and the reason.
- **Do not open anything for the user.** No browser tabs, viewers, editors, or servers started for the user to look at. Still write every file the skill produces and give the paths at the end.
- **Never take a gated irreversible or outward action** unless the request already allows it: deleting the user's media, publishing or uploading the video, or overwriting an existing export. Write to a new path instead and list anything blocked as pending.
- **Finish with one report:** the decisions you took and why, what you did, what is pending, and what you could not verify.

In this skill:

- **The review page may be written but not opened.** In autonomous mode use `review --out <path>` (a static HTML file) and report its path. Do not start `studio --open` unless the user asked to watch the cut.
- Choose defaults yourself when the brief leaves room: `cover` for video, `contain` for images with padding, short fades at cuts, music under 0.3 volume, and `-14` LUFS for platform exports. Note those defaults in the report.
- Never overwrite a file the user did not name as the output. Render to a fresh path inside `scope.exportsDir`.
- Do not ask which codec to use. Read the platform preset in [references/workflow/export-presets.md](references/workflow/export-presets.md) and report it.
- Never bind the studio to `0.0.0.0` on your own. The default `127.0.0.1` is the only allowed autonomous choice.

## Output Location

Everything this skill generates (timelines, plans, logs, renders, exports, measurements, caches, review pages, and run state) goes to `~/.gti/video-editor/<project>/`, where `<project>` is the repository folder name and `GTI_HOME` replaces `~/.gti`. Create the folder when needed. Never write generated files into the user's repository: only the changes the user asked for go there, and a generated file goes there only when the user names that place. Requests, exports, the checks log, captions, and the studio token file live under `~/.gti/video-editor/`; read their paths from the CLI JSON.

## Overview

One skill, one CLI, one loop: **probe, plan, run, read the checks, review, fix, export**. The agent writes a small JSON timeline for composed edits, or uses one of the measured edit tools for a single operation. Every edit tool prints a `checks` array with measured values. The review page collects those checks, the inputs, and a clickable timeline of clips, captions, and audio.

```text
  user request
      |
      v
  doctor -> probe -> plan -> run -> read checks -> review -> fix -> export
                  ^                                   |
                  +--------- named change note -------+
```

This skill does not download videos, generate images, or publish the result. Use Video to Skill or Video to Markdown for media you want to read, and Art Director for still graphics.

## Setup

The CLI is the wrapper in this skill. **Do not search npm, npx cache, PATH, GitHub, or the disk for a `videoeditor` binary.** Never run `npx videoeditor` (the package is local; npx will wander).

Skill directory = the folder that contains this `SKILL.md`.

Windows:

```powershell
& "<skill-dir>\scripts\videoeditor.cmd" doctor --json
```

Unix:

```bash
"<skill-dir>/scripts/videoeditor" doctor --json
```

`<skill-dir>` is wherever your harness loaded this skill from, for example `.claude/skills/video-editor`, `.cursor/skills/video-editor`, or `~/.agents/skills/video-editor`. Work from the user's project directory so relative media paths resolve there.

If the wrapper cannot find the package, set `VIDEOEDITOR_HOME` to the package folder (`packages/videoeditor` in the gti-skills repository) or ask the user to reinstall the skill with `node packages/cli install`. Build the engine once with `npm install` and `npm run build` in that folder.

Read `doctor --json` first. It checks ffmpeg, ffprobe, the `silencedetect`, `loudnorm`, `ass`, `showwavespic`, and `drawtext` filters, local transcribers, and a usable font. If a required tool is missing, stop and tell the user rather than installing system packages silently. `tools --json` lists every tool with its inputs, outputs, and stability level (`stable` or `experimental`).

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.

## Session storage

Video Editor isolates state by chat. The CLI reads `VIDEOEDITOR_SESSION`, `PASEO_AGENT_ID`, `OPENCODE_SESSION_ID`, and similar agent variables, then keeps each chat's requests in its own folder under `~/.gti/video-editor/` (or `$GTI_HOME/video-editor/`).

- **Default:** one session folder per workspace and chat under `sessions/`. The `init` JSON includes `scope.workspace`, `scope.root`, `scope.stateDir`, `scope.specPath`, `scope.mediaDir`, and `scope.exportsDir`.
- **Another video in the same chat:** run `init --new --name "<name>" --json`. Earlier requests stay in `history --json`.
- **Permanent project:** `init --permanent` keeps requests per workspace under `projects/`, so they outlive the chat. Still outside the repository.
- **Explicit chat id:** pass `--session <id>` when the agent does not expose a session variable. Never invent the same id for two chats.
- **Exports:** render tools write to `scope.exportsDir`. Pass `--out <path>` only when the user names a destination.
- **Checks and inputs:** each step appends its measured checks and inputs to `checks.json` in `scope.stateDir`. The review page reads that log.

## The edit-then-measure loop

1. **doctor** once. Read tool availability. Fix missing tools by telling the user, not by guessing.
2. **probe** every source. `probe --source <path> --json` returns stream facts; `probe --all --json` checks the timeline. Unreadable, empty, and unsupported files are refused with a reason before ffmpeg runs.
3. **plan** a composed edit when the request spans several clips, captions, or music. Write `scope.specPath` directly or use `scene add` and `music add`. The schema is in [references/workflow/spec.md](references/workflow/spec.md).
4. **Run** the right tool for the job: `cut`, `trim-silence`, `speed`, `reframe`, `loudness`, `captions`, or `export`. For a composed timeline run `render`. For motion graphics, follow the analyze, compose, render, review loop in the Motion Graphics section. Each prints `data.checks` with measured results.
5. **Read the checks** before moving on. A failing check means the output is wrong or the input was misread; fix the spec or the flags and run again once. Never ignore a failing check.
6. **review --out <file>** to write a static HTML page. It shows the inputs, checks from every step, a phone-frame preview with the platform safe-area overlay, and a timeline of clips, captions, and audio. Clicking an item and writing a note produces a copyable instruction for the agent. No server is needed.
7. **Fix** the named item only. Edit the one scene or rerun the one tool, then re-read the checks. Do not loop on cosmetic tweaks.
8. **export --preset** when the user is happy. The preset sets size, fps, codec, and loudness target; the checks report what was actually applied.

Forbidden after a successful export:

- a second export because a decoration "still looks off"
- rewriting the whole timeline when one scene was named
- uploading or publishing the export, even when a sharing service is installed

## Commands

`doctor` `tools` `status` `probe` `cut` `trim-silence` `speed` `reframe` `loudness` `export` `waveform` `frame` `captions` `review` `motion styles` `motion new` `motion render` `motion analyze` `motion add` `init` `plan` `render` `scene add` `music add` `history` `studio` `studio stop` `demo` `resume` `help`

Every command accepts `--json`. Flags, returned fields, and error codes: [references/workflow/commands.md](references/workflow/commands.md).

Feature guides, one per area:

- [Cut and speed](references/workflow/cut-and-speed.md)
- [Reframe](references/workflow/reframe.md)
- [Audio and loudness](references/workflow/audio-loudness.md)
- [Captions](references/workflow/captions.md)
- [Export presets](references/workflow/export-presets.md)
- [Review](references/workflow/review.md)

A ready to copy starter timeline lives in [assets/templates/timeline.json](assets/templates/timeline.json). Render check rules are in [references/quality/render-check.md](references/quality/render-check.md) and codec notes in [references/quality/ffmpeg-notes.md](references/quality/ffmpeg-notes.md).

## Motion Graphics

Motion graphics are another kind of clip: HTML/CSS/SVG compositions rendered locally by seeking, the Art Director way. No generative video API and no cloud service. `doctor` reports Playwright and Chromium; when they are missing, tell the user to run `npm install && npx playwright install chromium` in `packages/videoeditor`. Nothing here assumes a design question: pick the closest starter guide and template and note the choice.

The loop is **analyze, compose, render, review**: run `motion analyze --source <ref>` to get cuts, pacing, palette, and keyframes; choose a `Motion.md` guide from `motion styles`; write an editable composition with `motion new --template <id> --brand <brand.json>`; render it with `motion render --preset <platform> --duration <sec>`; add it with `motion add --as clip|overlay --at <t>`; then `review --out`. Every motion command prints `checks` measured with ffprobe. Full guides:

- [Composition contract](references/motion/composition-contract.md)
- [Style guides and brand kit](references/motion/style-and-brand.md)
- [Analyze, compose, render, review](references/motion/analyze-compose-render.md)
- [Quality checks](references/motion/quality.md)

## Security

The review server binds to `127.0.0.1` by default and requires a token on every route. Do not pass `--bind 0.0.0.0` unless the user explicitly asks for LAN or Tailscale access. Every route confines `/media/` to `exports/`. The CLI never uploads media and never runs ffmpeg on a file it has not validated first.
