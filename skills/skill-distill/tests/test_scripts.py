"""Tests for the skill-distill scripts.

Each test builds a small repository and a fake student adapter in a temporary folder, runs the
scripts as the teacher would, and checks the run folder and the user's repository afterwards.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
DISTILL = SKILL / "scripts" / "run" / "distill.py"
EXTRACT = SKILL / "scripts" / "agent" / "extract_session.py"
DOCTOR = SKILL / "scripts" / "setup" / "doctor.py"

HAS_GIT = shutil.which("git") is not None
HAS_TMUX = all(shutil.which(t) for t in ("tmux", "bash"))

# A fake student: writes hello.txt and the requested file, and leaves a Claude Code style session log.
FAKE_ADAPTER = r"""#!/usr/bin/env bash
set -uo pipefail
cd "$WORKSPACE" || exit 2
echo hi > hello.txt
echo "made by ${MODEL}" > result.txt
cat > "$TRACE_DIR/session.jsonl" <<'JSON'
{"type":"user","message":{"role":"user","content":"Make result.txt"}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Write","input":{"file_path":"result.txt","content":"x"}}]}}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","content":"ok"}]}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"DONE"}]}}
JSON
echo "agent: DONE"
"""

BROKEN_ADAPTER = "#!/usr/bin/env bash\necho 'model not found' >&2\nexit 3\n"


def git(root, *args):
    env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com",
           "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com"}
    return subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True, text=True, env=env).stdout


@unittest.skipUnless(HAS_GIT, "git is required")
class DistillTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="skill distill "))  # a space, like real user paths
        self.home = self.tmp / "gti"
        self.repo = self.tmp / "my project"
        self.repo.mkdir()
        git(self.repo, "init", "-q")
        (self.repo / "app.txt").write_text("v1\n")
        (self.repo / "old.txt").write_text("old\n")
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-q", "-m", "start")
        self.adapter = self.tmp / "adapters" / "fake.sh"
        self.adapter.parent.mkdir()
        self.adapter.write_text(FAKE_ADAPTER)
        self.prompt = self.tmp / "prompt.md"
        self.prompt.write_text("Make result.txt\n")
        self.tmux_session = f"distill-test-{os.getpid()}"

    def tearDown(self):
        if HAS_TMUX:
            subprocess.run(["tmux", "kill-session", "-t", self.tmux_session], capture_output=True)
        shutil.rmtree(self.tmp, ignore_errors=True)

    def distill(self, *args, check=True):
        env = {**os.environ, "GTI_HOME": str(self.home)}
        r = subprocess.run([sys.executable, str(DISTILL), *args], cwd=self.repo, env=env,
                           capture_output=True, text=True, timeout=120)
        if check and r.returncode:
            self.fail(f"distill {args[0]} failed:\n{r.stdout}\n{r.stderr}")
        return r

    def run_dir(self, task):
        return self.home / "skill-distill" / "my project" / "runs" / task

    def test_init_puts_the_run_under_gti_home_and_fills_the_template(self):
        self.distill("init", "demo", "--prompt", str(self.prompt), "--student", f"{self.adapter}:m1",
                     "--base", f"{self.repo}")
        run = self.run_dir("demo")
        cfg = json.loads((run / "run.json").read_text())
        self.assertEqual(cfg["base"]["ref"], git(self.repo, "rev-parse", "HEAD").strip())
        self.assertEqual(cfg["harness_name"], "fake")
        self.assertEqual(cfg["harness"], f"script:{self.adapter}")
        skill = (run / "skill" / "SKILL.md").read_text()
        self.assertIn("name: reproduce-demo", skill)
        self.assertIn("written for m1 in fake", skill)
        self.assertEqual((run / "prompt.md").read_text(), "Make result.txt\n")
        self.assertEqual(git(self.repo, "status", "--short"), "")

    def test_init_rejects_an_unknown_adapter_and_a_missing_commit(self):
        r = self.distill("init", "demo", "--prompt", str(self.prompt), "--student", "nosuch:m",
                         "--base", "empty", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("unknown harness", r.stderr)
        r = self.distill("init", "demo2", "--prompt", str(self.prompt), "--student", f"{self.adapter}:m",
                         "--base", f"{self.repo}@deadbeef", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("is not a commit", r.stderr)

    def test_worktree_snapshot_keeps_uncommitted_changes_without_touching_the_repo(self):
        (self.repo / "app.txt").write_text("v2 uncommitted\n")
        (self.repo / "new.txt").write_text("new\n")
        (self.repo / "old.txt").unlink()
        before_status = git(self.repo, "status", "--short")
        before_refs = git(self.repo, "for-each-ref")
        self.distill("init", "snap", "--prompt", str(self.prompt), "--student", f"{self.adapter}:m",
                     "--base", f"{self.repo}@worktree")
        self.assertEqual(git(self.repo, "status", "--short"), before_status)
        self.assertEqual(git(self.repo, "for-each-ref"), before_refs)

        sys.path.insert(0, str(DISTILL.parent))
        try:
            import distill
        finally:
            sys.path.pop(0)
        cfg = json.loads((self.run_dir("snap") / "run.json").read_text())
        ws = self.tmp / "ws"
        distill.make_workspace(cfg, ws)
        self.assertEqual((ws / "app.txt").read_text(), "v2 uncommitted\n")
        self.assertEqual((ws / "new.txt").read_text(), "new\n")
        self.assertFalse((ws / "old.txt").exists())

    def test_smoke_passes_with_a_working_student_and_fails_with_a_broken_one(self):
        r = self.distill("smoke", "--student", f"{self.adapter}:m1")
        self.assertIn("hello.txt ok", r.stdout)
        self.assertIn("session log ok", r.stdout)
        broken = self.tmp / "adapters" / "broken.sh"
        broken.write_text(BROKEN_ADAPTER)
        r = self.distill("smoke", "--student", f"{broken}:m1", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("smoke test failed", r.stderr)
        self.assertIn("model not found", r.stdout)
        self.assertIn("exit 3", r.stdout)

    @unittest.skipUnless(HAS_TMUX, "tmux and bash are required")
    def test_full_loop_from_trial_to_accepted_skill(self):
        self.distill("init", "loop", "--prompt", str(self.prompt), "--student", f"{self.adapter}:m1",
                     "--base", str(self.repo), "--tmux", self.tmux_session, "--reference-workspace", str(self.repo))
        run = self.run_dir("loop")
        (run / "checks.sh").write_text('test -f "$WORKSPACE/result.txt" || test -f "$WORKSPACE/app.txt"\n'
                                       'echo checked > "$OUT/check.txt"\n')
        r = self.distill("evidence", "loop", "--reference")
        self.assertIn("checks exit 0", r.stdout)

        self.distill("trial", "loop", "-k", "2")
        self.distill("wait", "loop", "--timeout", "60")
        trials = sorted((run / "iters" / "01").glob("t*"))
        self.assertEqual([t.name for t in trials], ["t1", "t2"])
        for t in trials:
            self.assertEqual((t / "exit_code").read_text().strip(), "0")
            self.assertTrue((t / "workspace" / ".skill" / "reproduce-loop" / "SKILL.md").exists())
            self.assertIn("`.skill/reproduce-loop/SKILL.md`", (t / "prompt.md").read_text())
            agent = json.loads((t / "agent.json").read_text())
            self.assertEqual((agent["harness"], agent["model"], agent["exit_code"]), ("fake", "m1", 0))

        r = self.distill("evidence", "loop")
        self.assertIn("checks exit 0", r.stdout)
        self.assertIn("tool calls 1", r.stdout)
        files = (trials[0] / "evidence" / "files.txt").read_text()
        self.assertIn("result.txt", files)
        self.assertNotIn(".skill/", files)
        self.assertIn("result.txt", (trials[0] / "evidence" / "diffstat.txt").read_text())

        self.distill("verdict", "loop", "--iter", "1", "--trial", "1", "--verdict", "match", "--score", "9",
                     "--divergence", "none")
        self.distill("verdict", "loop", "--iter", "1", "--trial", "2", "--verdict", "close", "--score", "7")
        r = self.distill("verdict", "loop", "--iter", "1", "--trial", "1", "--verdict", "match", "--score", "11",
                         check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("best score per iteration: 1: 9.0", self.distill("ledger", "loop").stdout)

        page = Path(self.distill("report", "loop").stdout.strip()).read_text()
        self.assertIn("<title>Skill Distill Report</title>", page)
        self.assertIn("prefers-color-scheme:dark", page)

        r = self.distill("accept", "loop", "--iter", "1", "--decision", "pass", "--note", "looks right")
        self.assertTrue((run / "final" / "reproduce-loop" / "SKILL.md").exists())
        self.assertIn("decision pass", self.distill("list").stdout)
        self.assertEqual(git(self.repo, "status", "--short"), "")


class ExtractSessionTest(unittest.TestCase):
    def test_claude_log_drops_injected_text_and_counts_tools(self):
        rows = [
            {"type": "user", "message": {"role": "user", "content":
                "<system-reminder>private CLAUDE.md text</system-reminder>Build the game"}},
            {"type": "assistant", "message": {"role": "assistant", "content": [
                {"type": "text", "text": "Starting."},
                {"type": "tool_use", "name": "Write", "input": {"file_path": "game.js", "content": "x"}}]}},
            {"type": "user", "message": {"role": "user", "content": [
                {"type": "tool_result", "content": "boom", "is_error": True}]}},
            {"type": "assistant", "message": {"role": "assistant", "content": [{"type": "text", "text": "Done."}]}},
        ]
        with tempfile.TemporaryDirectory() as d:
            log = Path(d) / "s.jsonl"
            log.write_text("\n".join(json.dumps(r) for r in rows) + "\n")
            out = Path(d) / "ref.json"
            md = subprocess.run([sys.executable, str(EXTRACT), str(log), "--json", str(out)],
                                capture_output=True, text=True, check=True).stdout
            s = json.loads(out.read_text())
        self.assertEqual(s["format"], "claude")
        self.assertEqual(s["task"], "Build the game")
        self.assertEqual((s["tool_calls"], s["tool_errors"]), (1, 1))
        self.assertEqual(s["files_written"], ["game.js"])
        self.assertEqual(s["final"], "Done.")
        self.assertNotIn("private", md)
        self.assertTrue(md.isascii())


class DoctorTest(unittest.TestCase):
    def test_reports_an_unknown_harness_as_missing(self):
        r = subprocess.run([sys.executable, str(DOCTOR), "--student", "nosuch", "--json"],
                           capture_output=True, text=True)
        report = json.loads(r.stdout)
        self.assertEqual(r.returncode, 1)
        self.assertFalse(report["ok"])
        self.assertIn("harness", [c["name"] for c in report["checks"] if not c["ok"]])


if __name__ == "__main__":
    unittest.main()
