# Command reference

Every command accepts `--json` and prints `{ "ok", "command", "summary", "data" }`. Edit tools add `data.checks`, an array of `{ name, ok, measured, expected?, detail? }`. Without `--json` only the summary is printed. `VIDEOEDITOR_JSON=1` forces JSON.

## Shared flags

| Flag | Default | Purpose |
|------|---------|---------|
| `--json` | Off | Print the JSON envelope |
| `--root <dir>` | Current directory | Workspace used to resolve relative source paths |
| `--session <id>` | Detected chat id | Isolate state for a different chat |
| `--request <id>` | Active request | Open a specific request instead of the active one |
| `--permanent` | Off | Keep requests per workspace instead of per chat |
| `--out <path>` | Tool specific | Named output file for render, images, and review |

`--permanent` can also be turned on with `VIDEOEDITOR_STORAGE=repository`.

## Detect and contract

### doctor

```bash
videoeditor doctor --json
```

Checks ffmpeg, ffprobe, the `silencedetect`, `loudnorm`, `ass`, `showwavespic`, and `drawtext` filters, local transcribers (`faster-whisper`, `whisper-cli`, `whisper`), and a common system font. Returns `data.checks` and `data.tools`.

### tools

```bash
videoeditor tools --json
```

Returns `data.tools`, the full machine readable contract: every tool with `name`, `summary`, `stability` (`stable` or `experimental`), `inputs`, and `outputs`.

### status and resume

```bash
videoeditor status --json
videoeditor resume --json
```

`data.tools` reports ffmpeg and ffprobe. `data.state` is either `{ active: false, hint: ... }` or the active project, its `scope`, scene count, duration, and renders.

## Input refusal

`probe`, `cut`, `trim-silence`, `speed`, `reframe`, `loudness`, `export`, `waveform`, `frame`, `captions`, `plan`, `render`, `scene add`, and `music add` all validate inputs before any external tool runs. A file is refused when it does not exist, is not a regular file, is empty, is unreadable, has an unsupported extension, or has the wrong kind for the tool. Refusals print a JSON error on stderr with code `INPUT` and a reason.

| Tool group | Accepted input kinds |
|------------|----------------------|
| `cut`, `speed`, `reframe`, `frame`, `plan`, `render` | video or image |
| `loudness`, `trim-silence`, `waveform` | audio or video with audio |
| `captions --srt` / `--vtt` | `.srt` or `.vtt` |
| `music add` | audio |
| `probe` | any supported media |

## Edit and measure

### probe

```bash
videoeditor probe --source "clip.mp4" --json
videoeditor probe --all --json
```

Returns `data.source` or `data.sources` and `data.checks`.

### cut

```bash
videoeditor cut --source clip.mp4 --start 0.5 --end 2 --json
```

Flags: `--source` (required), `--start` (required), `--end` (required). Checks: source, requested duration, measured duration, duration delta (tolerance 0.35s), output.

### trim-silence

```bash
videoeditor trim-silence --source clip.mp4 --noise -40 --min 0.2 --json
```

Runs `silencedetect`, reports the removed ranges, and renders the kept ranges with `concat`. Checks: threshold, removed ranges, removed seconds, duration before and after. Experimental.

### speed

```bash
videoeditor speed --source clip.mp4 --rate 1.5 --json
```

Flags: `--source`, `--rate`. Uses `setpts` and a chained `atempo`, so rates outside 0.5x to 2x still render. Checks include a `speed range` warning check when the rate is outside that interval.

### reframe

```bash
videoeditor reframe --source clip.mp4 --aspect 9:16 --json
```

Flags: `--source`, `--aspect W:H` or `--preset`. Checks: source size, aspect, crop box, cropped pixels, cropped percent, placement (anchor and x/y), output size. See [reframe.md](reframe.md).

### loudness

```bash
videoeditor loudness --source clip.mp4 --target -14 --json
```

Two-pass `loudnorm`. Checks: measured LUFS, target, true peak, loudness range, A/V duration delta before and after. See [audio-loudness.md](audio-loudness.md).

### export

```bash
videoeditor export --source clip.mp4 --preset reels --json
```

Presets: `reels`, `shorts`, `tiktok`, `youtube`. Checks: preset, size, fps, codec, loudness target, measured source LUFS, safe area bottom, cropped percent. See [export-presets.md](export-presets.md).

### waveform and frame

```bash
videoeditor waveform --source clip.mp4 --at 1.25 --window 2 --json
videoeditor frame --source clip.mp4 --at 1 --compare-at 2 --json
```

Both write PNGs. `waveform` uses `showwavespic` around a cut point. `frame` writes one frame or a side by side `hstack` image.

### captions

```bash
videoeditor captions --source clip.mp4 --srt captions.srt --style reels-bold --json
videoeditor captions --source clip.mp4 --language pt --preset shorts --json
```

Imports SRT/VTT or transcribes with word timestamps when a local transcriber is installed. Omitting `--language` asks the transcriber to auto detect; English is never assumed. Generates ASS with karaoke word highlighting and a bottom safe-area margin, then burns it. Checks: caption source, cues, word timing, style, safe area, ASS file, output. See [captions.md](captions.md).

### review

```bash
videoeditor review --out review.html --json
```

Writes a standalone HTML page: inputs, checks from every step, phone-frame preview with platform safe area, and a timeline of clips, captions, and audio. Click an item, write a note, and copy the generated agent instruction. Works from `file://` with no server. See [review.md](review.md).

## Timeline and state

| Command | Purpose | Key flags |
|---------|---------|-----------|
| `init` | Create a request or return the current one | `--name`, `--new`, `--permanent` |
| `plan` | Print the ffmpeg command without rendering | `--spec`, `--format` |
| `render` | Run the plan and write a video | `--spec`, `--format`, `--out` |
| `scene add` | Append a video or image scene | `--source`, `--duration`, `--in`, `--fit`, `--text`, `--fade-in`, `--fade-out`, `--volume` |
| `music add` | Append a music track | `--source`, `--in`, `--volume`, `--fade-in`, `--fade-out` |
| `history` | List requests in this session | |
| `demo` | Write a sample timeline and plan without ffmpeg | `--out` |
| `resume` | Short active request summary | |
| `help` | Show the command list | |

### studio

```bash
videoeditor studio --open --json
videoeditor studio --port 4870 --bind 127.0.0.1 --json
videoeditor studio stop --json
```

The server now binds to `127.0.0.1` by default. To expose it on the LAN or Tailscale, pass `--bind 0.0.0.0` explicitly; the JSON then lists `tailscaleUrls` when the host has a tailnet address. Every route requires the token from `studio.json`. `studio stop` closes studios started in the current process.

## Errors

Failures print JSON on stderr: `{ "ok": false, "error": "CODE", "summary": "..." }`. Codes are `PROJECT`, `SPEC`, `PATH`, `INPUT`, `FFMPEG`, `RENDER`, and `SERVER`.
