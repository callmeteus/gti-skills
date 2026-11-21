# Cut and speed

Use `cut` for one precise removal from a source and `speed` for a uniform tempo change. Both re-encode so the result is frame accurate; neither edits the user's original file.

## cut

```bash
videoeditor cut --source clip.mp4 --start 0.5 --end 2 --json
```

`--start` and `--end` are source times in seconds, and `--end` must be greater than `--start`. The tool seeks to `--start`, takes `--end - --start` seconds, and writes a new MP4 to `exports/` unless `--out` names a file.

Read these checks before accepting the result:

| Check | Meaning |
|-------|---------|
| `requested duration` | The length you asked for |
| `measured duration` | ffprobe's duration of the output |
| `duration delta` | Absolute difference; must be at most 0.35s |
| `output` | Confirms the file exists |

A delta above 0.35s usually means the source has a variable frame rate or a truncated final packet. Re-cut with a slightly later end rather than editing the file by hand.

## speed

```bash
videoeditor speed --source clip.mp4 --rate 1.5 --json
```

Video uses `setpts=PTS/<rate>`. Audio uses a chain of `atempo` filters, so a rate such as 4x becomes two 2x steps and still renders.

The `speed range` check warns when the rate is below 0.5x or above 2x. The tool does render those rates, but heavy frame duplication or audio artifacts are likely. Tell the user about the warning in one sentence, and offer a rate inside the range as the alternative.

Compare `duration before`, `duration after`, and `measured ratio`. The ratio should be close to `1 / rate`.

## When to use the timeline instead

If the edit needs several cuts, overlaps, captions, or music, do not chain `cut` calls. Author the timeline in `scope.specPath` as described in [spec.md](spec.md) and use `plan` then `render`, so there is one ffmpeg command and one set of checks.
