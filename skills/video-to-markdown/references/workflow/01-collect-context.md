# Step 1: Collect context

Ask only what you cannot infer. One message, a short list, with defaults the user can accept.

## Required

| Input | Examples | If missing |
|-------|----------|------------|
| Video source | YouTube URL, video ID, local file | Ask for it |
| Format | study notes, tutorial, full transcript, meeting notes | Offer the four and recommend one |

## Optional

| Input | Default |
|-------|---------|
| Timestamp links | On |
| Frames | On for slides, code, and UI; off for talking heads |
| Focus topics | Whole video |
| Segments to skip | None (offer to skip intros and sponsor reads) |
| Output path | `./notes/<video-title-kebab>.md` |
| Language of the notes | The user's language |

## Choosing a format

| The user says | Format |
|---------------|--------|
| "notes", "summary", "study guide", "lecture" | [study notes](../formats/study-notes.md) |
| "tutorial", "how-to", "steps", "walkthrough" | [tutorial](../formats/tutorial.md) |
| "transcript", "everything that was said", "quotes" | [full transcript](../formats/full-transcript.md) |
| "meeting", "call", "standup", "action items" | [meeting notes](../formats/meeting-notes.md) |

## How to ask

```text
Quick check before I start:
1. Format: study notes (default), tutorial, full transcript, or meeting notes?
2. Include frames of slides, code, and UI? (yes)
3. Save to ./notes/<title>.md?
```

Wait for the answer when the format is unclear. Proceed with defaults when the request already names a format.
