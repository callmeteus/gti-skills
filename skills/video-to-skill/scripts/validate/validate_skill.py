#!/usr/bin/env python3
"""Validate a generated skill folder against the Agent Skills standard and the GTI rules.

Usage:
    python validate_skill.py path/to/skill-name
    python validate_skill.py path/to/skill-name/SKILL.md

Checks (errors fail the run, warnings do not):
    - SKILL.md exists and starts with YAML frontmatter
    - name: lowercase letters, digits, single hyphens, max 64, equals the folder name
    - description: 1 to 1024 characters, mentions when to use the skill
    - body is at most 500 lines
    - the "respond in the user's language" Core Rule is present
    - every relative Markdown link points to a file that exists
    - no em dash or en dash characters

Prints a JSON report and exits 1 when there are errors.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LINK_PATTERN = re.compile(r"\]\(([^)\s]+)\)")
LANGUAGE_RULE = re.compile(r"respond in the user'?s language", re.IGNORECASE)
MAX_BODY_LINES = 500


def split_frontmatter(text: str) -> Tuple[Optional[str], str]:
    """Split a SKILL.md into (frontmatter block, body). Frontmatter is None when absent."""
    match = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n?(.*)$", text, re.DOTALL)

    if not match:
        return None, text

    return match.group(1), match.group(2)


def parse_frontmatter(block: str) -> Dict[str, str]:
    """Parse top-level scalar keys of a frontmatter block, including folded and literal blocks."""
    result: Dict[str, str] = {}
    lines = block.splitlines()
    index = 0

    while index < len(lines):
        line = lines[index]
        match = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        index += 1

        if not match:
            continue

        key, value = match.group(1), match.group(2).strip()

        if value in (">", ">-", ">+", "|", "|-", "|+"):
            folded = value.startswith(">")
            collected: List[str] = []

            while index < len(lines) and (lines[index].startswith((" ", "\t")) or not lines[index].strip()):
                collected.append(lines[index].strip())
                index += 1

            value = (" " if folded else "\n").join(part for part in collected if part)
        elif len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]

        result[key] = value

    return result


def validate_text(text: str, folder_name: str) -> Dict[str, List[str]]:
    """Validate SKILL.md text and return {errors, warnings}."""
    errors: List[str] = []
    warnings: List[str] = []
    block, body = split_frontmatter(text)

    if block is None:
        return {"errors": ["SKILL.md must start with YAML frontmatter between --- lines"], "warnings": []}

    fields = parse_frontmatter(block)
    name = fields.get("name", "")
    description = fields.get("description", "")

    if not name:
        errors.append("frontmatter is missing name")
    elif not NAME_PATTERN.match(name) or len(name) > 64:
        errors.append("name %r must be lowercase letters, digits, and single hyphens, max 64 characters" % name)
    elif name != folder_name:
        errors.append("name %r must equal the folder name %r" % (name, folder_name))

    if not description:
        errors.append("frontmatter is missing description")
    elif len(description) > 1024:
        errors.append("description is %d characters, the limit is 1024" % len(description))
    elif not re.search(r"\buse (this skill )?(when|for)\b", description, re.IGNORECASE):
        warnings.append("description should say when to use the skill, for example 'Use when ...'")

    body_lines = len(body.splitlines())

    if body_lines > MAX_BODY_LINES:
        errors.append("body is %d lines, keep SKILL.md under %d and move detail to references/" % (body_lines, MAX_BODY_LINES))

    if not LANGUAGE_RULE.search(body):
        errors.append("missing the Core Rule: always respond in the user's language")

    if re.search("[–—]", text):
        errors.append("remove em dash and en dash characters, use a hyphen")

    return {"errors": errors, "warnings": warnings}


def check_links(skill_dir: Path, text: str) -> List[str]:
    """Return an error for every relative link that does not resolve."""
    errors = []
    without_code = re.sub(r"`[^`\n]*`", "", re.sub(r"```.*?```", "", text, flags=re.DOTALL))

    for link in LINK_PATTERN.findall(without_code):
        if re.match(r"^[a-z][a-z0-9+.-]*:", link) or link.startswith("#"):
            continue

        target = link.split("#")[0]

        if target and not (skill_dir / target).exists():
            errors.append("broken link: %s" % link)

    return errors


def validate_skill(path: Path) -> Dict[str, object]:
    """Validate a skill folder or SKILL.md path."""
    skill_file = path if path.is_file() else path / "SKILL.md"
    skill_dir = skill_file.parent

    if not skill_file.is_file():
        return {"ok": False, "skill": str(skill_dir), "errors": ["SKILL.md not found in %s" % skill_dir], "warnings": []}

    text = skill_file.read_text(encoding="utf-8")
    report = validate_text(text, skill_dir.name)
    report["errors"] += check_links(skill_dir, text)

    return {"ok": not report["errors"], "skill": str(skill_dir), **report}


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Validate a skill folder")
    parser.add_argument("path", help="Skill folder or SKILL.md path")
    args = parser.parse_args(argv)
    report = validate_skill(Path(args.path))
    sys.stdout.write(json.dumps(report, indent=2) + "\n")

    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
