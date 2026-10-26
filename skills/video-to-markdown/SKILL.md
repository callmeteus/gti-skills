---
name: video-to-markdown
description: >-
  Converts a video (YouTube URL or local file) into clean, structured Markdown
  notes using the transcript and keyframes of slides, code, diagrams, and UI.
  Supports study notes, tutorials, full transcripts, and meeting notes with
  timestamp links back to the video. Use when the user wants notes, a
  summary, a tutorial, or documentation written from a video, talk, lecture,
  or recording. Do not use to build an agent skill from a video; use
  video-to-skill for that.
compatibility: Requires Python 3.8+, ffmpeg, and yt-dlp. YouTube access needs network.
metadata:
  display-name: Video to Markdown
---

# Video to Markdown

## Core Rule

Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## When to use

- The user wants notes, a summary, a tutorial, or documentation from a video or recording.
- The user wants a searchable transcript with timestamps and the important visuals.

Do not use this skill to create an agent skill from a video (use `video-to-skill`). Do not summarize a video you have not extracted.

## Setup

`<skill-dir>` is the folder that contains this `SKILL.md`. Use `python3` on macOS and Linux, and `python` or `py -3` on Windows.

```bash
python3 <skill-dir>/scripts/setup/check_dependencies.py --install
```

It installs `yt-dlp`, `ffmpeg`, and `youtube-transcript-api` when missing. Add `--with-whisper` only when a video has no captions.

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.

## Workflow

Follow these steps in order. Read each reference only when you reach that step.

1. **Collect context.** Ask for the video and the kind of document. Offer the four formats and defaults. See [references/workflow/01-collect-context.md](references/workflow/01-collect-context.md).
2. **Extract.** Metadata, transcript, and frames with the bundled scripts. See [references/workflow/02-extract-content.md](references/workflow/02-extract-content.md).
3. **Draft.** Build a sectioned draft with `scripts/render/assemble_draft.py`. See [references/workflow/03-assemble-the-draft.md](references/workflow/03-assemble-the-draft.md).
4. **Write.** Turn the draft into the chosen format. Formats: [study notes](references/formats/study-notes.md), [tutorial](references/formats/tutorial.md), [full transcript](references/formats/full-transcript.md), [meeting notes](references/formats/meeting-notes.md).
5. **Review and deliver.** Run the checklist in [references/quality/checklist.md](references/quality/checklist.md), then give the user the file path.

## Rules

- Synthesize; do not dump the transcript, except in the full transcript format.
- Every section heading links to its moment in the video.
- Embed a frame only when it adds information the words do not (slides, code, diagrams, UI, terminal output).
- Copy commands and code from frames, not from speech, and put them in fenced blocks with a language.
- Always state the source video (title, channel, link) in the frontmatter.
- Never present something as shown in the video when you only inferred it.
- Keep extraction files (`work/`) out of the delivered folder unless the user asks for the frames, which then sit in a `frames/` folder next to the Markdown file.

## Resources

| Path | Purpose |
|------|---------|
| `scripts/setup/` | Dependency check and install |
| `scripts/download/` | Video, audio, and metadata download with yt-dlp |
| `scripts/transcript/` | Captions with timestamps, and Whisper fallback |
| `scripts/frames/` | Timestamped keyframes by interval or scene change |
| `scripts/render/` | Builds the sectioned Markdown draft |
| `references/workflow/` | One guide per workflow step |
| `references/formats/` | Structure and rules for each output format |
| `references/quality/` | Final checklist |
| `assets/templates/` | One Markdown template per format |
| `harnesses/` | One short guide per coding agent: install, invoke, verify |
