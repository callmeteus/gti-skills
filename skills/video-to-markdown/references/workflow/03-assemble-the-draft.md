# Step 3: Assemble the draft

The draft gives you the structure and the raw material. You write the final text.

```bash
python3 <skill-dir>/scripts/render/assemble_draft.py \
  --transcript ./work/transcript.json \
  --video-id VIDEO_ID \
  --frames ./work/frames/manifest.json \
  --metadata ./work/metadata.json \
  --out ./notes/draft.md
```

For an X post or a local file, leave out `--video-id`. The source link comes from `metadata.json` or from `--source-url`.

| Option | Default | Purpose |
|--------|---------|---------|
| `--transcript` | Required | Transcript JSON from step 2 |
| `--video-id` | None | YouTube video ID; section headings link to that moment in the video |
| `--source-url` | `webpage_url` from `--metadata` | Source link for videos without a YouTube ID, such as an X post |
| `--frames` | None | Frame manifest; places frames in the right section |
| `--metadata` | None | Title, channel, duration, and chapters |
| `--window` | `120` | Section length in seconds when the video has no chapters |
| `--frames-dir` | `frames` | Folder name used in image links |
| `--out` | stdout | Output file |

## What the draft contains

- Frontmatter with title, source link, channel, and duration.
- One `##` section per chapter (or per time window), with a link to that moment for YouTube videos. X posts and local files get a plain timestamp, because their players do not open at a given time from a link.
- The frames that fall inside the section.
- The raw transcript of the section in a blockquote.

## What to do with it

1. Copy the frames you keep into `notes/frames/` next to the Markdown file and delete the rest. Image links already point at `frames/`.
2. Replace each blockquote with prose or bullets in the chosen format. See the [formats](../formats/study-notes.md).
3. Rename generic section titles ("Part 2") to what the section is about.
4. Merge short sections and split long ones when the topic changes.
5. Delete the draft comment at the top.
