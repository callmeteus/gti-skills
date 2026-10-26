#!/usr/bin/env python3
"""Download a video, its audio, or just its metadata with yt-dlp.

Usage:
    python download_video.py URL --out ./work --mode metadata
    python download_video.py URL --out ./work --mode video --height 720
    python download_video.py URL --out ./work --mode audio

Prints a JSON object with the produced file paths.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.common import fail, find_tool, parse_video_id, print_json, run_command  # noqa: E402

MODES = ("metadata", "video", "audio")


def build_command(url: str, out_dir: Path, mode: str, height: int) -> List[str]:
    """Build the yt-dlp command for a mode."""
    base = ["yt-dlp", "--no-playlist", "--no-warnings"]

    if mode == "metadata":
        return base + ["--skip-download", "--dump-single-json", url]

    if mode == "audio":
        return base + [
            "-x",
            "--audio-format", "m4a",
            "-o", str(out_dir / "audio.%(ext)s"),
            url,
        ]

    selector = "bv*[height<=%d]+ba/b[height<=%d]/b" % (height, height)

    return base + [
        "-f", selector,
        "--merge-output-format", "mp4",
        "-o", str(out_dir / "video.%(ext)s"),
        url,
    ]


def summarize_metadata(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Keep only the metadata fields the skills use."""
    description = str(raw.get("description") or "")

    return {
        "id": raw.get("id"),
        "title": raw.get("title"),
        "channel": raw.get("channel") or raw.get("uploader"),
        "duration_seconds": raw.get("duration"),
        "upload_date": raw.get("upload_date"),
        "webpage_url": raw.get("webpage_url"),
        "chapters": [
            {
                "title": chapter.get("title"),
                "start": chapter.get("start_time"),
                "end": chapter.get("end_time"),
            }
            for chapter in (raw.get("chapters") or [])
        ],
        "description": description[:2000],
    }


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Download video, audio, or metadata with yt-dlp")
    parser.add_argument("url", help="Video URL or YouTube video ID")
    parser.add_argument("--out", "-o", default="./work", help="Output directory (default: ./work)")
    parser.add_argument("--mode", "-m", choices=MODES, default="metadata", help="What to download (default: metadata)")
    parser.add_argument("--height", type=int, default=720, help="Maximum video height for --mode video (default: 720)")
    args = parser.parse_args(argv)

    if not find_tool("yt-dlp"):
        fail("yt-dlp is not installed. Run scripts/setup/check_dependencies.py --install", 127)

    video_id = parse_video_id(args.url)
    url = "https://www.youtube.com/watch?v=%s" % video_id if video_id and "/" not in args.url else args.url
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    code, stdout, stderr = run_command(build_command(url, out_dir, args.mode, args.height))

    if code != 0:
        fail(stderr.strip() or "yt-dlp failed", code)

    if args.mode == "metadata":
        summary = summarize_metadata(json.loads(stdout))
        target = out_dir / "metadata.json"
        target.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
        print_json({"mode": args.mode, "metadata": str(target), "summary": summary})
        return 0

    produced = sorted(str(path) for path in out_dir.glob("video.*" if args.mode == "video" else "audio.*"))
    print_json({"mode": args.mode, "files": produced})

    return 0


if __name__ == "__main__":
    sys.exit(main())
