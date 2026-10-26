---
name: video-to-skill
description: >-
  Turns a tutorial video (YouTube URL or local file) into a ready-to-use
  SKILL.md by combining the transcript with keyframes of the commands, code,
  and UI shown on screen. Use when the user wants to create, draft, or extract
  an agent skill from a video, screencast, or walkthrough. Needs the skill
  name, purpose, and triggers in addition to the video. Do not use for plain
  video summaries or notes; use video-to-markdown for those.
compatibility: Requires Python 3.8+, ffmpeg, and yt-dlp. YouTube access needs network.
metadata:
  display-name: Video to Skill
---

# Video to Skill

## Core Rule

Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## When to use

- The user shares a tutorial, demo, screencast, or talk and wants an agent skill built from it.
- The user wants to capture a workflow shown in a video as repeatable agent instructions.

Do not use this skill when the user only wants a summary or notes of a video (use `video-to-markdown`), or when they give a bare URL with no idea of what the skill should do. Ask first.

## Setup

`<skill-dir>` is the folder that contains this `SKILL.md`. Use `python3` on macOS and Linux, and `python` or `py -3` on Windows.

```bash
python3 <skill-dir>/scripts/setup/check_dependencies.py --install
```

It prints a JSON report and installs `yt-dlp`, `ffmpeg`, and `youtube-transcript-api` when missing. Add `--with-whisper` only when a video has no captions.

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.

## Workflow

Follow these steps in order. Read each reference only when you reach that step.

1. **Collect context.** Never start from only a URL. Gather the video, the skill name (kebab-case), its purpose, its triggers, and the target agent. See [references/workflow/01-collect-context.md](references/workflow/01-collect-context.md).
2. **Extract content.** Get metadata, transcript, and keyframes with the bundled scripts. See [references/workflow/02-extract-content.md](references/workflow/02-extract-content.md).
3. **Analyze.** Cross-check what is said against what is shown; the screen wins. See [references/workflow/03-analyze-and-synthesize.md](references/workflow/03-analyze-and-synthesize.md).
4. **Write.** Scaffold the folder and fill in `SKILL.md`, `references/`, and `scripts/`. See [references/workflow/04-write-the-skill.md](references/workflow/04-write-the-skill.md).
5. **Validate and deliver.** Run the validator, fix every error, then tell the user where the skill is and how to install it. See [references/workflow/05-validate-and-deliver.md](references/workflow/05-validate-and-deliver.md).

## Rules

- The generated skill is written in English and contains the Core Rule above, word for word.
- The generated `description` states what the skill does, when to use it, and when not to. See [references/quality/description-guide.md](references/quality/description-guide.md).
- Synthesize; never paste the transcript. Commands and paths come from the screen when it disagrees with the audio.
- Keep the generated `SKILL.md` under 500 lines and move detail into `references/`.
- Never invent a command, flag, or path that the video does not show or the user did not give.
- Never leave frames, downloaded videos, or transcripts inside the generated skill folder.

## Resources

| Path | Purpose |
|------|---------|
| `scripts/setup/` | Dependency check and install |
| `scripts/download/` | Video, audio, and metadata download with yt-dlp |
| `scripts/transcript/` | Captions with timestamps, and Whisper fallback |
| `scripts/frames/` | Timestamped keyframes by interval or scene change |
| `scripts/scaffold/` | Creates the new skill folder from the template |
| `scripts/validate/` | Checks a skill against the standard |
| `references/workflow/` | One guide per workflow step |
| `references/quality/` | Description guide and anti-patterns |
| `references/harnesses/` | Where each coding agent loads skills from |
| `harnesses/` | One short guide per coding agent: install, invoke, verify |
| `assets/templates/` | `SKILL.template.md` used by the scaffold |
| `assets/examples/` | A complete generated skill to imitate |
