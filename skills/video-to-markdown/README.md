# video-to-markdown

Download YouTube videos or use video URLs to extract transcripts and frames, then generate clean Markdown documentation. Analyzes both spoken content and visual elements like slides, code, diagrams, and UI.

## Core Rule
All skills in this repository must instruct agents to respond in the user's language regardless of content.

## Usage
1. Provide YouTube URL or video file
2. Specify desired output format (notes, tutorial, full doc)
3. Choose whether to include timestamps and frames
4. Get clean, structured Markdown back

## Features
- Transcript extraction with timestamps
- Keyframe extraction from video
- Smart organization of content
- Code and command extraction
- Visual context preservation
- Clean, readable output

## Dependencies
- `yt-dlp`
- `ffmpeg`
- `youtube-transcript-api`
- `whisper` or `mlx-whisper`
