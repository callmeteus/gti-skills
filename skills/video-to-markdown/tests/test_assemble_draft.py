"""Tests for assemble_draft.py. Run from the repository root:

    python -m unittest discover -s skills/video-to-markdown/tests -v
"""
import sys
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL / "scripts"))
sys.path.insert(0, str(SKILL / "scripts" / "render"))

import assemble_draft  # noqa: E402

ENTRIES = [
    {"start": 0.0, "duration": 4.0, "text": "Welcome"},
    {"start": 30.0, "duration": 4.0, "text": "First topic\nstarts"},
    {"start": 130.0, "duration": 4.0, "text": "Second topic"},
]
FRAMES = [{"file": "frame_0001.jpg", "time": 31.0}, {"file": "frame_0002.jpg", "time": 131.0}]


class AssembleDraftTests(unittest.TestCase):
    def test_window_sections_cover_the_video(self):
        sections = assemble_draft.window_sections(250, 120)
        self.assertEqual([(s["start"], s["end"]) for s in sections], [(0, 120), (120, 240), (240, 250)])

    def test_chapter_sections_use_next_start_as_end(self):
        sections = assemble_draft.chapter_sections(
            [{"title": "A", "start": 0}, {"title": "B", "start": 100}], 200
        )
        self.assertEqual([(s["title"], s["start"], s["end"]) for s in sections], [("A", 0.0, 100.0), ("B", 100.0, 200.0)])

    def test_build_sections_assigns_text_and_frames(self):
        sections = assemble_draft.build_sections(ENTRIES, FRAMES, [], 200, 120)
        self.assertEqual(sections[0]["text"], "Welcome First topic starts")
        self.assertEqual([f["file"] for f in sections[0]["frames"]], ["frame_0001.jpg"])
        self.assertEqual(sections[1]["text"], "Second topic")
        self.assertEqual([f["file"] for f in sections[1]["frames"]], ["frame_0002.jpg"])

    def test_render_markdown_has_frontmatter_links_and_frames(self):
        sections = assemble_draft.build_sections(ENTRIES, FRAMES, [], 200, 120)
        markdown = assemble_draft.render_markdown(
            sections, "abc", {"title": 'He said "hi"', "channel": "Ch", "duration_seconds": 200}, "frames"
        )
        self.assertTrue(markdown.startswith('---\ntitle: "He said \'hi\'"'))
        self.assertIn('duration: "03:20"', markdown)
        self.assertIn("## [00:00](https://youtu.be/abc?t=0) Part 1", markdown)
        self.assertIn("## [02:00](https://youtu.be/abc?t=120) Part 2", markdown)
        self.assertIn("![Frame at 00:31](frames/frame_0001.jpg)", markdown)
        self.assertIn("> Welcome First topic starts", markdown)
        self.assertIn(assemble_draft.DRAFT_NOTICE, markdown)

    def test_empty_transcript_still_renders(self):
        markdown = assemble_draft.render_markdown(assemble_draft.build_sections([], [], [], 60, 120), "abc", {}, "frames")
        self.assertIn("# Video notes", markdown)


if __name__ == "__main__":
    unittest.main()
