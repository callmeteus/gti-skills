"""Tests for the LLM Fine Tuning scripts.

The generic scripts run offline against small JSONL files and a local stub of an
OpenAI-compatible server. The Inkling 2 Small recipe is tested where it runs without
the Tinker SDK: its work-folder paths and row normalization, and the exact-merge
selftest when torch and safetensors are installed.
"""

import http.server
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
SCRIPTS = SKILL / "scripts"
sys.path.insert(0, str(SCRIPTS))

from common import chat_rows, gti  # noqa: E402
from data import check_dataset  # noqa: E402
from probe import probe  # noqa: E402

# The recipe folder also has a probe.py, so load its shared module by path.
_spec = importlib.util.spec_from_file_location("inkling2", SCRIPTS / "inkling-2-small" / "inkling2.py")
inkling2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(inkling2)

TOOLS = [{"type": "function", "function": {"name": "Bash", "description": "Run a command.",
                                           "parameters": {"type": "object", "properties": {}}}}]


def agent_row(i, *, thinking=True, system=True, opens_with_tool=True):
    assistant = {"role": "assistant", "content": "Looking."}
    if thinking:
        assistant["reasoning_content"] = "I should check the tests first."
    if opens_with_tool:
        assistant["tool_calls"] = [{"id": f"c{i}", "type": "function",
                                    "function": {"name": "Bash", "arguments": {"command": "pytest"}}}]
    msgs = ([{"role": "system", "content": "You are a coding agent."}] if system else []) + [
        {"role": "user", "content": "Fix the failing test."}, assistant]
    if opens_with_tool:
        msgs += [{"role": "tool", "tool_call_id": f"c{i}", "content": "1 failed"},
                 {"role": "assistant", "content": [{"type": "thinking", "thinking": "Off by one."},
                                                   {"type": "text", "text": "Fixed the bound."}]}]
    return {"messages": msgs, "tools": TOOLS, "group": f"session-{i}"}


