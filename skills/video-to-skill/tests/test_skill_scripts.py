"""Tests for validate_skill.py and scaffold_skill.py. Run from the repository root:

    python -m unittest discover -s skills/video-to-skill/tests -v
"""
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL / "scripts" / "validate"))
sys.path.insert(0, str(SKILL / "scripts" / "scaffold"))

import scaffold_skill  # noqa: E402
import validate_skill  # noqa: E402

GOOD = """---
name: demo-skill
description: >-
  Does a demo. Use when the user asks for a demo.
---

# Demo

## Core Rule
Always respond in the user's language, regardless of the language used in this skill.
"""


class ValidateTests(unittest.TestCase):
    def test_parse_frontmatter_handles_folded_and_quoted_values(self):
        fields = validate_skill.parse_frontmatter('name: x\ndescription: >-\n  one\n  two\nlicense: "MIT"\n')
        self.assertEqual(fields, {"name": "x", "description": "one two", "license": "MIT"})

    def test_good_skill_passes(self):
        report = validate_skill.validate_text(GOOD, "demo-skill")
        self.assertEqual(report, {"errors": [], "warnings": []})

    def test_name_must_match_folder_and_format(self):
        self.assertTrue(any("folder name" in e for e in validate_skill.validate_text(GOOD, "other")["errors"]))
        bad = GOOD.replace("name: demo-skill", "name: Demo_Skill")
        self.assertTrue(any("lowercase" in e for e in validate_skill.validate_text(bad, "demo-skill")["errors"]))

    def test_missing_language_rule_and_frontmatter(self):
        no_rule = GOOD.replace("respond in the user's language", "reply politely")
        self.assertTrue(any("Core Rule" in e for e in validate_skill.validate_text(no_rule, "demo-skill")["errors"]))
        self.assertTrue(validate_skill.validate_text("# no frontmatter", "x")["errors"])

    def test_description_limits_and_trigger_warning(self):
        long = GOOD.replace("Does a demo. Use when the user asks for a demo.", "x" * 1030)
        self.assertTrue(any("1024" in e for e in validate_skill.validate_text(long, "demo-skill")["errors"]))
        vague = GOOD.replace("Use when the user asks for a demo.", "Nice.")
        self.assertTrue(validate_skill.validate_text(vague, "demo-skill")["warnings"])

    def test_body_length_and_dashes(self):
        long_body = GOOD + "\nline\n" * 600
        self.assertTrue(any("lines" in e for e in validate_skill.validate_text(long_body, "demo-skill")["errors"]))
        dashed = GOOD + "\nbad — dash\n"
        self.assertTrue(any("dash" in e for e in validate_skill.validate_text(dashed, "demo-skill")["errors"]))

    def test_validate_skill_checks_links_on_disk(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "demo-skill"
            folder.mkdir()
            (folder / "SKILL.md").write_text(GOOD + "\nSee [a](references/a.md) and [web](https://x.dev).\n", encoding="utf-8")
            report = validate_skill.validate_skill(folder)
            self.assertFalse(report["ok"])
            self.assertIn("broken link: references/a.md", report["errors"])
            (folder / "references").mkdir()
            (folder / "references" / "a.md").write_text("x", encoding="utf-8")
            self.assertTrue(validate_skill.validate_skill(folder)["ok"])


class ScaffoldTests(unittest.TestCase):
    def test_title_from_name(self):
        self.assertEqual(scaffold_skill.title_from_name("deploy-to-vercel"), "Deploy to Vercel")

    def test_scaffold_creates_layout_and_passes_validation(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = scaffold_skill.scaffold("deploy-to-vercel", "Deploys apps. Use when the user wants to deploy.", Path(tmp))
            for folder in ("references", "scripts", "assets"):
                self.assertTrue((target / folder).is_dir())
            report = validate_skill.validate_skill(target)
            self.assertTrue(report["ok"], report)

    def test_scaffold_rejects_bad_names_and_existing_folders(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                scaffold_skill.scaffold("Bad Name", "d", Path(tmp))
            scaffold_skill.scaffold("ok-name", "Use when needed.", Path(tmp))
            with self.assertRaises(FileExistsError):
                scaffold_skill.scaffold("ok-name", "Use when needed.", Path(tmp))


if __name__ == "__main__":
    unittest.main()
