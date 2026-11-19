import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL / "scripts" / "cve"
FIXTURES = Path(__file__).resolve().parent / "fixtures" / "cve"
EXAMPLE = SKILL / "assets" / "templates" / "cve-findings.example.json"


def run(script, *args, home=None, env=None):
    variables = dict(os.environ)
    if home is not None:
        variables["GTI_HOME"] = str(home)
    if env:
        variables.update(env)
    return subprocess.run([sys.executable, str(SCRIPTS / script), *map(str, args)],
                          capture_output=True, text=True, encoding="utf-8", env=variables)


class CveLookupTest(unittest.TestCase):
    def setUp(self):
        self.home = Path(tempfile.mkdtemp())

    def test_osv_from_file(self):
        result = run("cve_lookup.py", "osv", "--id", "CVE-2026-12345",
                     "--from-file", FIXTURES / "osv.json", home=self.home)
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertEqual(data["id"], "CVE-2026-12345")
        self.assertIn("GHSA-9x9x-9x9x-9x9x", data["aliases"])
        self.assertTrue(data["summary"])
        self.assertTrue(data["severity"])
        self.assertTrue(data["references"])
        nginx = next(item for item in data["affected"] if item["package"]["name"] == "nginx")
        self.assertIn("1.31.9", nginx["fixed"])
        self.assertIn("introduced", nginx["ranges"][0]["events"][0])

    def test_query_from_file(self):
        result = run("cve_lookup.py", "query", "--ecosystem", "Debian:12",
                     "--package", "nginx", "--version", "1.31.8",
                     "--from-file", FIXTURES / "query.json", home=self.home)
        self.assertEqual(result.returncode, 0, result.stderr)
        matches = json.loads(result.stdout)["matches"]
        self.assertEqual([item["id"] for item in matches], ["CVE-2026-12345", "CVE-2026-99304"])
        self.assertIn("1.31.9", matches[0]["fixed"])
        self.assertEqual(matches[1]["fixed"], [])

    def test_kev_from_file(self):
        result = run("cve_lookup.py", "kev", "--id", "CVE-2026-12345",
                     "--from-file", FIXTURES / "kev.json", home=self.home)
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertTrue(data["listed"])
        self.assertEqual(data["dateAdded"], "2026-11-18")
        other = run("cve_lookup.py", "kev", "--id", "CVE-2099-00001",
                    "--from-file", FIXTURES / "kev.json", home=self.home)
        self.assertEqual(other.returncode, 0, other.stderr)
        data = json.loads(other.stdout)
        self.assertFalse(data["listed"])
        self.assertIsNone(data["dateAdded"])

    def test_state_filters_seen_ids(self):
        args = ("query", "--ecosystem", "Debian:12", "--package", "nginx", "--version", "1.31.8",
                "--from-file", FIXTURES / "query.json", "--state")
        first = run("cve_lookup.py", *args, home=self.home)
        self.assertEqual(first.returncode, 0, first.stderr)
        first_ids = [item["id"] for item in json.loads(first.stdout)["matches"]]
        self.assertEqual(len(first_ids), 2)

        states = list(self.home.rglob("state.json"))
        self.assertEqual(len(states), 1)
        state = json.loads(states[0].read_text(encoding="utf-8"))
        self.assertTrue(state["last_run"])
        self.assertEqual(sorted(state["seen"]), sorted(first_ids))

        second = run("cve_lookup.py", *args, home=self.home)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(second.stdout.strip(), "")
        saved = json.loads(states[0].read_text(encoding="utf-8"))
        self.assertEqual(saved["seen"], state["seen"])


