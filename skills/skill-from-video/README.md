# skill-from-video

Generate a complete, usable `SKILL.md` from a YouTube video by analyzing both the transcript and visual frames. 

## Important
This skill requires more than just a video URL. You must provide context about the skill you want to create.

## Core Rule
All skills created by this tool MUST instruct agents to respond in the user's language, regardless of the language used in the skill content.

## Usage
1. Provide the YouTube URL/video
2. Provide the skill name (kebab-case)
3. Provide the purpose and when-to-use
4. Provide context about tools, files, or structure needed
5. The skill will analyze transcript + frames and generate a ready-to-use `SKILL.md`

## Dependencies
- `yt-dlp` (for downloading videos when needed)
- `ffmpeg` (for frame extraction)
- `youtube-transcript-api` (for transcripts)
- `whisper` or `mlx-whisper` (for videos without captions)

## Output
Generates a properly formatted `SKILL.md` in English with:
- Frontmatter (name, description)
- Core Rule about responding in user's language
- Clear when-to-use triggers
- Actionable instructions
- Examples and notes
