#!/usr/bin/env python3
"""Download a video, its audio, or just its metadata.

YouTube and other sites go through yt-dlp. X (Twitter) posts go through the
FixupX / FxTwitter API, which returns direct MP4 links; audio is then
extracted with ffmpeg.

Usage:
    python download_video.py URL --out ./work --mode metadata
    python download_video.py URL --out ./work --mode video --height 720
    python download_video.py URL --out ./work --mode audio
    python download_video.py https://x.com/user/status/ID --out ./work --mode video --index 2

Prints a JSON object with the produced file paths.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib import fixupx  # noqa: E402
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


def write_metadata(out_dir: Path, mode: str, summary: Dict[str, Any]) -> None:
    """Write metadata.json and print the result."""
    target = out_dir / "metadata.json"
    target.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print_json({"mode": mode, "metadata": str(target), "summary": summary})


def download_x_post(status_id: str, out_dir: Path, mode: str, height: int, index: int) -> int:
    """Download metadata, video, or audio of an X post through the FixupX API."""
    try:
        tweet = fixupx.fetch_status(status_id)
    except (LookupError, RuntimeError) as error:
        fail(str(error))

    videos = fixupx.list_videos(tweet)

    if not videos:
        fail("Post %s has no video. Only videos and GIFs can be downloaded." % status_id)

    if not 1 <= index <= len(videos):
        fail("--index %d is out of range: the post has %d video(s)" % (index, len(videos)))

    video = videos[index - 1]

    if mode == "metadata":
        write_metadata(out_dir, mode, fixupx.summarize_status(tweet, video, index, len(videos)))
        return 0

    if mode == "audio" and not find_tool("ffmpeg"):
        fail("ffmpeg is not installed. Run scripts/setup/check_dependencies.py --install", 127)

    try:
        video_path = fixupx.download_file(fixupx.pick_mp4_url(video, height), out_dir / "video.mp4")
    except RuntimeError as error:
        fail(str(error))

    if mode == "video":
        print_json({"mode": mode, "files": [str(video_path)]})
        return 0

    audio_path = out_dir / "audio.m4a"
    code, _, stderr = run_command(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video_path), "-vn", "-c:a", "copy", str(audio_path)])

    if code != 0:
        fail(stderr.strip() or "ffmpeg could not extract the audio", code)

    video_path.unlink()
    print_json({"mode": mode, "files": [str(audio_path)]})

    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Download video, audio, or metadata with yt-dlp, or from X through the FixupX API")
    parser.add_argument("url", help="Video URL, YouTube video ID, or X (Twitter) post URL")
    parser.add_argument("--out", "-o", default="./work", help="Output directory (default: ./work)")
    parser.add_argument("--mode", "-m", choices=MODES, default="metadata", help="What to download (default: metadata)")
    parser.add_argument("--height", type=int, default=720, help="Maximum video height for --mode video (default: 720)")
    parser.add_argument("--index", type=int, default=1, help="Which video of an X post with several videos, starting at 1 (default: 1)")
    args = parser.parse_args(argv)
    out_dir = Path(args.out)
    status_id = fixupx.parse_status_id(args.url)

    if status_id:
        out_dir.mkdir(parents=True, exist_ok=True)
        return download_x_post(status_id, out_dir, args.mode, args.height, args.index)

    if not find_tool("yt-dlp"):
        fail("yt-dlp is not installed. Run scripts/setup/check_dependencies.py --install", 127)

    video_id = parse_video_id(args.url)
    url = "https://www.youtube.com/watch?v=%s" % video_id if video_id and "/" not in args.url else args.url
    out_dir.mkdir(parents=True, exist_ok=True)

    code, stdout, stderr = run_command(build_command(url, out_dir, args.mode, args.height))

    if code != 0:
        fail(stderr.strip() or "yt-dlp failed", code)

    if args.mode == "metadata":
        write_metadata(out_dir, args.mode, summarize_metadata(json.loads(stdout)))
        return 0

    produced = sorted(str(path) for path in out_dir.glob("video.*" if args.mode == "video" else "audio.*"))
    print_json({"mode": args.mode, "files": produced})

    return 0


if __name__ == "__main__":
    sys.exit(main())
