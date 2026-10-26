#!/usr/bin/env python3
"""Create a new skill folder with the standard subfolder layout.

Usage:
    python scaffold_skill.py deploy-to-vercel --description "Deploys ... Use when ..." --out ./skills

Creates:
    <out>/<name>/
    ├── SKILL.md         from assets/templates/SKILL.template.md
    ├── references/      detailed docs loaded on demand
    ├── scripts/         executable helpers
    └── assets/          templates and static files

Refuses to overwrite an existing folder.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import List, Optional

TEMPLATE = Path(__file__).resolve().parents[2] / "assets" / "templates" / "SKILL.template.md"
NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SUBFOLDERS = ("references", "scripts", "assets")


def title_from_name(name: str) -> str:
    """Turn deploy-to-vercel into Deploy to Vercel (short connecting words stay lowercase)."""
    small = {"to", "from", "and", "of", "for", "the", "a", "in", "on"}
    words = name.split("-")

    return " ".join(word if index and word in small else word.capitalize() for index, word in enumerate(words))


def render_template(template: str, name: str, description: str) -> str:
    """Fill the placeholders of the SKILL.md template."""
    folded = "\n".join("  " + line for line in description.strip().splitlines())

    return (
        template.replace("{{name}}", name)
        .replace("{{title}}", title_from_name(name))
        .replace("{{description}}", folded)
    )


def scaffold(name: str, description: str, out: Path) -> Path:
    """Create the skill folder and return its path."""
    if not NAME_PATTERN.match(name) or len(name) > 64:
        raise ValueError("name must be kebab-case (lowercase letters, digits, single hyphens), max 64 characters")

    target = out / name

    if target.exists():
        raise FileExistsError("%s already exists" % target)

    target.mkdir(parents=True)

    for folder in SUBFOLDERS:
        (target / folder).mkdir()
        (target / folder / ".gitkeep").write_text("", encoding="utf-8")

    (target / "SKILL.md").write_text(render_template(TEMPLATE.read_text(encoding="utf-8"), name, description), encoding="utf-8")

    return target


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Create a skill folder with the standard layout")
    parser.add_argument("name", help="Skill name in kebab-case, for example deploy-to-vercel")
    parser.add_argument("--description", "-d", required=True, help="What the skill does and when to use it (max 1024 characters)")
    parser.add_argument("--out", "-o", default=".", help="Directory that will contain the skill folder (default: current directory)")
    args = parser.parse_args(argv)

    try:
        target = scaffold(args.name, args.description, Path(args.out))
    except (ValueError, FileExistsError) as error:
        sys.stderr.write("Error: %s\n" % error)
        return 1

    sys.stdout.write(json.dumps({"skill": str(target), "files": ["SKILL.md"] + ["%s/" % folder for folder in SUBFOLDERS]}, indent=2) + "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
