# Notice

This package contains original TypeScript code written for the gti-skills Video Editor skill. It does not copy source files from the projects credited below. The ideas behind the tool contract, the measured checks, and the caption workflow were ported and reimplemented here.

## ffmpeg tool contract

- **Project:** [kajisho5/ffmpeg-skill](https://github.com/kajisho5/ffmpeg-skill)
- **License:** MIT
- **Used for:** the idea of a machine-readable tool contract (inputs, outputs, stability), the edit-then-measure loop, and the set of practical edit operations: cut, trim silence, speed, reframe, loudness, platform presets, waveform, frame, and captions. The CLI, planner, checks, and review page in this package are independent implementations.

## Captions

The brief asked for an open-source captions repo owned by a GitHub user related to X user `pratyushrungta`. The search did not find one:

- `gh api "search/repositories?q=captions+user:pratyushrungta"` returned HTTP 422 (the user or resource could not be searched).
- `gh api users/pratyushrungta` returned a user with 0 public repositories, no Twitter handle, and no following list.
- `gh search repos captions --sort updated` filtered by name returned no captions repository owned by a related user.

**Result: captions repo not found.** No source was copied from an unidentified repository.

The related open-source project that was found and consulted for caption ideas is:

- **Project:** [kajisho5/subtitle-skill](https://github.com/kajisho5/subtitle-skill)
- **License:** MIT
- **Used for:** the idea of generating SRT/WebVTT subtitles and burning them deterministically with ffmpeg. The SRT/VTT parser, ASS generator with karaoke word highlighting, safe-area margin, and burn command in this package are original code.

## Third party tools

ffmpeg, ffprobe, and optional local transcribers (`faster-whisper`, `whisper.cpp`, `whisper`) are external executables. They are detected at runtime and are not bundled with this package. Their licenses remain with their respective projects.
