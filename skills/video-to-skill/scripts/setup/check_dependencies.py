#!/usr/bin/env python3
"""Check and optionally install everything the video skills need.

Usage:
    python check_dependencies.py            # report status as JSON, change nothing
    python check_dependencies.py --install  # install what is missing
    python check_dependencies.py --install --with-whisper
"""
from __future__ import annotations

import argparse
import importlib.util
import os
import platform
import sys
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.common import find_tool, print_json, run_command  # noqa: E402

PYTHON_PACKAGES = {
    "youtube_transcript_api": "youtube-transcript-api>=1.0",
}

SYSTEM_TOOLS = ("yt-dlp", "ffmpeg", "ffprobe")

SYSTEM_PACKAGES = {
    "Darwin": {"manager": "brew", "yt-dlp": ["yt-dlp"], "ffmpeg": ["ffmpeg"]},
    "Windows": {
        "manager": "winget",
        "yt-dlp": ["yt-dlp.yt-dlp"],
        "ffmpeg": ["Gyan.FFmpeg"],
    },
}

LINUX_MANAGERS = ("apt-get", "dnf", "pacman")


def whisper_package(system: str, machine: str) -> str:
    """Pick the Whisper build for the platform: MLX on Apple Silicon, OpenAI elsewhere."""
    if system == "Darwin" and machine == "arm64":
        return "mlx-whisper"

    return "openai-whisper"


def whisper_module(package: str) -> str:
    """Return the import name for a Whisper package."""
    return "mlx_whisper" if package == "mlx-whisper" else "whisper"


def has_module(name: str) -> bool:
    """Return True when a Python module can be imported."""
    return importlib.util.find_spec(name) is not None


def collect_status(system: str, machine: str) -> Dict[str, object]:
    """Report which dependencies are present."""
    whisper = whisper_package(system, machine)

    return {
        "platform": "%s/%s" % (system, machine),
        "python": platform.python_version(),
        "tools": {name: bool(find_tool(name)) for name in SYSTEM_TOOLS},
        "python_packages": {
            package.split(">=")[0]: has_module(module) for module, package in PYTHON_PACKAGES.items()
        },
        "whisper": {"package": whisper, "installed": has_module(whisper_module(whisper))},
    }


def plan_system_install(system: str, missing: List[str], available: Dict[str, bool], is_root: bool) -> List[List[str]]:
    """Return the commands that install the missing system tools.

    `available` maps a package manager command to whether it exists on PATH.
    ffprobe ships with ffmpeg, so it never gets its own package.
    """
    wanted = sorted({"ffmpeg" if name == "ffprobe" else name for name in missing})

    if not wanted:
        return []

    if system in SYSTEM_PACKAGES:
        spec = SYSTEM_PACKAGES[system]
        manager = str(spec["manager"])

        if not available.get(manager):
            return []

        commands = []

        for name in wanted:
            for package in spec[name]:
                if manager == "winget":
                    commands.append(["winget", "install", "--id", package, "-e", "--source", "winget"])
                else:
                    commands.append([manager, "install", package])

        return commands

    prefix = [] if is_root else ["sudo"]

    for manager in LINUX_MANAGERS:
        if not available.get(manager):
            continue

        if manager == "apt-get":
            return [prefix + ["apt-get", "install", "-y"] + wanted]

        if manager == "dnf":
            return [prefix + ["dnf", "install", "-y"] + wanted]

        return [prefix + ["pacman", "-S", "--noconfirm"] + wanted]

    return []


def install(system: str, machine: str, with_whisper: bool) -> List[Dict[str, object]]:
    """Install missing dependencies and return one result per command."""
    results: List[Dict[str, object]] = []
    status = collect_status(system, machine)

    missing_packages = [
        PYTHON_PACKAGES[module]
        for module in PYTHON_PACKAGES
        if not has_module(module)
    ]

    if with_whisper and not status["whisper"]["installed"]:  # type: ignore[index]
        missing_packages.append(str(status["whisper"]["package"]))  # type: ignore[index]

    if missing_packages:
        command = [sys.executable, "-m", "pip", "install", "--upgrade"] + missing_packages
        code, _, err = run_command(command)
        results.append({"command": command, "ok": code == 0, "error": err.strip() if code else ""})

    missing_tools = [name for name, ok in status["tools"].items() if not ok]  # type: ignore[union-attr]
    managers = ["brew", "winget", "choco"] + list(LINUX_MANAGERS) + ["sudo"]
    available = {name: bool(find_tool(name)) for name in managers}
    is_root = hasattr(os, "geteuid") and os.geteuid() == 0

    for command in plan_system_install(system, missing_tools, available, is_root):
        code, _, err = run_command(command)
        results.append({"command": command, "ok": code == 0, "error": err.strip() if code else ""})

    return results


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Check and install dependencies for the video skills")
    parser.add_argument("--install", action="store_true", help="Install missing dependencies")
    parser.add_argument("--with-whisper", action="store_true", help="Also install Whisper for videos without captions")
    args = parser.parse_args(argv)

    system = platform.system()
    machine = platform.machine()
    report: Dict[str, object] = {"before": collect_status(system, machine)}

    if args.install:
        report["install"] = install(system, machine, args.with_whisper)
        report["after"] = collect_status(system, machine)

    print_json(report)
    final = report.get("after", report["before"])
    required_ok = all(final["tools"].values()) and all(final["python_packages"].values())  # type: ignore[index,union-attr]

    return 0 if required_ok else 1


if __name__ == "__main__":
    sys.exit(main())
