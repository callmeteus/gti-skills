"""X (Twitter) video support through the FixupX / FxTwitter status API (standard library only).

The API returns a post as JSON, including direct MP4 links for its videos:
    GET https://api.fxtwitter.com/status/<id>

Set FIXUPX_API_BASE to use another instance of the same API.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_API_BASE = "https://api.fxtwitter.com"
USER_AGENT = "gti-skills-video-toolkit/1.0"
TIMEOUT_SECONDS = 30

STATUS_PATTERN = re.compile(
    r"^(?:https?://)?(?:www\.|mobile\.|m\.|d\.)?"
    r"(?:twitter|x|fixupx|fxtwitter|vxtwitter|fixvx)\.com/"
    r"(?:[A-Za-z0-9_]{1,15}|i(?:/web)?)/status(?:es)?/(\d{1,20})",
    re.IGNORECASE,
)

SIZE_PATTERN = re.compile(r"/(\d{2,5})x(\d{2,5})/")


def parse_status_id(value: str) -> Optional[str]:
    """Return the post ID of an X, Twitter, FixupX, or FxTwitter status URL, else None."""
    match = STATUS_PATTERN.match(value.strip())

    return match.group(1) if match else None


def api_base() -> str:
    """Return the API base URL, honoring FIXUPX_API_BASE."""
    return (os.environ.get("FIXUPX_API_BASE") or DEFAULT_API_BASE).rstrip("/")


def fetch_status(status_id: str) -> Dict[str, Any]:
    """Fetch a post from the API and return its `tweet` object. Raises LookupError or RuntimeError."""
    url = "%s/status/%s" % (api_base(), status_id)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})

    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        try:
            payload = json.loads(error.read().decode("utf-8"))
        except ValueError:
            raise RuntimeError("API request failed with HTTP %d: %s" % (error.code, url))
    except (urllib.error.URLError, OSError) as error:
        raise RuntimeError("Could not reach %s: %s" % (url, getattr(error, "reason", error)))
    except ValueError:
        raise RuntimeError("API returned invalid JSON: %s" % url)

    tweet = payload.get("tweet")

    if payload.get("code") != 200 or not tweet:
        message = payload.get("message") or "unknown error"
        raise LookupError("Post %s is unavailable (%s). It may be private, deleted, or age-restricted." % (status_id, message))

    return tweet


def list_videos(tweet: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return the videos and GIFs of a post, in post order."""
    media = tweet.get("media") or {}

    return [item for item in (media.get("videos") or []) if item.get("url")]


def format_height(item: Dict[str, Any]) -> int:
    """Read a format's height from its fields or from the WxH segment of its URL."""
    if item.get("height"):
        return int(item["height"])

    match = SIZE_PATTERN.search(str(item.get("url", "")))

    return int(match.group(2)) if match else 0


def pick_mp4_url(video: Dict[str, Any], max_height: int) -> str:
    """Pick the highest MP4 at or below max_height, else the smallest MP4, else the default URL."""
    candidates = [
        item for item in (video.get("formats") or [])
        if item.get("container") == "mp4" and item.get("url")
    ]

    if not candidates:
        return str(video["url"])

    fitting = [item for item in candidates if format_height(item) <= max_height]

    if fitting:
        best = max(fitting, key=lambda item: (format_height(item), item.get("bitrate") or 0))
    else:
        best = min(candidates, key=lambda item: (format_height(item), item.get("bitrate") or 0))

    return str(best["url"])


def summarize_status(tweet: Dict[str, Any], video: Dict[str, Any], index: int, count: int) -> Dict[str, Any]:
    """Map a post and one of its videos to the metadata shape the skills use."""
    author = tweet.get("author") or {}
    text = str(tweet.get("text") or "")
    first_line = text.strip().splitlines()[0] if text.strip() else ""
    title = first_line[:100] or "Video by @%s" % author.get("screen_name", "unknown")
    channel = author.get("name") or author.get("screen_name")

    if author.get("screen_name") and author.get("name"):
        channel = "%s (@%s)" % (author["name"], author["screen_name"])

    upload_date = None

    if tweet.get("created_timestamp"):
        upload_date = datetime.fromtimestamp(int(tweet["created_timestamp"]), tz=timezone.utc).strftime("%Y%m%d")

    return {
        "id": str(tweet.get("id")),
        "title": title,
        "channel": channel,
        "duration_seconds": video.get("duration"),
        "upload_date": upload_date,
        "webpage_url": tweet.get("url"),
        "chapters": [],
        "description": text[:2000],
        "platform": "x",
        "video_index": index,
        "video_count": count,
        "thumbnail_url": video.get("thumbnail_url"),
    }


def download_file(url: str, target: Path) -> Path:
    """Stream a URL to a file and return the file path."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_name(target.name + ".part")

    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response, partial.open("wb") as handle:
            shutil.copyfileobj(response, handle, 1024 * 1024)
    except (urllib.error.URLError, OSError) as error:
        if partial.exists():
            partial.unlink()

        raise RuntimeError("Download failed for %s: %s" % (url, getattr(error, "reason", error)))

    partial.replace(target)

    return target
