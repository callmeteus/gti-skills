"""Tests for the Art Director photo scripts. Run from the repository root:

    python -m unittest discover -s skills/artdirector/tests -v
"""
import json
import sys
import tempfile
import unittest
import urllib.parse
from pathlib import Path
from unittest import mock

SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL / "scripts" / "photos"))

import find_photos  # noqa: E402
import remove_background  # noqa: E402


class FindPhotosTests(unittest.TestCase):
    def test_build_query_url(self):
        url = find_photos.build_query_url("red shoes", ["cc0", "pdm"], 80, "tall", "stocksnap")
        query = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(url).query))
        self.assertEqual(query["q"], "red shoes")
        self.assertEqual(query["license"], "cc0,pdm")
        self.assertEqual(query["page_size"], "50")
        self.assertEqual(query["aspect_ratio"], "tall")
        self.assertEqual(query["source"], "stocksnap")
        self.assertEqual(query["mature"], "false")

    def test_parse_results_keeps_credit_fields_and_skips_missing_urls(self):
        results = find_photos.parse_results({"results": [
            {"id": "1", "title": "Shoes", "creator": "Ana", "license": "cc0", "url": "https://x/a.jpg", "foreign_landing_url": "https://x/a"},
            {"id": "2", "title": "No url"},
            {"id": "3", "url": "https://x/b.png"},
        ]})
        self.assertEqual([item["id"] for item in results], ["1", "3"])
        self.assertEqual(results[0]["landing"], "https://x/a")
        self.assertEqual(results[1]["title"], "untitled")
        self.assertEqual(results[1]["creator"], "unknown")

    def test_slugify_and_extension(self):
        self.assertEqual(find_photos.slugify("Mulher Sorrindo, com Violão!"), "mulher-sorrindo-com-viol-o")
        self.assertEqual(find_photos.slugify("!!!"), "photo")
        self.assertEqual(find_photos.extension_from_url("https://x/a.JPEG?w=1"), ".jpg")
        self.assertEqual(find_photos.extension_from_url("https://x/a.webp"), ".webp")
        self.assertEqual(find_photos.extension_from_url("https://x/download?id=3"), ".jpg")

    def test_download_writes_files_and_credits(self):
        results = [{"title": "Red shoes", "url": "https://x/a.png", "creator": "Ana"}]
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(find_photos, "fetch", return_value=b"png"):
            credits = find_photos.download(results, Path(tmp))
            self.assertEqual(credits[0]["file"], "01-red-shoes.png")
            self.assertEqual((Path(tmp) / "01-red-shoes.png").read_bytes(), b"png")
            self.assertEqual(json.loads((Path(tmp) / "credits.json").read_text(encoding="utf-8"))[0]["creator"], "Ana")

    def test_rejects_unknown_license(self):
        self.assertEqual(find_photos.main(["x", "--license", "all-rights-reserved"]), 1)


class RemoveBackgroundTests(unittest.TestCase):
    def test_output_path(self):
        self.assertEqual(remove_background.output_path(Path("a/b/photo.jpg"), None), Path("a/b/photo-cutout.png"))
        self.assertEqual(remove_background.output_path(Path("a/photo.jpg"), Path("out")), Path("out/photo-cutout.png"))

    def test_missing_file_fails(self):
        self.assertEqual(remove_background.main(["definitely-missing.jpg"]), 1)

    def test_asks_for_install_when_rembg_is_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            image = Path(tmp) / "p.jpg"
            image.write_bytes(b"jpg")
            with mock.patch.object(remove_background, "has_rembg", return_value=False):
                self.assertEqual(remove_background.main([str(image)]), 127)
                with mock.patch.object(remove_background, "install_rembg", return_value=False):
                    self.assertEqual(remove_background.main([str(image), "--install"]), 1)


if __name__ == "__main__":
    unittest.main()
