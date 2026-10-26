#!/usr/bin/env python3
"""Search openly licensed photos on Openverse and optionally download them with credits.

Usage:
    python find_photos.py "smiling woman guitar"
    python find_photos.py "city at night" --license cc0,pdm --aspect tall --limit 20
    python find_photos.py "red sneakers" --download ./photos

Prints a JSON list of candidates (title, creator, license, source page, image URL, size).
With --download, saves each image into the folder and writes credits.json next to them.
Uses only the Python standard library.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

API = "https://api.openverse.org/v1/images/"
USER_AGENT = "gti-skills-artdirector/1.0 (+https://github.com/callmeteus/gti-skills)"
LICENSES = ("cc0", "pdm", "by", "by-sa")
ASPECTS = ("tall", "wide", "square")


def use_utf8_console() -> None:
    """Write stdout and stderr as UTF-8, so titles with emoji do not crash a cp1252 Windows console."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)

        if reconfigure is not None and (stream.encoding or "").lower().replace("-", "") != "utf8":
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, OSError):
                pass


def build_query_url(query: str, licenses: List[str], limit: int, aspect: Optional[str] = None, source: Optional[str] = None) -> str:
    """Build the Openverse search URL."""
    params = {
        "q": query,
        "license": ",".join(licenses),
        "page_size": str(max(1, min(limit, 50))),
        "mature": "false",
    }

    if aspect:
        params["aspect_ratio"] = aspect

    if source:
        params["source"] = source

    return API + "?" + urllib.parse.urlencode(params)


def parse_results(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Keep the fields needed to pick a photo and credit it."""
    results = []

    for item in data.get("results", []):
        if not item.get("url"):
            continue

        results.append({
            "id": item.get("id"),
            "title": item.get("title") or "untitled",
            "creator": item.get("creator") or "unknown",
            "license": item.get("license"),
            "licenseUrl": item.get("license_url"),
            "source": item.get("source"),
            "landing": item.get("foreign_landing_url"),
            "url": item.get("url"),
            "thumbnail": item.get("thumbnail"),
            "width": item.get("width"),
            "height": item.get("height"),
        })

    return results


def slugify(text: str, fallback: str = "photo") -> str:
    """Turn a title into a short, safe file name stem."""
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")

    return slug[:48].strip("-") or fallback


def extension_from_url(url: str) -> str:
    """Guess the image extension from a URL, defaulting to .jpg."""
    path = urllib.parse.urlparse(url).path.lower()

    for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        if path.endswith(ext):
            return ".jpg" if ext == ".jpeg" else ext

    return ".jpg"


def fetch(url: str) -> bytes:
    """Download a URL with the tool's user agent."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})

    with urllib.request.urlopen(request, timeout=40) as response:
        return response.read()


def download(results: List[Dict[str, Any]], folder: Path) -> List[Dict[str, Any]]:
    """Save every result into the folder and write credits.json. Returns the credited entries."""
    folder.mkdir(parents=True, exist_ok=True)
    credits = []

    for index, item in enumerate(results, start=1):
        name = "%02d-%s%s" % (index, slugify(item["title"]), extension_from_url(item["url"]))

        try:
            (folder / name).write_bytes(fetch(item["url"]))
        except Exception as error:  # network errors differ per platform
            sys.stderr.write("Skipped %s: %s\n" % (item["url"], error))
            continue

        credits.append({"file": name, **item})

    (folder / "credits.json").write_text(json.dumps(credits, indent=2, ensure_ascii=False), encoding="utf-8")

    return credits


def main(argv: Optional[List[str]] = None) -> int:
    use_utf8_console()
    parser = argparse.ArgumentParser(description="Search openly licensed photos on Openverse")
    parser.add_argument("query", help="What the photo should show, in English for best results")
    parser.add_argument("--license", default="cc0", help="Comma separated: cc0, pdm, by, by-sa (default: cc0)")
    parser.add_argument("--limit", type=int, default=12, help="Number of results, 1 to 50 (default: 12)")
    parser.add_argument("--aspect", choices=ASPECTS, help="Prefer tall, wide, or square photos")
    parser.add_argument("--source", help="Restrict to one provider, for example stocksnap or wikimedia")
    parser.add_argument("--download", metavar="DIR", help="Save the images and credits.json into this folder")
    args = parser.parse_args(argv)

    licenses = [item.strip() for item in args.license.split(",") if item.strip()]
    unknown = [item for item in licenses if item not in LICENSES]

    if unknown:
        sys.stderr.write("Error: unknown license %s. Use %s.\n" % (", ".join(unknown), ", ".join(LICENSES)))
        return 1

    try:
        data = json.loads(fetch(build_query_url(args.query, licenses, args.limit, args.aspect, args.source)))
    except Exception as error:  # network errors differ per platform
        sys.stderr.write("Error: search failed: %s\n" % error)
        return 1

    results = parse_results(data)

    if args.download:
        results = download(results, Path(args.download))

    sys.stdout.write(json.dumps(results, indent=2, ensure_ascii=False) + "\n")

    return 0 if results else 2


if __name__ == "__main__":
    sys.exit(main())
