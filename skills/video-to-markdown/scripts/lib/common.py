"""Shared helpers for the video skills (Python 3.8+, standard library only)."""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from typing import Any, Dict, List, Optional, Sequence, Tuple

def use_utf8_console() -> None:
    """Write stdout and stderr as UTF-8, so titles with emoji do not crash a cp1252 Windows console."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)

        if reconfigure is not None and (stream.encoding or "").lower().replace("-", "") != "utf8":
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, OSError):
                pass


use_utf8_console()

VIDEO_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{11}$")

URL_ID_PATTERNS = (
    re.compile(r"(?:youtube\.com/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})"),
    re.compile(r"youtu\.be/([A-Za-z0-9_-]{11})"),
    re.compile(r"youtube\.com/(?:embed|shorts|live|v)/([A-Za-z0-9_-]{11})"),
)


def parse_video_id(value: str) -> Optional[str]:
    """Return the 11 character YouTube video ID for a URL or a bare ID, else None."""
    value = value.strip()

    if VIDEO_ID_PATTERN.match(value):
        return value

    for pattern in URL_ID_PATTERNS:
        match = pattern.search(value)

        if match:
            return match.group(1)

    return None


def format_timestamp(seconds: float) -> str:
    """Format seconds as MM:SS, or H:MM:SS when the value reaches one hour."""
    total = int(max(0, seconds))
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)

    if hours:
        return "%d:%02d:%02d" % (hours, minutes, secs)

    return "%02d:%02d" % (minutes, secs)


def parse_timestamp(value: str) -> float:
    """Parse SS, MM:SS, or H:MM:SS into seconds. Raises ValueError on bad input."""
    parts = value.strip().split(":")

    if not 1 <= len(parts) <= 3:
        raise ValueError("Invalid timestamp: %r" % value)

    seconds = 0.0

    for part in parts:
        seconds = seconds * 60 + float(part)

    return seconds


def timestamp_url(video_id: str, seconds: float) -> str:
    """Build a link that opens the YouTube video at the given second."""
    return "https://youtu.be/%s?t=%d" % (video_id, int(max(0, seconds)))


def find_tool(name: str) -> Optional[str]:
    """Return the absolute path of an executable on PATH, or None."""
    return shutil.which(name)


def run_command(command: Sequence[str], timeout: Optional[int] = None) -> Tuple[int, str, str]:
    """Run a command without a shell and return (exit code, stdout, stderr)."""
    try:
        result = subprocess.run(
            list(command),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
    except FileNotFoundError:
        return 127, "", "Command not found: %s" % command[0]
    except subprocess.TimeoutExpired:
        return 124, "", "Command timed out: %s" % " ".join(command)

    return result.returncode, result.stdout, result.stderr


def print_json(data: Any) -> None:
    """Print data as indented UTF-8 JSON on stdout."""
    sys.stdout.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def fail(message: str, code: int = 1) -> "None":
    """Print an error on stderr and exit."""
    sys.stderr.write("Error: %s\n" % message)
    sys.exit(code)


def build_transcript(entries: List[Dict[str, Any]], language: str, source: str) -> Dict[str, Any]:
    """Build the transcript JSON shape shared by every transcript script.

    Each entry needs `start`, `duration`, and `text`. The result always contains
    `text` (joined), `timestamped` (the entries), `language`, and `source`.
    """
    cleaned = [
        {
            "start": round(float(entry["start"]), 3),
            "duration": round(float(entry.get("duration", 0.0)), 3),
            "text": str(entry["text"]).strip(),
        }
        for entry in entries
        if str(entry.get("text", "")).strip()
    ]

    return {
        "text": "\n".join(entry["text"] for entry in cleaned),
        "timestamped": cleaned,
        "language": language,
        "source": source,
    }
