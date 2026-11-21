# Audio and loudness

Two tools handle silence and level: `trim-silence` removes silent ranges, and `loudness` applies two-pass `loudnorm`.

## trim-silence

```bash
videoeditor trim-silence --source clip.mp4 --noise -40 --min 0.2 --json
```

`silencedetect` finds ranges quieter than `--noise` dB for at least `--min` seconds. The checks list every removed range as `start-end`, the count, and the total removed seconds. The tool then renders the kept ranges with `concat`, so video and audio stay in sync.

This tool is experimental. When it reports no ranges, it writes no output and says so. When a range is wrong, tell the user the exact range from the checks rather than changing the threshold blindly; a lower `--noise` catches quieter passages, a higher `--min` keeps short pauses.

## loudness

```bash
videoeditor loudness --source clip.mp4 --target -14 --json
```

The first pass measures the source with `loudnorm ... print_format=json`. The second pass renders with those measurements in linear mode. Non-finite measurements from synthetic audio are replaced with safe defaults, so a pure tone still renders.

| Check | Meaning |
|-------|---------|
| `measured LUFS` | Integrated loudness of the source |
| `target LUFS` | Requested target, -14 by default |
| `true peak` | Measured true peak in dBTP |
| `loudness range` | Measured LRA |
| `A/V duration delta before` | Video minus audio duration in the source |
| `A/V duration delta after` | The same value in the output |

A growing A/V delta after normalization means the audio stream was padded or trimmed. A delta above 0.2s is worth reporting to the user. All platform presets use -14 LUFS; see [export-presets.md](export-presets.md).

## waveform

```bash
videoeditor waveform --source clip.mp4 --at 1.25 --window 2 --json
```

Writes a PNG from `showwavespic` centered on a cut point. Use it to decide whether a silence range from `trim-silence` is a real pause or a quiet word that should stay.
