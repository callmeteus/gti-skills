#!/usr/bin/env python3
"""Transcribe a local audio or video file with Whisper when a video has no captions.

Usage:
    python transcribe_audio.py audio.m4a --out transcript.json
    python transcribe_audio.py video.mp4 --model small --language pt

Uses mlx-whisper on Apple Silicon and openai-whisper everywhere else.
Writes the same JSON shape as get_transcript.py --format json.
"""
from __future__ import annotations

import argparse
import json
import platform
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.common import build_transcript, fail, print_json  # noqa: E402

MLX_MODELS = {
    "tiny": "mlx-community/whisper-tiny-mlx",
    "base": "mlx-community/whisper-base-mlx",
    "small": "mlx-community/whisper-small-mlx",
    "medium": "mlx-community/whisper-medium-mlx",
    "large": "mlx-community/whisper-large-v3-mlx",
}


def segments_to_entries(segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert Whisper segments (start, end, text) to transcript entries."""
    return [
        {
            "start": segment["start"],
            "duration": max(0.0, float(segment["end"]) - float(segment["start"])),
            "text": segment["text"],
        }
        for segment in segments
    ]


def use_mlx() -> bool:
    """Return True on Apple Silicon."""
    return platform.system() == "Darwin" and platform.machine() == "arm64"


def transcribe(path: str, model: str, language: Optional[str]) -> Dict[str, Any]:
    """Run Whisper and return a transcript JSON object."""
    if use_mlx():
        import mlx_whisper

        options: Dict[str, Any] = {"path_or_hf_repo": MLX_MODELS.get(model, model)}

        if language:
            options["language"] = language

        output = mlx_whisper.transcribe(path, **options)
    else:
        import whisper

        loaded = whisper.load_model(model)
        output = loaded.transcribe(path, language=language) if language else loaded.transcribe(path)

    return build_transcript(segments_to_entries(output["segments"]), output.get("language", language or "unknown"), "whisper")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Transcribe audio or video with Whisper")
    parser.add_argument("media", help="Path to an audio or video file")
    parser.add_argument("--model", default="base", help="Whisper model: tiny, base, small, medium, large (default: base)")
    parser.add_argument("--language", help="Spoken language code, e.g. en. Auto-detected when omitted")
    parser.add_argument("--out", "-o", help="Write JSON to a file instead of stdout")
    args = parser.parse_args(argv)

    if not Path(args.media).is_file():
        fail("File not found: %s" % args.media)

    try:
        result = transcribe(args.media, args.model, args.language)
    except ImportError:
        fail("Whisper is not installed. Run scripts/setup/check_dependencies.py --install --with-whisper", 127)

    if args.out:
        Path(args.out).write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        print_json({"file": args.out, "language": result["language"], "segments": len(result["timestamped"])})
    else:
        print_json(result)

    return 0


if __name__ == "__main__":
    sys.exit(main())