class TempHome(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.old_home = os.environ.get("GTI_HOME")
        os.environ["GTI_HOME"] = str(self.root / "gti")

    def tearDown(self):
        if self.old_home is None:
            os.environ.pop("GTI_HOME", None)
        else:
            os.environ["GTI_HOME"] = self.old_home
        self.tmp.cleanup()

    def write_rows(self, rows, name="rows.jsonl"):
        path = self.root / name
        path.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")
        return path


class ChatRowsTests(unittest.TestCase):
    def test_thinking_part_becomes_reasoning_content_and_arguments_become_json(self):
        msgs, _ = chat_rows.normalize_row(agent_row(0)["messages"])
        first = msgs[2]
        self.assertEqual(first["reasoning_content"], "I should check the tests first.")
        self.assertEqual(json.loads(first["tool_calls"][0]["function"]["arguments"]), {"command": "pytest"})
        self.assertEqual(msgs[-1], {"role": "assistant", "reasoning_content": "Off by one.",
                                    "content": "Fixed the bound."})

    def test_tool_result_for_a_call_never_made_is_an_error(self):
        msgs = [{"role": "user", "content": "hi"}, {"role": "tool", "tool_call_id": "x", "content": "?"},
                {"role": "assistant", "content": "hello"}]
        normalized, _ = chat_rows.normalize_row(msgs)
        with self.assertRaises(chat_rows.RowError):
            chat_rows.check_conversation(normalized)

    def test_orphan_tool_message_without_id_is_dropped_as_harness_noise(self):
        msgs = [{"role": "user", "content": "hi"}, {"role": "tool", "content": "529 Overloaded"},
                {"role": "assistant", "content": "hello"}]
        normalized, warnings = chat_rows.normalize_row(msgs)
        self.assertEqual([m["role"] for m in normalized], ["user", "assistant"])
        self.assertEqual(len(warnings), 1)

    def test_split_is_stable_per_group(self):
        sides = {chat_rows.split_of("session-7", "seed", 0.3) for _ in range(5)}
        self.assertEqual(len(sides), 1)


class CheckDatasetTests(TempHome):
    def test_groups_never_land_on_both_sides(self):
        rows = []
        for i in range(40):
            rows += [agent_row(i), agent_row(i)]  # two windows of every session
        path = self.write_rows(rows)
        split, report, errors, _ = check_dataset.analyze([path], val_fraction=0.25)
        self.assertEqual(errors, [])
        self.assertEqual(report["train_val_group_overlap"], [])
        self.assertEqual(len(split["train"]) + len(split["val"]), 80)
        self.assertGreater(len(split["val"]), 0)

    def test_advice_flags_tool_openers_missing_thinking_and_few_steps(self):
        rows = [agent_row(i) for i in range(20)] + [agent_row(99, thinking=False, system=False)]
        path = self.write_rows(rows)
        _, report, _, _ = check_dataset.analyze([path])
        advice = " ".join(check_dataset.advice_for(report, batch_size=8))
        self.assertIn("open with a tool call", advice)
        self.assertIn("carry thinking", advice)
        self.assertIn("no system prompt", advice)
        self.assertIn("optimizer steps", advice)
        self.assertIn("estimates", advice)

    def test_conversational_rows_clear_the_tool_opening_advice(self):
        rows = [agent_row(i) for i in range(10)] + [agent_row(100 + i, opens_with_tool=False) for i in range(5)]
        _, report, _, _ = check_dataset.analyze([self.write_rows(rows)])
        self.assertNotIn("open with a tool call", " ".join(check_dataset.advice_for(report)))

    def test_cli_writes_splits_and_report_to_the_work_folder_and_fails_on_bad_rows(self):
        good = self.write_rows([agent_row(i) for i in range(60)])
        run = subprocess.run([sys.executable, str(SCRIPTS / "data" / "check_dataset.py"), "--input", str(good),
                              "--name", "demo", "--price-per-million", "2", "--val-fraction", "0.2"],
                             capture_output=True, text=True, cwd=self.root)
        self.assertEqual(run.returncode, 0, run.stderr)
        out = Path(os.environ["GTI_HOME"]) / "llm-fine-tuning" / self.root.name / "datasets"
        report = json.loads((out / "demo.report.json").read_text(encoding="utf-8"))
        self.assertTrue((out / "demo.train.jsonl").exists())
        self.assertIn("estimated_train_cost_usd", report)
        self.assertFalse(report["tokens_exact"])

        bad = self.write_rows([{"messages": [{"role": "user", "content": "hi"}]}], "bad.jsonl")
        run = subprocess.run([sys.executable, str(SCRIPTS / "data" / "check_dataset.py"), "--input", str(bad),
                              "--name", "bad"], capture_output=True, text=True, cwd=self.root)
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("no assistant message", run.stderr)


class StubHandler(http.server.BaseHTTPRequestHandler):
    """Answers greetings with a tool call when tool_happy is set, otherwise like a good model."""
    tool_happy = False

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        prompt = body["messages"][-1]["content"]
        wants_tool = "tests" in prompt or (self.tool_happy and prompt == "Hey there!")
        if wants_tool and body.get("tools"):
            message = {"role": "assistant", "content": None, "tool_calls": [
                {"id": "1", "type": "function", "function": {"name": "Bash", "arguments": "{}"}}]}
        else:
            message = {"role": "assistant", "content": "Hi! What are we working on?"}
        data = json.dumps({"choices": [{"message": message}]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


class ProbeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), StubHandler)
        cls.url = f"http://127.0.0.1:{cls.server.server_address[1]}/v1"
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def tearDown(self):
        StubHandler.tool_happy = False

    def test_well_behaved_model_passes(self):
        r = probe.run_probes(self.url, "none", "m", "sys", TOOLS, probe.PROBES_WITH_TOOLS, n=2)
        self.assertEqual(r["verdict"], "PASS")

    def test_tool_call_on_a_greeting_fails(self):
        StubHandler.tool_happy = True
        r = probe.run_probes(self.url, "none", "m", "sys", TOOLS, probe.PROBES_WITH_TOOLS, n=2)
        self.assertEqual(r["verdict"], "FAIL")
        self.assertEqual(r["probes"]["greeting"]["counts"], {"tool": 2})

    def test_unreachable_endpoint_is_an_error_not_a_pass(self):
        r = probe.run_probes("http://127.0.0.1:9/v1", "none", "m", None, [], probe.PROBES_NO_TOOLS, n=1)
        self.assertEqual(r["verdict"], "ERROR")


class InklingRecipeTests(TempHome):
    def test_bare_names_resolve_inside_the_work_folder(self):
        paths = inkling2.dataset_paths("my-run")
        expected = Path(os.environ["GTI_HOME"]) / "llm-fine-tuning" / inkling2.project_name() / "datasets"
        self.assertEqual(paths["train"], expected / "my-run.train.jsonl")
        self.assertEqual(inkling2.dataset_paths("custom/dir/my-run")["report"],
                         Path("custom/dir/my-run.report.json"))

    def test_recipe_normalization_keeps_thinking_as_a_content_part(self):
        msgs, _ = inkling2.normalize_row(agent_row(0)["messages"])
        self.assertEqual(msgs[2]["content"][0], {"type": "thinking", "thinking": "I should check the tests first."})

    def test_gti_helpers_agree_on_the_work_folder(self):
        self.assertEqual(gti.gti_dir("x"), inkling2.work_dir("x"))

    @unittest.skipUnless(importlib.util.find_spec("torch") and importlib.util.find_spec("safetensors"),
                         "torch and safetensors are not installed")
    def test_exact_merge_selftest(self):
        run = subprocess.run([sys.executable, str(SCRIPTS / "inkling-2-small" / "merge" / "merge_lossless.py"),
                              "selftest"], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("SELFTEST OK", run.stdout)


if __name__ == "__main__":
    unittest.main()
