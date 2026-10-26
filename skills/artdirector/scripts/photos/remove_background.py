#!/usr/bin/env python3
"""Remove the background from photos with a local segmentation model (rembg). Not generative.

Usage:
    python remove_background.py portrait.jpg
    python remove_background.py a.jpg b.jpg --out ./cutouts
    python remove_background.py portrait.jpg --model birefnet-portrait --install

Writes <name>-cutout.png (transparent, trimmed to the subject) for every input and prints
a JSON list of the files. The first run downloads the model: about 170 MB for the default
isnet-general-use, about 1 GB for birefnet-portrait.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional

MODELS = ("isnet-general-use", "u2net", "u2net_human_seg", "birefnet-portrait", "birefnet-general")
INSTALL = [sys.executable, "-m", "pip", "install", "rembg[cpu]"]


def use_utf8_console() -> None:
    """Write stdout and stderr as UTF-8, so file names with accents do not crash a cp1252 Windows console."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)

        if reconfigure is not None and (stream.encoding or "").lower().replace("-", "") != "utf8":
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, OSError):
                pass


def output_path(source: Path, out_dir: Optional[Path]) -> Path:
    """Return where the cutout of a source image is written."""
    folder = out_dir if out_dir else source.parent

    return folder / (source.stem + "-cutout.png")


def has_rembg() -> bool:
    """Return True when rembg and Pillow can be imported."""
    return importlib.util.find_spec("rembg") is not None and importlib.util.find_spec("PIL") is not None


def install_rembg() -> bool:
    """Install rembg with the CPU runtime. Returns True on success."""
    return subprocess.run(INSTALL).returncode == 0


def cut(sources: List[Path], model: str, out_dir: Optional[Path], trim: bool) -> List[Dict[str, object]]:
    """Cut out every source image and return one record per written file."""
    from PIL import Image
    from rembg import new_session, remove

    session = new_session(model)
    written = []

    for source in sources:
        result = remove(Image.open(source).convert("RGB"), session=session)

        if trim and result.getbbox():
            result = result.crop(result.getbbox())

        target = output_path(source, out_dir)
        target.parent.mkdir(parents=True, exist_ok=True)
        result.save(target, optimize=True)
        written.append({"source": str(source), "cutout": str(target), "width": result.width, "height": result.height})

    return written


def main(argv: Optional[List[str]] = None) -> int:
    use_utf8_console()
    parser = argparse.ArgumentParser(description="Remove photo backgrounds locally with rembg")
    parser.add_argument("images", nargs="+", help="Image files")
    parser.add_argument("--out", "-o", help="Folder for the cutouts (default: next to each source)")
    parser.add_argument("--model", "-m", choices=MODELS, default="isnet-general-use", help="Segmentation model (default: isnet-general-use)")
    parser.add_argument("--install", action="store_true", help="Install rembg first when it is missing")
    parser.add_argument("--no-trim", action="store_true", help="Keep the original canvas instead of trimming to the subject")
    args = parser.parse_args(argv)

    sources = [Path(item) for item in args.images]
    missing = [str(item) for item in sources if not item.is_file()]

    if missing:
        sys.stderr.write("Error: file not found: %s\n" % ", ".join(missing))
        return 1

    if not has_rembg():
        if not args.install:
            sys.stderr.write("Error: rembg is not installed. Rerun with --install, or run: %s\n" % " ".join(INSTALL))
            return 127

        if not install_rembg():
            sys.stderr.write("Error: could not install rembg.\n")
            return 1

    written = cut(sources, args.model, Path(args.out) if args.out else None, not args.no_trim)
    sys.stdout.write(json.dumps(written, indent=2, ensure_ascii=False) + "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
