import datetime
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
SCRIPT = SKILL / "scripts" / "knowledge" / "knowledge.py"
TEMPLATE = SKILL / "assets" / "templates" / "project-knowledge"
FILES = ["README.md", "conventions.md", "access.md", "mcp.md", "cli.md", "hosts.md", "learnings.md", "mcp-gaps.md", "records.md"]
# Every run writes its home copy here, never into the real ~/.gti.
GTI_HOME = Path(tempfile.mkdtemp())


def run(*args, cwd=None):
    env = dict(os.environ, GTI_HOME=str(GTI_HOME))
    return subprocess.run([sys.executable, str(SCRIPT), *map(str, args)], cwd=None if cwd is None else str(cwd),
                          capture_output=True, text=True, encoding="utf-8", env=env)


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

    def test_learn_also_writes_the_copy_in_gti_home(self):
        project = self.folder.parent.parent.name
        result = run("learn", "--dir", self.folder, "--area", "access",
                     "--what", "Home copy", "--rule", "Keep both copies")
        self.assertEqual(result.returncode, 0, result.stderr)
        home = GTI_HOME / "infra-expert" / project / "learnings.md"
        self.assertIn("- What: Home copy", home.read_text(encoding="utf-8"))
        self.assertIn("- What: Home copy", (self.folder / "learnings.md").read_text(encoding="utf-8"))
        self.assertEqual(result.stdout.split(), [str(self.folder / "learnings.md"), str(home)])


class LearnTargetsTest(unittest.TestCase):
    def test_learn_in_a_repository_without_the_folder_creates_only_learnings(self):
        root = Path(tempfile.mkdtemp())
        (root / ".git").mkdir()
        sub = root / "infra"
        sub.mkdir()
        result = run("learn", "--area", "diagnose", "--what", "Slow names",
                     "--rule", "Check proxy peers first", cwd=sub)
        self.assertEqual(result.returncode, 0, result.stderr)
        folder = root / ".gti" / "infra-expert"
        self.assertEqual(sorted(path.name for path in folder.iterdir()), ["learnings.md"])
        text = (folder / "learnings.md").read_text(encoding="utf-8")
        self.assertTrue(text.startswith("# Learnings"))
        self.assertIn("- Rule: Check proxy peers first", text)
        home = GTI_HOME / "infra-expert" / root.name / "learnings.md"
        self.assertIn("- Rule: Check proxy peers first", home.read_text(encoding="utf-8"))

    def test_learn_outside_a_repository_writes_only_the_home_copy(self):
        start = Path(tempfile.mkdtemp())
        result = run("learn", "--area", "access", "--what", "No repo",
                     "--rule", "Home only", cwd=start)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((start / ".gti").exists())
        home = GTI_HOME / "infra-expert" / start.name / "learnings.md"
        self.assertIn("- Rule: Home only", home.read_text(encoding="utf-8"))


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

    def test_check_fails_when_conventions_md_is_missing(self):
        folder = initialized()
        (folder / "conventions.md").unlink()
        result = run("check", "--dir", folder)
        self.assertEqual(result.returncode, 1)
        self.assertIn("conventions.md", result.stderr)

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


class TmpTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        subprocess.run(["git", "init", "-q", str(self.root)], check=True, capture_output=True)
        (self.root / ".gti" / "infra-expert").mkdir(parents=True)

    def tmp(self, *args, cwd=None):
        return subprocess.run([sys.executable, str(SCRIPT), "tmp", *map(str, args)],
                              cwd=str(cwd or self.root), capture_output=True,
                              text=True, encoding="utf-8")

    def test_creates_folder_under_the_nearest_git_root(self):
        result = self.tmp("--name", "fix disk")
        self.assertEqual(result.returncode, 0, result.stderr)
        folder = Path(result.stdout.strip())
        self.assertTrue(folder.is_dir())
        self.assertEqual(folder.parent, self.root / ".gti" / "tmp")
        self.assertRegex(folder.name, r"^\d{8}-\d{6}-fix-disk$")

    def test_creates_folder_from_a_subdirectory(self):
        nested = self.root / "one" / "two"
        nested.mkdir(parents=True)
        result = self.tmp("--name", "fix disk", cwd=nested)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(Path(result.stdout.strip()).parent, self.root / ".gti" / "tmp")

    def test_creates_folder_in_a_nested_repository(self):
        inner = self.root / "inner"
        subprocess.run(["git", "init", "-q", str(inner)], check=True, capture_output=True)
        (inner / ".gti" / "infra-expert").mkdir(parents=True)
        sub = inner / "work"
        sub.mkdir()
        result = self.tmp("--name", "fix disk", cwd=sub)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(Path(result.stdout.strip()).parent, inner / ".gti" / "tmp")
        self.assertFalse((self.root / ".gti" / "tmp").exists())

    def test_outside_a_repository_uses_the_start_directory(self):
        outside = Path(tempfile.mkdtemp())
        result = self.tmp("--name", "fix disk", "--start", outside)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(Path(result.stdout.strip()).parent, outside / ".gti" / "tmp")

    def test_default_slug_is_run(self):
        result = self.tmp()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertRegex(Path(result.stdout.strip()).name, r"^\d{8}-\d{6}-run$")

    def test_slug_is_lowercased_and_non_alphanumeric_runs_collapse(self):
        result = self.tmp("--name", "  Fix::Disk Space!!  ")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertRegex(Path(result.stdout.strip()).name, r"^\d{8}-\d{6}-fix-disk-space$")

    def test_slug_is_capped_at_forty_characters(self):
        result = self.tmp("--name", "a" * 60)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(Path(result.stdout.strip()).name.endswith("-" + "a" * 40))

    def test_collision_adds_numeric_suffix(self):
        base = self.root / ".gti" / "tmp"
        now = datetime.datetime.now()
        for offset in range(-1, 3):
            stamp = (now + datetime.timedelta(seconds=offset)).strftime("%Y%m%d-%H%M%S")
            for suffix in ("", "-2"):
                (base / (stamp + "-fix-disk" + suffix)).mkdir(parents=True, exist_ok=True)
        result = self.tmp("--name", "fix disk")
        self.assertEqual(result.returncode, 0, result.stderr)
        name = Path(result.stdout.strip()).name
        self.assertTrue(name.endswith("-fix-disk-3"), name)
        self.assertTrue((base / name).is_dir())

    def test_gitignore_gets_tmp_once_and_root_gitignore_is_untouched(self):
        root_ignore = self.root / ".gitignore"
        root_ignore.write_text("*.log\n", encoding="utf-8")
        self.assertEqual(self.tmp("--name", "first").returncode, 0)
        self.assertEqual(self.tmp("--name", "second").returncode, 0)
        gti_ignore = self.root / ".gti" / ".gitignore"
        self.assertTrue(gti_ignore.is_file())
        self.assertEqual(gti_ignore.read_text(encoding="utf-8").splitlines().count("tmp/"), 1)
        self.assertEqual(root_ignore.read_text(encoding="utf-8"), "*.log\n")

    def test_existing_gti_gitignore_is_appended_not_replaced(self):
        ignore = self.root / ".gti" / ".gitignore"
        ignore.write_text("local-only.txt\n", encoding="utf-8")
        result = self.tmp()
        self.assertEqual(result.returncode, 0, result.stderr)
        text = ignore.read_text(encoding="utf-8")
        self.assertIn("local-only.txt", text)
        self.assertEqual(text.splitlines().count("tmp/"), 1)

    def test_git_status_does_not_show_the_tmp_folder(self):
        self.assertEqual(self.tmp("--name", "scratch").returncode, 0)
        result = subprocess.run(["git", "status", "--porcelain", "--untracked-files=all"],
                                cwd=str(self.root), capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn(".gti/tmp", result.stdout)

    def test_list_shows_size_and_date_newest_first(self):
        base = self.root / ".gti" / "tmp"
        base.mkdir(parents=True, exist_ok=True)
        old = base / "20200101-000000-old"
        new = base / "20990101-000000-new"
        old.mkdir()
        new.mkdir()
        (old / "data.bin").write_bytes(b"x" * 10)
        (new / "data.bin").write_bytes(b"y" * 20)
        result = self.tmp("--list")
        self.assertEqual(result.returncode, 0, result.stderr)
        out = result.stdout
        self.assertIn("new", out)
        self.assertIn("old", out)
        self.assertLess(out.index("new"), out.index("old"))
        self.assertRegex(out, r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}")
        self.assertIn("10 B", out)
        self.assertIn("20 B", out)


if __name__ == "__main__":
    unittest.main()
