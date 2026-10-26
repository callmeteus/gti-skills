#!/usr/bin/env python3
"""Fetch a YouTube transcript with timestamps (youtube-transcript-api 1.x).

Usage:
    python get_transcript.py VIDEO_ID_OR_URL
    python get_transcript.py VIDEO_ID_OR_URL --lang pt,en --format json --out transcript.json
    python get_transcript.py VIDEO_ID_OR_URL --list

Formats: text (default), json, srt, markdown.
Manually written captions win over auto-generated ones for the same language.
Exit codes: 0 success, 1 failure, 2 no captions at all (use transcribe_audio.py).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.common import (  # noqa: E402
    build_transcript,
    fail,
    format_timestamp,
    parse_video_id,
    print_json,
    timestamp_url,
)

FORMATS = ("text", "json", "srt", "markdown")
NO_CAPTIONS_EXIT = 2


def srt_time(seconds: float) -> str:
    """Format seconds as an SRT timestamp (HH:MM:SS,mmm)."""
    millis = int(round(seconds * 1000))
    hours, millis = divmod(millis, 3600000)
    minutes, millis = divmod(millis, 60000)
    secs, millis = divmod(millis, 1000)

    return "%02d:%02d:%02d,%03d" % (hours, minutes, secs, millis)


def to_srt(entries: List[Dict[str, Any]]) -> str:
    """Render transcript entries as SubRip subtitles."""
    blocks = []

    for index, entry in enumerate(entries, start=1):
        end = entry["start"] + entry["duration"]
        blocks.append("%d\n%s --> %s\n%s\n" % (index, srt_time(entry["start"]), srt_time(end), entry["text"]))

    return "\n".join(blocks)


def to_markdown(entries: List[Dict[str, Any]], video_id: str) -> str:
    """Render transcript entries as Markdown lines that link to the video moment."""
    lines = []

    for entry in entries:
        label = format_timestamp(entry["start"])
        lines.append("- [%s](%s) %s" % (label, timestamp_url(video_id, entry["start"]), entry["text"].replace("\n", " ")))

    return "\n".join(lines) + "\n"


def pick_transcript(transcript_list: Any, languages: List[str]) -> Any:
    """Choose the best transcript: preferred languages in order, manual before generated."""
    for language in languages:
        for finder in ("find_manually_created_transcript", "find_generated_transcript"):
            try:
                return getattr(transcript_list, finder)([language])
            except Exception:  # NoTranscriptFound for this language and kind
                continue

    available = list(transcript_list)

    if not available:
        raise LookupError("no transcripts available")

    return available[0]


def describe_available(transcript_list: Any) -> List[Dict[str, Any]]:
    """List every caption track of a video."""
    return [
        {
            "language": item.language,
            "code": item.language_code,
            "auto_generated": bool(item.is_generated),
        }
        for item in transcript_list
    ]


def fetch(video_id: str, languages: List[str]) -> Dict[str, Any]:
    """Fetch the transcript JSON for a video ID."""
    from youtube_transcript_api import YouTubeTranscriptApi

    transcript_list = YouTubeTranscriptApi().list(video_id)
    transcript = pick_transcript(transcript_list, languages)
    raw = transcript.fetch().to_raw_data()
    source = "youtube-auto" if transcript.is_generated else "youtube-manual"

    return build_transcript(raw, transcript.language_code, source)


def render(result: Dict[str, Any], output_format: str, video_id: str) -> str:
    """Render the transcript in the requested format."""
    import json

    if output_format == "json":
        return json.dumps(result, indent=2, ensure_ascii=False)

    if output_format == "srt":
        return to_srt(result["timestamped"])

    if output_format == "markdown":
        return to_markdown(result["timestamped"], video_id)

    return result["text"]


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Fetch a YouTube transcript")
    parser.add_argument("video", help="YouTube video ID or URL")
    parser.add_argument("--lang", "-l", default="en", help="Comma separated language preference, e.g. pt,en (default: en)")
    parser.add_argument("--format", "-f", choices=FORMATS, default="text", help="Output format (default: text)")
    parser.add_argument("--json", "-j", action="store_true", help="Shortcut for --format json")
    parser.add_argument("--out", "-o", help="Write the result to a file instead of stdout")
    parser.add_argument("--list", action="store_true", help="List the available caption tracks and exit")
    args = parser.parse_args(argv)

    video_id = parse_video_id(args.video)

    if not video_id:
        fail("Could not find a YouTube video ID in %r" % args.video)

    try:
        import youtube_transcript_api  # noqa: F401
    except ImportError:
        fail("youtube-transcript-api 1.x is not installed. Run scripts/setup/check_dependencies.py --install", 127)

    languages = [item.strip() for item in args.lang.split(",") if item.strip()]
    output_format = "json" if args.json else args.format

    try:
        if args.list:
            from youtube_transcript_api import YouTubeTranscriptApi

            print_json(describe_available(YouTubeTranscriptApi().list(video_id)))
            return 0

        result = fetch(video_id, languages)
    except LookupError:
        sys.stderr.write("Error: this video has no captions. Use scripts/transcript/transcribe_audio.py\n")
        return NO_CAPTIONS_EXIT
    except Exception as error:  # library raises many specific errors
        name = type(error).__name__

        if name in ("TranscriptsDisabled", "NoTranscriptFound"):
            sys.stderr.write("Error: %s. Use scripts/transcript/transcribe_audio.py\n" % name)
            return NO_CAPTIONS_EXIT

        fail("%s: %s" % (name, str(error).strip().splitlines()[0] if str(error).strip() else name))

    text = render(result, output_format, video_id)

    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
        print_json({"file": args.out, "language": result["language"], "source": result["source"], "segments": len(result["timestamped"])})
    else:
        sys.stdout.write(text + ("" if text.endswith("\n") else "\n"))

    return 0


if __name__ == "__main__":
    sys.exit(main())
