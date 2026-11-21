# Captions

`captions` can import a subtitle file or transcribe locally, then burn styled short-video captions into the video.

```bash
videoeditor captions --source clip.mp4 --srt captions.srt --style reels-bold --json
videoeditor captions --source clip.mp4 --vtt captions.vtt --preset shorts --json
videoeditor captions --source clip.mp4 --language pt --json
```

## Source of the words

- **Import:** `--srt` or `--vtt` reads SRT or WebVTT cues. Word timings are estimated by dividing each cue's duration evenly across its words, and the `word timing` check reports `estimated`.
- **Transcribe:** without a subtitle flag, the tool uses `faster-whisper`, `whisper-cli`, or `whisper` if one is installed. `doctor --json` detects them. Word-level timestamps from the transcriber are used and the check reports `transcribed`. When only sentence timings are available the check still reports `estimated`.
- **Language:** omitting `--language` asks the transcriber to auto detect. Never assume English. The generated `captions.json` records `auto` when no language was given.

If no transcriber is installed the tool refuses with an `INPUT` error that tells the user to import SRT/VTT or install one. Do not install ML packages silently.

## Styles and safe area

Named styles: `default`, `reels-bold`, `shorts-clean`, `tiktok-pop`. Pass `--style <name>` to choose one. The ASS file uses karaoke fill tags so each word highlights in turn; imported cues still get even word highlights.

The bottom margin is computed from the frame height. Defaults are 15%, or the preset's `safeBottom` when `--preset` is given: Reels and Shorts 18%, TikTok 22%, YouTube 8%. The `safe area bottom` check reports the value. Captions therefore land above the platform UI instead of underneath it.

## Output

The tool writes `captions.ass` in the request state folder and a burned MP4 in `exports/`. It records cue count, timing source, language, style, and the cues in `captions.json` so the review page can show them on the timeline.

Checks: `caption source`, `cues`, `word timing`, `style`, `safe area bottom`, `ass`, and `output`. A failed `ass` or `output` check means ffmpeg could not render the subtitle file; confirm a font exists with `doctor` and retry with `--style default`.

Credits for the caption approach are in `packages/videoeditor/NOTICE.md`.
