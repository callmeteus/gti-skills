import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL / "scripts"
EXAMPLE = SKILL / "assets" / "templates" / "report-data.example.json"


def run(script, *args):
    return subprocess.run([sys.executable, str(SCRIPTS / script), *map(str, args)],
                          capture_output=True, text=True, encoding="utf-8")


def git(repo, *args):
    subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True)


class RenderReportTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.data = json.loads(EXAMPLE.read_text(encoding="utf-8"))

    def render(self, data, *flags):
        path = self.tmp / "data.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        out = self.tmp / "report.html"
        return run("report/render_report.py", path, "--out", out, *flags), out

    def test_example_renders_without_jargon_warnings(self):
        result, out = self.render(self.data, "--strict")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, "")
        page = out.read_text(encoding="utf-8")
        self.assertIn('href="#order-intake"', page)
        self.assertIn("What&#x27;s wrong today", page)
        self.assertIn("<code>OrderIntake.submit()</code>", page)

    def test_strict_mode_refuses_jargon_and_names_the_replacement(self):
        data = copy.deepcopy(self.data)
        data["candidates"][0]["gains"].append("Better locality across the seam")
        result, out = self.render(data, "--strict")
        self.assertEqual(result.returncode, 3)
        self.assertIn("'locality'", result.stderr)
        self.assertIn("'seam'", result.stderr)
        self.assertIn("injection point", result.stderr)
        self.assertFalse(out.exists())

    def test_portuguese_labels_and_escaped_user_text(self):
        data = copy.deepcopy(self.data)
        data["lang"] = "pt"
        data["scope"] = "Revisei <script>alert(1)</script> em `src/orders`."
        result, out = self.render(data)
        self.assertEqual(result.returncode, 0, result.stderr)
        page = out.read_text(encoding="utf-8")
        self.assertIn('<html lang="pt">', page)
        self.assertIn("O que está errado hoje", page)
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", page)
        self.assertNotIn("<script>alert(1)", page)

    def test_top_recommendation_must_name_a_candidate(self):
        data = copy.deepcopy(self.data)
        data["top"]["id"] = "missing"
        result, _ = self.render(data)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("top.id", result.stderr)


class HotspotsTest(unittest.TestCase):
    def test_counts_changes_per_file_and_folder_and_skips_lock_files(self):
        repo = Path(tempfile.mkdtemp())
        git(repo, "init", "-q")
        git(repo, "config", "user.email", "test@example.com")
        git(repo, "config", "user.name", "Test")
        (repo / "src" / "orders").mkdir(parents=True)
        for i in range(3):
            (repo / "src" / "orders" / "intake.ts").write_text(f"v{i}", encoding="utf-8")
            (repo / "package-lock.json").write_text(f"v{i}", encoding="utf-8")
            if i == 0:
                (repo / "src" / "orders" / "repo.ts").write_text("x", encoding="utf-8")
            git(repo, "add", "-A")
            git(repo, "commit", "-q", "-m", f"change {i}")

        result = run("explore/hotspots.py", repo, "--json")
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["files"][0], {"path": "src/orders/intake.ts", "changes": 3})
        self.assertNotIn("package-lock.json", [row["path"] for row in report["files"]])
        self.assertEqual(report["folders"], [{"path": "src/orders", "changes": 4}])


if __name__ == "__main__":
    unittest.main()
