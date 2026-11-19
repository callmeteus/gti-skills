import copy
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL / "scripts" / "plan"
SCRIPT = SCRIPTS / "plan.py"
FIXTURES = Path(__file__).resolve().parent / "fixtures" / "plan"
EXAMPLE = SKILL / "assets" / "templates" / "plan.example.md"

sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("infra_expert_plan", SCRIPT)
plan = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(plan)


def run(*args, env=None):
    variables = dict(os.environ)
    if env:
        variables.update(env)
    return subprocess.run([sys.executable, str(SCRIPT), *map(str, args)],
                          capture_output=True, text=True, encoding="utf-8", env=variables)


class PlanTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.data, _ = plan.parse_front_matter(EXAMPLE.read_text(encoding="utf-8"))

    def copy(self, source=EXAMPLE):
        target = self.tmp / "plan.md"
        shutil.copyfile(source, target)
        return target

    def write_data(self, data):
        target = self.tmp / "plan.md"
        target.write_text(plan.compose(data), encoding="utf-8")
        return target

    def parsed(self, path):
        data, _ = plan.parse_front_matter(Path(path).read_text(encoding="utf-8"))
        return data

    def test_example_and_fixture_check(self):
        for source in (EXAMPLE, FIXTURES / "valid.md"):
            with self.subTest(source=source.name):
                result = run("check", source)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stderr, "")

    def test_new_creates_at_nearest_git_root(self):
        root = self.tmp / "repo"
        nested = root / "one" / "two"
        nested.mkdir(parents=True)
        (root / ".git").mkdir(parents=True)
        result = run("new", "--title", "Restart the edge proxy", "--goal", "Apply the new config",
                     "--start", nested)
        self.assertEqual(result.returncode, 0, result.stderr)
        created = Path(result.stdout.strip())
        self.assertEqual(created.parent, root / ".gti" / "infra-expert" / "plans")
        self.assertTrue(created.name.endswith("-restart-the-edge-proxy.md"))
        data = self.parsed(created)
        self.assertEqual(data["status"], "draft")
        self.assertTrue(data["goal"])
        self.assertEqual(data["steps"], [])
        self.assertEqual(run("check", created).returncode, 0)

    def test_new_uses_slug(self):
        root = self.tmp / "repo"
        (root / ".git").mkdir(parents=True)
        result = run("new", "--title", "A long title that should not be used", "--goal", "Goal",
                     "--slug", "short", "--start", root)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(Path(result.stdout.strip()).name.endswith("-short.md"))

    def test_list_shows_status_newest_first(self):
        root = self.tmp / "repo"
        (root / ".git").mkdir(parents=True)
        run("new", "--title", "First change", "--goal", "One", "--slug", "first", "--start", root)
        second = run("new", "--title", "Second change", "--goal", "Two", "--slug", "second", "--start", root)
        self.assertEqual(second.returncode, 0, second.stderr)
        path = Path(second.stdout.strip())
        run("approve", path, "--by", "owner")
        result = run("list", "--start", root)
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = [line for line in result.stdout.splitlines() if line.strip()]
        self.assertEqual(len(lines), 2)
        self.assertIn("-second", lines[0])
        self.assertIn("approved", lines[0])
        self.assertIn("-first", lines[1])
        self.assertIn("draft", lines[1])

    def test_check_reports_each_problem(self):
        cases = []

        def unknown_status(data):
            data["status"] = "yolo"
        cases.append((unknown_status, "unknown plan status"))

        def unknown_risk(data):
            data["risk"] = "yolo"
        cases.append((unknown_risk, "unknown risk"))

        def empty_downtime_reason(data):
            data["downtime"]["reason"] = ""
        cases.append((empty_downtime_reason, "downtime has no reason"))

        def duplicate_step(data):
            data["steps"].append(dict(data["steps"][0]))
        cases.append((duplicate_step, "duplicate step id"))

        def unknown_dependency(data):
            data["steps"][0]["depends_on"] = ["missing"]
        cases.append((unknown_dependency, "depends on unknown step"))

        def missing_verify(data):
            data["steps"][0]["verify"] = ""
        cases.append((missing_verify, "missing 'verify'"))

        def missing_rollback(data):
            data["steps"][0].pop("rollback")
        cases.append((missing_rollback, "missing 'rollback'"))

        def downtime_step_without_approval(data):
            data["steps"][0]["rollout"] = "needs-downtime"
            data["steps"][0]["requires_approval"] = False
        cases.append((downtime_step_without_approval, "must require approval"))

        def bad_method(data):
            data["steps"][0]["method"] = "yolo"
        cases.append((bad_method, "unknown method"))

        def unknown_approval_step(data):
            data["approvals"].append({"decision": "approve", "who": "x", "when": "now", "step": "missing"})
        cases.append((unknown_approval_step, "approval names unknown step"))

        for mutate, fragment in cases:
            with self.subTest(fragment=fragment):
                data = copy.deepcopy(self.data)
                mutate(data)
                result = run("check", self.write_data(data))
                self.assertEqual(result.returncode, 1)
                self.assertIn(fragment, result.stderr)

    def test_check_detects_stale_body(self):
        text = (FIXTURES / "stale.md").read_text(encoding="utf-8")
        path = self.tmp / "stale.md"
        path.write_text(text, encoding="utf-8")
        result = run("check", path)
        self.assertEqual(result.returncode, 1)
        self.assertIn("body is stale", result.stderr)

    def test_render_fixes_stale_body(self):
        path = self.copy(FIXTURES / "stale.md")
        self.assertEqual(run("check", path).returncode, 1)
        result = run("render", path)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(run("check", path).returncode, 0)

    def test_summary_text(self):
        result = run("summary", EXAMPLE)
        self.assertEqual(result.returncode, 0, result.stderr)
        text = result.stdout
        self.assertIn("Plan " + self.data["id"], text)
        self.assertIn(self.data["goal"], text)
        self.assertIn("Risk: medium", text)
        self.assertIn("- backup-config:", text)
        self.assertIn("- upgrade-node-one:", text)
        self.assertIn("Needs a decision:", text)

    def test_summary_slack_actions(self):
        result = run("summary", EXAMPLE, "--format", "slack")
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertIn("Plan " + self.data["id"], payload["message"])
        blocks = payload["actions"]["blocks"]
        self.assertEqual(blocks[0]["type"], "section")
        self.assertEqual(blocks[1]["type"], "actions")
        buttons = blocks[1]["elements"]
        pairs = [(button["text"]["text"], button["value"]) for button in buttons]
        self.assertIn(("Approve plan", "approve-plan:" + self.data["id"]), pairs)
        self.assertIn(("Reject plan", "reject-plan:" + self.data["id"]), pairs)
        self.assertIn(("Approve upgrade-node-one", "approve-step:" + self.data["id"] + ":upgrade-node-one"), pairs)
        self.assertIn(("Reject upgrade-node-one", "reject-step:" + self.data["id"] + ":upgrade-node-one"), pairs)
        self.assertNotIn(("Approve backup-config", "approve-step:" + self.data["id"] + ":backup-config"), pairs)
        for button in buttons:
            self.assertEqual(button["type"], "button")
            self.assertTrue(button["action_id"])

    def test_summary_telegram_actions(self):
        result = run("summary", EXAMPLE, "--format", "telegram")
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertIn(self.data["title"], payload["message"])
        rows = payload["actions"]["inline_keyboard"]
        self.assertEqual(len(rows), 3)
        first = {(item["text"], item["callback_data"]) for item in rows[0]}
        self.assertEqual(first, {
            ("Approve plan", "approve-plan:" + self.data["id"]),
            ("Reject plan", "reject-plan:" + self.data["id"]),
        })
        second = {(item["text"], item["callback_data"]) for item in rows[1]}
        self.assertEqual(second, {
            ("Approve upgrade-node-one", "approve-step:" + self.data["id"] + ":upgrade-node-one"),
            ("Reject upgrade-node-one", "reject-step:" + self.data["id"] + ":upgrade-node-one"),
        })
        for row in rows:
            for item in row:
                self.assertTrue(item["callback_data"].startswith(("approve-", "reject-")))

    def test_approve_plan_and_step(self):
        path = self.copy()
        result = run("approve", path, "--by", "change owner")
        self.assertEqual(result.returncode, 0, result.stderr)
        data = self.parsed(path)
        self.assertEqual(data["status"], "approved")
        self.assertEqual(data["approvals"][-1]["step"], "")
        result = run("approve", path, "--step", "upgrade-other-nodes", "--by", "change owner")
        self.assertEqual(result.returncode, 0, result.stderr)
        data = self.parsed(path)
        self.assertEqual(data["approvals"][-1]["step"], "upgrade-other-nodes")
        step = next(item for item in data["steps"] if item["id"] == "upgrade-other-nodes")
        self.assertEqual(step["status"], "approved")
        self.assertEqual(run("check", path).returncode, 0)

    def test_reject_plan_and_step(self):
        path = self.copy()
        result = run("reject", path, "--step", "backup-config", "--by", "owner", "--reason", "no window")
        self.assertEqual(result.returncode, 0, result.stderr)
        data = self.parsed(path)
        step = next(item for item in data["steps"] if item["id"] == "backup-config")
        self.assertEqual(step["status"], "skipped")
        self.assertEqual(data["approvals"][-1]["decision"], "reject")
        self.assertEqual(data["approvals"][-1]["reason"], "no window")
        result = run("reject", path, "--by", "owner")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.parsed(path)["status"], "rejected")
        self.assertEqual(run("check", path).returncode, 0)

    def test_step_guard_requires_approval(self):
        path = self.copy()
        result = run("step", path, "upgrade-other-nodes", "--status", "applied")
        self.assertEqual(result.returncode, 1)
        self.assertIn("requires approval", result.stderr)
        result = run("approve", path, "--step", "upgrade-other-nodes", "--by", "owner")
        self.assertEqual(result.returncode, 0, result.stderr)
        result = run("step", path, "upgrade-other-nodes", "--status", "applied")
        self.assertEqual(result.returncode, 1)
        self.assertIn("not verified", result.stderr)

    def test_step_guard_dependency(self):
        path = self.copy()
        for step_id in ("upgrade-node-one", "upgrade-other-nodes"):
            self.assertEqual(run("approve", path, "--step", step_id, "--by", "owner").returncode, 0)
        blocked = run("step", path, "upgrade-node-one", "--status", "applied")
        self.assertEqual(blocked.returncode, 1)
        self.assertIn("not verified", blocked.stderr)
        self.assertEqual(run("step", path, "backup-config", "--status", "verified").returncode, 0)
        result = run("step", path, "upgrade-node-one", "--status", "applied")
        self.assertEqual(result.returncode, 0, result.stderr)
        result = run("step", path, "upgrade-node-one", "--status", "verified")
        self.assertEqual(result.returncode, 0, result.stderr)
        result = run("step", path, "upgrade-other-nodes", "--status", "applied")
        self.assertEqual(result.returncode, 0, result.stderr)
        data = self.parsed(path)
        step = next(item for item in data["steps"] if item["id"] == "upgrade-other-nodes")
        self.assertEqual(step["status"], "applied")
        self.assertEqual(run("check", path).returncode, 0)

    def test_step_appends_log_and_renders(self):
        path = self.copy()
        result = run("step", path, "backup-config", "--status", "applied", "--log", "Backup written to /var/backups")
        self.assertEqual(result.returncode, 0, result.stderr)
        data = self.parsed(path)
        step = next(item for item in data["steps"] if item["id"] == "backup-config")
        self.assertEqual(step["status"], "applied")
        self.assertEqual(len(step["log"]), 1)
        self.assertEqual(step["log"][0]["text"], "Backup written to /var/backups")
        self.assertTrue(step["log"][0]["at"])
        self.assertIn("Backup written to /var/backups", Path(path).read_text(encoding="utf-8"))
        self.assertEqual(run("check", path).returncode, 0)

    def test_step_rejects_unknown_step(self):
        path = self.copy()
        result = run("step", path, "missing", "--status", "applied")
        self.assertEqual(result.returncode, 1)
        self.assertIn("step not found", result.stderr)

    def test_yaml_round_trip(self):
        data = {
            "id": "20261119-special",
            "title": 'A title with "quotes", a colon: and a | pipe',
            "goal": "Unicode café and a [bracket] plus {brace}.",
            "created": "2026-11-19",
            "status": "draft",
            "risk": "low",
            "downtime": {"kind": "none", "reason": "reload in place"},
            "approvals": [],
            "source": "",
            "scope": ["a", "b with spaces"],
            "steps": [{
                "id": "s1",
                "title": "step",
                "target": "host-01",
                "method": "cli",
                "change": "echo 'a: b' > file",
                "rollout": "no-restart",
                "backup": "none",
                "verify": "line one\nline two",
                "rollback": "none",
                "depends_on": [],
                "requires_approval": False,
                "status": "pending",
                "log": [],
            }],
        }
        text = plan.compose(data)
        parsed, body = plan.parse_front_matter(text)
        self.assertEqual(parsed, data)
        self.assertIn("## How to apply", body)
        self.assertEqual(plan.validate(parsed, text), [])


if __name__ == "__main__":
    unittest.main()
