---
name: video-to-markdown
description: >-
  Download YouTube videos or use video URLs to extract transcripts and frames,
  then generate clean Markdown documentation. Analyzes both spoken content and
  visual elements like slides, code, diagrams, and UI. Use when you need to
  convert video content into structured Markdown notes.
---

# video-to-markdown

## Core Rule
Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## When to use
Use this skill when the user wants to convert video content (primarily YouTube) into clean, structured Markdown documentation. Great for turning tutorials, talks, or walkthroughs into readable notes.

## What this skill needs
You MUST gather the following information before generating anything:

### Required
- **Video source**: YouTube URL, video ID, or local video file
- **Output purpose**: What kind of document? (notes, tutorial summary, full transcript with visuals, etc.)
- **Target format**: Any specific structure desired?

### Recommended
- **Include timestamps**: Add clickable timestamps to video?
- **Include frames**: Extract and embed keyframes?
- **Focus on**: Specific topics to emphasize?
- **Skip**: Parts to ignore?
- **Output location**: Where to save the Markdown file?

## How it works

### Step 1: Collect Context
If missing required info, ask the user. Don't just take a URL.

### Step 2: Extract Transcript
- For YouTube with captions: Use `youtube-transcript-api`
- For videos without captions or other platforms: Use `yt-dlp` + `whisper`/`mlx-whisper`
- Get timestamps when available

### Step 3: Extract Keyframes
- Extract frames at key moments (every 15-30s or on scene changes)
- Prioritize frames with code, slides, diagrams, UI screenshots, terminal output
- For videos < 3 min, extract more frequently
- Use `ffmpeg` for extraction

### Step 4: Generate Markdown
Create structured documentation with:

```markdown
---
title: "Video Title"
source: "https://youtube.com/..."
duration: "..."
date: "YYYY-MM-DD"
---

# Title

## Overview
Brief summary

## Key Points
Main takeaways

## Content
Timestamped sections with transcript and relevant frames

## Code/Commands
Extracted commands and code snippets

## Resources
Links mentioned

## Notes
Additional context
```

## Features
- **Transcript extraction**: Get full or summarized transcript
- **Visual context**: Include screenshots of important visuals
- **Timestamped**: Navigate back to video easily
- **Clean formatting**: Readable, not just raw transcript
- **Code extraction**: Pull out commands and code blocks
- **Metadata**: Include video info, channel, date

## Dependencies
- `yt-dlp` - download videos/metadata
- `ffmpeg` - frame extraction and processing
- `youtube-transcript-api` - YouTube transcripts
- `whisper` or `mlx-whisper` - transcription for videos without captions

## Usage Examples

```
"Convert https://youtube.com/watch?v=xxx to markdown notes with timestamps and frames"
"Create tutorial markdown from this YouTube video focusing on commands"
"Extract keyframes and transcript from this video as study notes"
```

## Notes
- Prioritize visual content - slides/diagrams often contain info not in audio
- Synthesize, don't just dump - organize into logical sections
- Include frames inline where they add value
- Keep it scannable with headings and bullet points
- Always mention source video with link
- Output in clean, portable Markdown