class CveReportTest(unittest.TestCase):
    def setUp(self):
        self.home = Path(tempfile.mkdtemp())
        self.data = json.loads(EXAMPLE.read_text(encoding="utf-8"))

    def write(self, data):
        path = self.home / "findings.json"
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return path

    def check(self, data):
        return run("cve_report.py", self.write(data), "--check", home=self.home)

    def render(self, data, *flags):
        out = self.home / "report.md"
        result = run("cve_report.py", self.write(data), "--out", out, *flags, home=self.home)
        return result, out

    def test_example_checks(self):
        result = self.check(self.data)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, "")

    def test_validation_errors(self):
        cases = []

        def unknown_status(data):
            data["cves"][0]["services"][0]["status"] = "yolo"
        cases.append((unknown_status, "unknown status"))

        def missing_version_and_condition(data):
            data["cves"][0]["services"][0]["version"] = ""
            data["cves"][0]["services"][0]["condition"] = ""
        cases.append((missing_version_and_condition, "without version and condition"))

        def missing_reason(data):
            service = data["cves"][0]["services"][0]
            service["status"] = "not-checked"
            service.pop("reason", None)
        cases.append((missing_reason, "not-checked without reason"))

        def no_services(data):
            data["cves"][0]["services"] = []
        cases.append((no_services, "no services"))

        def duplicate_service(data):
            data["cves"][0]["services"].append(dict(data["cves"][0]["services"][0]))
        cases.append((duplicate_service, "duplicate service"))

        for mutate, fragment in cases:
            with self.subTest(fragment=fragment):
                data = copy.deepcopy(self.data)
                mutate(data)
                result = self.check(data)
                self.assertEqual(result.returncode, 1)
                self.assertIn(fragment, result.stderr)
                self.assertEqual(len(result.stderr.strip().splitlines()), 1)

    def test_left_to_do_requires_rollout(self):
        data = copy.deepcopy(self.data)
        data["left_to_do"][0].pop("rollout")
        result = self.check(data)
        self.assertEqual(result.returncode, 1)
        self.assertIn("missing 'rollout'", result.stderr)

    def test_left_to_do_rejects_unknown_rollout(self):
        data = copy.deepcopy(self.data)
        data["left_to_do"][0]["rollout"] = "yolo"
        result = self.check(data)
        self.assertEqual(result.returncode, 1)
        self.assertIn("unknown rollout 'yolo'", result.stderr)

    def test_left_to_do_requires_text(self):
        data = copy.deepcopy(self.data)
        data["left_to_do"][0].pop("text")
        result = self.check(data)
        self.assertEqual(result.returncode, 1)
        self.assertIn("missing 'text'", result.stderr)

    def test_render_shows_rollout_and_downtime_decisions(self):
        result, out = self.render(self.data)
        self.assertEqual(result.returncode, 0, result.stderr)
        text = out.read_text(encoding="utf-8")
        heading = text.index("## Needs a downtime decision (the user must decide)")
        left = text.index("## Left to do")
        ending = text.index("Nothing was upgraded or restarted.")
        self.assertIn("(rollout: rolling)", text)
        self.assertLess(text.index("(rollout: rolling)"), heading)
        item = text.index("needs downtime: ask the user before the kernel upgrade")
        self.assertGreater(item, heading)
        self.assertGreater(item, left)
        self.assertLess(item, ending)

    def test_render_orders_cves_and_groups_services(self):
        result, out = self.render(self.data)
        self.assertEqual(result.returncode, 0, result.stderr)
        text = out.read_text(encoding="utf-8")
        self.assertLess(text.index("CVE-2026-12345"), text.index("CVE-2026-99304"))
        self.assertIn("6 hosts", text)
        self.assertIn("and 3 more", text)
        self.assertEqual(text.count("| possible |"), 1)
        self.assertIn("## Summary", text)
        self.assertIn("## Results", text)
        self.assertIn("## Affected and possible", text)
        self.assertIn("## Not applicable", text)
        self.assertIn("## Not checked", text)
        self.assertIn("## Left to do", text)
        self.assertTrue(text.rstrip().endswith("Nothing was upgraded or restarted."))

    def test_default_output_under_gti_home(self):
        result = run("cve_report.py", self.write(self.data), home=self.home)
        self.assertEqual(result.returncode, 0, result.stderr)
        out = Path(result.stdout.strip())
        self.assertTrue(str(out).startswith(str(self.home)))
        self.assertTrue(out.exists())


if __name__ == "__main__":
    unittest.main()
