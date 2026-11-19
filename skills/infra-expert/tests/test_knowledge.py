import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
SCRIPT = SKILL / "scripts" / "knowledge" / "knowledge.py"
TEMPLATE = SKILL / "assets" / "templates" / "project-knowledge"
FILES = ["README.md", "access.md", "mcp.md", "cli.md", "hosts.md", "learnings.md", "mcp-gaps.md", "records.md"]


def run(*args):
    return subprocess.run([sys.executable, str(SCRIPT), *map(str, args)],
                          capture_output=True, text=True, encoding="utf-8")


def initialized():
    root = Path(tempfile.mkdtemp())
    result = run("init", "--root", root)
    if result.returncode != 0:
        raise AssertionError(result.stderr)
    return root / ".gti" / "infra-expert"


class FindTest(unittest.TestCase):
    def test_finds_folder_at_the_nearest_git_root(self):
        root = Path(tempfile.mkdtemp())
        (root / ".git").mkdir()
        folder = root / ".gti" / "infra-expert"
        folder.mkdir(parents=True)
        nested = root / "one" / "two"
        nested.mkdir(parents=True)
        result = run("find", "--start", nested)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), str(folder.resolve()))

    def test_missing_folder_prints_nothing_and_exits_two(self):
        root = Path(tempfile.mkdtemp())
        result = run("find", "--start", root)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "")

    def test_without_a_repository_does_not_walk_up(self):
        root = Path(tempfile.mkdtemp())
        folder = root / ".gti" / "infra-expert"
        folder.mkdir(parents=True)
        nested = root / "one" / "two"
        nested.mkdir(parents=True)
        result = run("find", "--start", nested)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "")


class NearestGitRootTest(unittest.TestCase):
    def setUp(self):
        self.outer = Path(tempfile.mkdtemp())
        (self.outer / ".git").mkdir()
        self.outer_folder = self.outer / ".gti" / "infra-expert"
        self.outer_folder.mkdir(parents=True)
        self.inner = self.outer / "inner"
        (self.inner / ".git").mkdir(parents=True)
        self.sub = self.inner / "sub"
        self.sub.mkdir(parents=True)

    def test_find_does_not_return_the_outer_folder(self):
        result = run("find", "--start", self.sub)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "")

    def test_init_from_a_nested_repo_creates_the_inner_folder(self):
        result = subprocess.run([sys.executable, str(SCRIPT), "init"], cwd=str(self.sub),
                                capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.inner / ".gti" / "infra-expert" / "README.md").is_file())
        self.assertFalse((self.outer_folder / "README.md").exists())

    def test_a_git_file_counts_as_a_root(self):
        other = Path(tempfile.mkdtemp())
        (other / ".git").write_text("gitdir: /somewhere/else\n", encoding="utf-8")
        folder = other / ".gti" / "infra-expert"
        folder.mkdir(parents=True)
        nested = other / "deep" / "deeper"
        nested.mkdir(parents=True)
        result = run("find", "--start", nested)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), str(folder.resolve()))


class InitTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())

    def test_writes_every_template_file(self):
        result = run("init", "--root", self.root)
        self.assertEqual(result.returncode, 0, result.stderr)
        folder = self.root / ".gti" / "infra-expert"
        for name in FILES:
            self.assertTrue((folder / name).is_file(), name)
            self.assertIn(name, result.stdout)
            self.assertEqual((folder / name).read_text(encoding="utf-8"),
                             (TEMPLATE / name).read_text(encoding="utf-8"))

    def test_does_not_overwrite_without_force(self):
        run("init", "--root", self.root)
        path = self.root / ".gti" / "infra-expert" / "README.md"
        path.write_text("CUSTOM\n", encoding="utf-8")
        result = run("init", "--root", self.root)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(path.read_text(encoding="utf-8"), "CUSTOM\n")
        result = run("init", "--root", self.root, "--force")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotEqual(path.read_text(encoding="utf-8"), "CUSTOM\n")
        self.assertIn("README.md", result.stdout)


