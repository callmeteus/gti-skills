"""Tests for agent_run.py.

Each test puts small fake harness CLIs (claude, codex, agent, pi, opencode) on PATH. The fakes record the
argv they were called with and print the JSON events the real CLI prints, so the tests check the command
the runner builds and what it does with the output, without calling any model.
"""

import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

RUNNER = Path(__file__).resolve().parent.parent / "scripts" / "agent" / "agent_run.py"

FAKE = r'''#!/usr/bin/env python3
import json, os, sys, time
from pathlib import Path
name = Path(sys.argv[0]).name
args = sys.argv[1:]
if args and args[-1] == "--help" or args == ["exec", "--help"] or args == ["run", "--help"]:
    print(os.environ.get("FAKE_HELP", "--dangerously-skip-permissions --safe-mode --auto --dangerously-bypass-approvals-and-sandbox --ignore-user-config --ignore-rules --no-skills --force"))
    sys.exit(0)
if args == ["--version"]:
    print(name + " 9.9.9"); sys.exit(0)
if name == "agent" and args == ["create-chat"]:
    print("chat-9"); sys.exit(0)
with open(os.environ["FAKE_LOG"], "a") as f:
    f.write(json.dumps({"bin": name, "args": args, "cwd": os.getcwd(), "env": os.environ.get("FAKE_ENV", "")}) + "\n")
if os.environ.get("FAKE_SLEEP"):
    time.sleep(float(os.environ["FAKE_SLEEP"]))
Path("hello.txt").write_text("hi\n")
if name == "codex":
    print(json.dumps({"type": "thread.started", "thread_id": "t-123"}))
    print(json.dumps({"type": "item.completed", "item": {"type": "agent_message", "text": "DONE"}}))
elif name == "pi":
    d = Path(args[args.index("--session-dir") + 1]); d.mkdir(parents=True, exist_ok=True)
    (d / "s.jsonl").write_text(json.dumps({"type": "message", "message": {"role": "assistant", "content": [{"type": "text", "text": "DONE"}]}}) + "\n")
    print("DONE")
else:
    print(json.dumps({"type": "assistant", "session_id": "s-from-output", "message": {"role": "assistant", "content": [{"type": "text", "text": "DONE"}]}}))
sys.exit(int(os.environ.get("FAKE_EXIT", "0")))
'''


class AgentRunTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="agent run "))
        self.bin = self.tmp / "bin"
        self.bin.mkdir()
        for name in ("claude", "codex", "agent", "pi", "opencode"):
            path = self.bin / name
            path.write_text(FAKE)
            path.chmod(0o755)
        self.work = self.tmp / "work dir"
        self.work.mkdir()
        self.log = self.tmp / "calls.jsonl"
        self.env = {**os.environ, "PATH": f"{self.bin}{os.pathsep}{os.environ['PATH']}", "FAKE_LOG": str(self.log),
                    "GTI_HOME": str(self.tmp / "gti")}

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_cli(self, *args, env=None, check=True):
        r = subprocess.run([sys.executable, str(RUNNER), *args], capture_output=True, text=True, timeout=60,
                           env={**self.env, **(env or {})}, cwd=self.tmp)
        if check and r.returncode:
            self.fail(f"agent_run {args[0]} exited {r.returncode}:\n{r.stdout}\n{r.stderr}")
        return r

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []

    def spawn(self, harness, *extra, env=None, check=True):
        result = self.tmp / f"{harness}-result.json"
        r = self.run_cli("spawn", "--harness", harness, "--cwd", str(self.work), "--prompt", "Do the task",
                         "--trace", str(self.tmp / f"{harness}-trace" / "session.jsonl"), "--result", str(result),
                         *extra, env=env, check=check)
        return r, (json.loads(result.read_text()) if result.exists() else None)

    def test_claude_spawn_assigns_a_session_and_passes_flags_before_the_prompt(self):
        r, res = self.spawn("claude", "--model", "haiku", "--yolo", "--isolate")
        args = self.calls()[0]["args"]
        self.assertEqual(args[:4], ["-p", "--output-format", "stream-json", "--verbose"])
        self.assertEqual(args[args.index("--session-id") + 1], res["session"])
        self.assertIn("--dangerously-skip-permissions", args)
        self.assertIn("--safe-mode", args)
        self.assertEqual(args[-1], "Do the task")
        self.assertEqual(self.calls()[0]["cwd"], str(self.work))
        self.assertTrue(res["resumable"])
        self.assertEqual(res["exit_code"], 0)
        self.assertIn("agent: DONE", r.stdout)
        self.assertNotIn("Do the task", json.dumps(res["command"]))
        self.assertTrue(Path(res["trace"]).read_text().startswith("{"))

    def test_optional_flags_missing_from_help_are_dropped_and_reported(self):
        _, res = self.spawn("claude", "--yolo", "--isolate", env={"FAKE_HELP": "--dangerously-skip-permissions"})
        args = self.calls()[0]["args"]
        self.assertNotIn("--safe-mode", args)
        self.assertIn("--dangerously-skip-permissions", args)
        self.assertEqual(res["dropped_flags"], ["--safe-mode"])

    def test_codex_session_comes_from_the_event_stream_and_resume_uses_it(self):
        _, res = self.spawn("codex", "--model", "gpt-x", "--isolate")
        self.assertEqual(res["session"], "t-123")
        self.assertIn("--ignore-user-config", self.calls()[0]["args"])
        self.run_cli("resume", "--harness", "codex", "--session", "t-123", "--cwd", str(self.work),
                     "--prompt", "Review your work", "--model", "gpt-x")
        self.assertEqual(self.calls()[1]["args"], ["exec", "resume", "t-123", "Review your work"])

    def test_cursor_creates_the_chat_before_the_first_prompt(self):
        _, res = self.spawn("cursor", "--yolo")
        args = self.calls()[0]["args"]
        self.assertEqual(res["session"], "chat-9")
        self.assertEqual(args[args.index("--resume") + 1], "chat-9")
        self.assertIn("--force", args)

    def test_session_dir_logs_are_copied_to_the_trace(self):
        _, res = self.spawn("pi", "--model", "local/qwen")
        trace = Path(res["trace"])
        self.assertIn('"DONE"', trace.read_text())
        args = self.calls()[0]["args"]
        self.assertEqual(args[args.index("--session-id") + 1], res["session"])
        self.assertEqual(Path(args[args.index("--session-dir") + 1]), trace.parent / "sessions")

    def test_timeout_kills_the_agent_and_exits_124(self):
        start = time.time()
        r, res = self.spawn("opencode", "--timeout", "1", env={"FAKE_SLEEP": "30"}, check=False)
        self.assertEqual(r.returncode, 124)
        self.assertTrue(res["timed_out"])
        self.assertLess(time.time() - start, 20)

    def test_exit_code_of_the_harness_is_kept(self):
        r, res = self.spawn("opencode", env={"FAKE_EXIT": "3"}, check=False)
        self.assertEqual((r.returncode, res["exit_code"]), (3, 3))

    def test_adapter_script_gets_the_contract_environment(self):
        script = self.tmp / "my adapter.sh"
        script.write_text('cd "$WORKSPACE" && { cat "$PROMPT_FILE"; echo; echo "$MODEL $EXTRA_ARGS"; } > got.txt\n'
                          'echo \'{"type":"user","message":{"role":"user","content":"x"}}\' > "$TRACE_DIR/session.jsonl"\n')
        _, res = self.spawn(f"script:{script}", "--model", "m1", "--extra-args=--fast")
        self.assertEqual((self.work / "got.txt").read_text(), "Do the task\nm1 --fast\n")
        self.assertTrue(Path(res["trace"]).exists())
        self.assertFalse(res["resumable"])

    def test_background_returns_at_once_and_writes_the_result_later(self):
        result = self.tmp / "bg" / "result.json"
        start = time.time()
        r = self.run_cli("spawn", "--harness", "claude", "--cwd", str(self.work), "--prompt", "x",
                         "--result", str(result), "--background", env={"FAKE_SLEEP": "2"})
        self.assertLess(time.time() - start, 2)
        self.assertEqual(json.loads(r.stdout)["result"], str(result))
        for _ in range(100):
            if result.exists():
                break
            time.sleep(0.1)
        self.assertEqual(json.loads(result.read_text())["exit_code"], 0)

    def test_dry_run_prints_the_command_and_runs_nothing(self):
        r = self.run_cli("spawn", "--harness", "paseo", "--cwd", str(self.work), "--prompt", "x",
                         "--provider", "claude", "--title", "w1", "--dry-run")
        res = json.loads(r.stdout)
        self.assertEqual(res["command"][1:6], ["run", "--no-wait", "--json", "--cwd", str(self.work)])
        self.assertIn("--provider", res["command"])
        self.assertEqual(self.calls(), [])

    def test_missing_placeholder_and_unknown_harness_fail_clearly(self):
        r = self.run_cli("spawn", "--harness", "openagents", "--prompt", "x", "--dry-run", check=False)
        self.assertIn("needs --agent", r.stderr)
        r = self.run_cli("spawn", "--harness", "nosuch", "--prompt", "x", check=False)
        self.assertIn("unknown harness", r.stderr)
        r = self.run_cli("resume", "--harness", "omp", "--session", "s", "--prompt", "x", "--dry-run", check=False)
        self.assertIn("no resume command", r.stderr)

    def test_smoke_checks_hello_txt_in_a_scratch_repo(self):
        out = self.tmp / "smoke"
        r = self.run_cli("smoke", "--harness", "claude", "--model", "haiku", "--out", str(out))
        self.assertIn("hello.txt ok", r.stdout)
        self.assertTrue((out / "workspace" / ".git").exists())
        r = self.run_cli("smoke", "--harness", "claude", "--out", str(self.tmp / "smoke2"),
                         env={"FAKE_EXIT": "1"}, check=False)
        self.assertEqual(r.returncode, 1)

    def test_list_shows_installed_harnesses(self):
        rows = {row["id"]: row for row in json.loads(self.run_cli("list", "--json").stdout)}
        self.assertEqual(rows["claude"]["path"], str(self.bin / "claude"))
        self.assertEqual(rows["claude"]["version"], "claude 9.9.9")
        self.assertTrue(rows["claude"]["resume"])
        self.assertFalse(rows["omp"]["resume"])


if __name__ == "__main__":
    unittest.main()
