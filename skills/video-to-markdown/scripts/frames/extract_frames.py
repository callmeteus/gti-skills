#!/usr/bin/env python3
"""Extract timestamped keyframes from a local video with ffmpeg.

Usage:
    python extract_frames.py video.mp4 --out ./frames
    python extract_frames.py video.mp4 --out ./frames --mode scene --scene-threshold 0.3
    python extract_frames.py video.mp4 --interval 10 --start 60 --end 300 --max 20

Modes:
    interval  one frame every --interval seconds (default)
    scene     one frame whenever the picture changes a lot (slides, code, UI)

Writes frame_0001.jpg, frame_0002.jpg, ... and manifest.json with each frame's time.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.common import fail, find_tool, format_timestamp, print_json, run_command  # noqa: E402

PTS_TIME = re.compile(r"pts_time:([0-9.]+)")


def interval_times(start: float, end: float, interval: float, max_frames: int) -> List[float]:
    """Return the capture times for interval mode, capped at max_frames."""
    times: List[float] = []
    current = start

    while current < end and len(times) < max_frames:
        times.append(round(current, 3))
        current += interval

    return times


def parse_scene_times(showinfo_output: str) -> List[float]:
    """Extract frame times from ffmpeg showinfo log lines."""
    return [float(match.group(1)) for match in PTS_TIME.finditer(showinfo_output)]


def thin_times(times: List[float], max_frames: int) -> List[float]:
    """Evenly thin a sorted list of times down to max_frames entries."""
    if len(times) <= max_frames:
        return times

    step = len(times) / float(max_frames)

    return [times[int(index * step)] for index in range(max_frames)]


def probe_duration(video: str) -> float:
    """Return the video duration in seconds using ffprobe."""
    code, stdout, stderr = run_command([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", video,
    ])

    if code != 0:
        fail(stderr.strip() or "ffprobe failed", code)

    return float(stdout.strip())


def capture(video: str, time: float, target: Path, width: int) -> bool:
    """Capture one frame at a time offset. Returns True on success."""
    code, _, _ = run_command([
        "ffmpeg", "-y", "-loglevel", "error",
        "-ss", "%.3f" % time, "-i", video,
        "-frames:v", "1", "-vf", "scale='min(%d,iw)':-2" % width,
        "-q:v", "3", str(target),
    ])

    return code == 0 and target.is_file()


def detect_scene_times(video: str, threshold: float, start: float, end: float) -> List[float]:
    """Run ffmpeg scene detection and return the change times."""
    command = ["ffmpeg", "-hide_banner", "-nostats"]

    if start > 0:
        command += ["-ss", "%.3f" % start]

    command += ["-i", video, "-t", "%.3f" % max(0.0, end - start)]
    command += ["-vf", "select='gt(scene,%s)',showinfo" % threshold, "-an", "-f", "null", "-"]
    _, _, stderr = run_command(command)

    return [round(start + value, 3) for value in parse_scene_times(stderr)]


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Extract timestamped keyframes with ffmpeg")
    parser.add_argument("video", help="Path to a local video file")
    parser.add_argument("--out", "-o", default="./frames", help="Output directory (default: ./frames)")
    parser.add_argument("--mode", choices=("interval", "scene"), default="interval", help="Extraction mode (default: interval)")
    parser.add_argument("--interval", "-i", type=float, default=20.0, help="Seconds between frames in interval mode (default: 20)")
    parser.add_argument("--scene-threshold", type=float, default=0.3, help="Scene change sensitivity 0-1, lower finds more (default: 0.3)")
    parser.add_argument("--max", "-m", type=int, default=30, help="Maximum number of frames (default: 30)")
    parser.add_argument("--start", type=float, default=0.0, help="Start time in seconds (default: 0)")
    parser.add_argument("--end", type=float, help="End time in seconds (default: end of video)")
    parser.add_argument("--width", type=int, default=1280, help="Maximum frame width in pixels (default: 1280)")
    args = parser.parse_args(argv)

    if not Path(args.video).is_file():
        fail("File not found: %s" % args.video)

    if not find_tool("ffmpeg") or not find_tool("ffprobe"):
        fail("ffmpeg is not installed. Run scripts/setup/check_dependencies.py --install", 127)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    duration = probe_duration(args.video)
    end = min(args.end, duration) if args.end else duration

    if args.mode == "scene":
        times = thin_times(detect_scene_times(args.video, args.scene_threshold, args.start, end), args.max)

        if not times:
            times = interval_times(args.start, end, max(args.interval, end / max(args.max, 1)), args.max)
    else:
        times = interval_times(args.start, end, args.interval, args.max)

    frames: List[Dict[str, object]] = []

    for index, time in enumerate(times, start=1):
        target = out_dir / ("frame_%04d.jpg" % index)

        if capture(args.video, time, target, args.width):
            frames.append({"file": target.name, "time": time, "timestamp": format_timestamp(time)})

    manifest = {"video": args.video, "duration": duration, "mode": args.mode, "frames": frames}
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print_json({"directory": str(out_dir), "count": len(frames), "manifest": str(out_dir / "manifest.json")})

    return 0 if frames else 1


if __name__ == "__main__":
    sys.exit(main())