class AppendTest(unittest.TestCase):
    def setUp(self):
        self.folder = initialized()

    def test_learn_appends_a_well_formed_entry(self):
        result = run("learn", "--dir", self.folder, "--area", "access",
                     "--what", "A read opened a new connection",
                     "--rule", "Use the read-only tool with its own filter parameter",
                     "--source", "incident review")
        self.assertEqual(result.returncode, 0, result.stderr)
        text = (self.folder / "learnings.md").read_text(encoding="utf-8")
        self.assertIn(" - access", [line[3:] for line in text.splitlines() if line.startswith("## ")][-1])
        self.assertIn("- What: A read opened a new connection", text)
        self.assertIn("- Rule: Use the read-only tool with its own filter parameter", text)
        self.assertIn("- Source: incident review", text)
        check = run("check", "--dir", self.folder)
        self.assertEqual(check.returncode, 0, check.stderr)

    def test_gap_appends_a_well_formed_entry(self):
        result = run("gap", "--dir", self.folder,
                     "--need", "Bulk export of dashboards",
                     "--command", "vendor-cli dashboards export --all",
                     "--proposal", "An export_all tool on the project MCP")
        self.assertEqual(result.returncode, 0, result.stderr)
        text = (self.folder / "mcp-gaps.md").read_text(encoding="utf-8")
        self.assertIn("- Need: Bulk export of dashboards", text)
        self.assertIn("- Command: vendor-cli dashboards export --all", text)
        self.assertIn("- Proposal: An export_all tool on the project MCP", text)
        self.assertIn("- Status: open", text)
        check = run("check", "--dir", self.folder)
        self.assertEqual(check.returncode, 0, check.stderr)

    def test_learn_and_gap_default_source_and_keep_one_line_per_field(self):
        run("learn", "--dir", self.folder, "--area", "change", "--what", "  Patched live  ",
            "--rule", "Change  the source")
        text = (self.folder / "learnings.md").read_text(encoding="utf-8")
        self.assertIn("- What: Patched live", text)
        self.assertIn("- Rule: Change the source", text)
        self.assertIn("- Source: unspecified", text)
        self.assertEqual(run("check", "--dir", self.folder).returncode, 0)

    def test_learn_without_a_folder_exits_two(self):
        missing = Path(tempfile.mkdtemp()) / "no-folder"
        result = run("learn", "--dir", missing, "--area", "access", "--what", "x", "--rule", "y")
        self.assertEqual(result.returncode, 2)
        self.assertIn("not found", result.stderr)


class CheckTest(unittest.TestCase):
    def test_check_passes_on_a_fresh_init(self):
        folder = initialized()
        result = run("check", "--dir", folder)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, "")

    def test_check_fails_on_a_removed_file(self):
        folder = initialized()
        (folder / "hosts.md").unlink()
        result = run("check", "--dir", folder)
        self.assertEqual(result.returncode, 1)
        self.assertIn("hosts.md", result.stderr)

    def test_check_fails_on_a_malformed_entry(self):
        folder = initialized()
        path = folder / "mcp-gaps.md"
        path.write_text(path.read_text(encoding="utf-8").replace("- Status: open", "- Status: maybe"), encoding="utf-8")
        result = run("check", "--dir", folder)
        self.assertEqual(result.returncode, 1)
        self.assertIn("unknown status", result.stderr)


class SecretRefusalTest(unittest.TestCase):
    def setUp(self):
        self.folder = initialized()

    def test_refuses_an_assignment_in_a_learning(self):
        result = run("learn", "--dir", self.folder, "--area", "access",
                     "--what", "token=abc123 was used", "--rule", "Use a variable name")
        self.assertEqual(result.returncode, 1)
        self.assertIn("reference", result.stderr)
        self.assertNotIn("abc123", (self.folder / "learnings.md").read_text(encoding="utf-8"))

    def test_refuses_a_key_prefix_in_a_gap(self):
        result = run("gap", "--dir", self.folder, "--need", "Read a service",
                     "--command", "vendor-cli --key sk-abcdefghijklmnopqrstuvwxyz012345 read",
                     "--proposal", "A read tool")
        self.assertEqual(result.returncode, 1)
        self.assertNotIn("sk-", (self.folder / "mcp-gaps.md").read_text(encoding="utf-8"))

    def test_refuses_a_long_token_like_string(self):
        long_token = "aB3dEfGhIjKlMnOpQrStUvWxYz0123456789abcdef"
        result = run("gap", "--dir", self.folder, "--need", "Read a service",
                     "--command", "vendor-cli --key " + long_token + " read",
                     "--proposal", "A read tool")
        self.assertEqual(result.returncode, 1)
        self.assertNotIn(long_token, (self.folder / "mcp-gaps.md").read_text(encoding="utf-8"))

    def test_accepts_a_reference_to_a_variable_name(self):
        result = run("learn", "--dir", self.folder, "--area", "secrets",
                     "--what", "A provider key was pasted in chat",
                     "--rule", "Store it at <secret-store-path>/example-provider and refer to EXAMPLE_KEY")
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
