import importlib.util
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
SCRIPT = SKILL / "scripts" / "diagram" / "diagram.py"
FIXTURES = Path(__file__).resolve().parent / "fixtures" / "diagram"


def module():
    spec = importlib.util.spec_from_file_location("diagram", str(SCRIPT))
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


def run(gti_home, *args):
    environment = {**os.environ, "GTI_HOME": str(gti_home)}
    return subprocess.run([sys.executable, str(SCRIPT), *map(str, args)],
                          capture_output=True, text=True, encoding="utf-8", env=environment)


def output(gti_home, suffix, name):
    matches = list(gti_home.rglob("{}.{}".format(name, suffix)))
    return matches[0] if len(matches) == 1 else None


class DiagramCommandTest(unittest.TestCase):
    def setUp(self):
        self.home = Path(tempfile.mkdtemp())

    def draw(self, name, *args):
        result = run(self.home, *args)
        self.assertEqual(result.returncode, 0, result.stderr)
        mmd = output(self.home, "mmd", name)
        page = output(self.home, "html", name)
        self.assertIsNotNone(mmd, result.stdout + result.stderr)
        self.assertIsNotNone(page, result.stdout + result.stderr)
        return mmd.read_text(encoding="utf-8"), page.read_text(encoding="utf-8")

    def test_terraform_groups_by_layer_and_draws_module_calls(self):
        source, page = self.draw("terraform", "terraform", "--scan", FIXTURES / "scan.json",
                                 "--direction", "LR", "--title", "Infrastructure graph")
        for group in ("foundation", "network", "compute", "other"):
            self.assertIn('sg_{}["{}"]'.format(group, group), source)
        self.assertIn("services_api -->|\"net\"| network", source)
        self.assertIn("services_web -->|\"net\"| network", source)
        self.assertIn("services_api -->|\"tags\"| modules_tags", source)
        self.assertIn("flowchart LR", source)
        self.assertIn("% Infrastructure graph", source)
        self.assertIn(MODULE().MERMAID_URL, page)
        self.assertIn("services_api", page)

    def test_compose_includes_ports_networks_volumes_and_dependencies(self):
        source, page = self.draw("compose", "compose", FIXTURES / "compose.yaml")
        for name in ("web", "api", "db", "front", "back", "site", "dbdata"):
            self.assertIn(name, source)
        self.assertIn("8080:80", source)
        self.assertIn("web -->|\"depends on\"| api", source)
        self.assertIn("api -->|\"depends on\"| db", source)
        self.assertIn("web -->|\"mount\"| volume_site", source)
        self.assertIn("sg_services", source)
        self.assertIn("sg_networks", source)
        self.assertIn("flowchart TB", source)
        self.assertIn("Mermaid source", page)

    def test_packages_finds_internal_edges_and_skips_dependencies(self):
        source, _ = self.draw("packages", "packages", FIXTURES / "packages")
        for name in ("app", "lib", "tool", "core"):
            self.assertIn('"{}"'.format(name), source)
        self.assertIn("app --> lib", source)
        self.assertIn("app --> tool", source)
        self.assertIn("lib --> core", source)
        self.assertNotIn("ghost", source)
        self.assertIn("sg_npm", source)
        self.assertIn("sg_python", source)

    def test_hosts_groups_by_the_group_column(self):
        source, _ = self.draw("hosts", "hosts", FIXTURES / "hosts.md")
        for name in ("edge_01", "db_01", "worker_01"):
            self.assertIn(name, source)
        self.assertIn("project-cli edge-01", source)
        self.assertIn('sg_edge["edge"]', source)
        self.assertIn('sg_data["data"]', source)

    def test_hosts_can_group_by_kind(self):
        source, _ = self.draw("hosts-kind", "hosts", FIXTURES / "hosts.md",
                              "--group-by", "kind", "--name", "hosts-kind")
        self.assertIn('sg_virtual_machine["Virtual machine"]', source)
        self.assertIn('sg_database["Database"]', source)

    def test_flow_reads_kinds_lanes_edge_labels_and_redacts(self):
        source, page = self.draw("flow", "flow", FIXTURES / "flow.yaml")
        self.assertIn('sg_edge["Edge"]', source)
        self.assertIn('sg_application["Application"]', source)
        self.assertIn('client(["Client"])', source)
        self.assertIn('valid{"Valid request?"}', source)
        self.assertIn('db[("Database")]', source)
        self.assertIn('client -->|"HTTPS"| gateway', source)
        self.assertIn('valid -->|"yes"| api', source)
        self.assertIn("Say 'hi'; gateway", source)
        self.assertNotIn('Say "hi"', source)
        self.assertIn("token=<redacted>", source)
        self.assertNotIn("abcdefghijklmnopqrstuvwxyz012345", source)
        self.assertIn("&lt;redacted&gt;", page)
        self.assertNotIn("abcdefghijklmnopqrstuvwxyz012345", page)

    def test_flow_accepts_json_input(self):
        source, _ = self.draw("deploy", "flow", FIXTURES / "flow.json", "--name", "deploy")
        self.assertIn("% Deploy flow", source)
        self.assertIn('sg_pipeline["Pipeline"]', source)
        self.assertIn('test{"Tests pass?"}', source)
        self.assertIn('test -->|"yes"| deploy', source)

    def test_max_nodes_collapses_each_group(self):
        source, _ = self.draw("flow-capped", "flow", FIXTURES / "flow.yaml",
                              "--max-nodes", "2", "--name", "flow-capped")
        self.assertIn('more_application["+1 more"]', source)
        self.assertIn("more_application", source)
        self.assertNotIn('db[("Database")]', source)

    def test_name_and_out_are_honored(self):
        out = self.home / "chosen"
        result = run(self.home, "flow", FIXTURES / "flow.yaml", "--out", out, "--name", "chosen-name")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((out / "chosen-name.mmd").is_file())
        self.assertTrue((out / "chosen-name.html").is_file())

    def test_nothing_is_written_into_the_repository(self):
        before = {path for path in SKILL.rglob("*.mmd")}
        result = run(self.home, "terraform", "--scan", FIXTURES / "scan.json")
        self.assertEqual(result.returncode, 0, result.stderr)
        after = {path for path in SKILL.rglob("*.mmd")}
        self.assertEqual(before, after)


class HelpersTest(unittest.TestCase):
    def test_redaction_covers_the_secret_heuristic(self):
        diagram = module()
        cases = [
            ("password=abcdefghijklmnop", "password=<redacted>"),
            ("token: xyz123456789", "token=<redacted>"),
            ("key sk-abcdefghijklmnopqrstuvwx", "key <redacted>"),
            ("AKIA1234567890ABCDEF", "<redacted>"),
            ("abcd1234abcd1234abcd1234abcd1234", "<redacted>"),
        ]
        for value, expected in cases:
            self.assertIn(expected, diagram.redact(value), value)
            self.assertNotIn(value.split()[-1], diagram.redact(value).replace("<redacted>", ""))

    def test_mermaid_label_escapes_quotes_and_newlines(self):
        diagram = module()
        self.assertEqual(diagram.mermaid_label('Say "hi"\nnow'), '"Say \'hi\' now"')

    def test_module_target_resolves_local_sources(self):
        diagram = module()
        self.assertEqual(diagram.module_target("services/api", "../../network"), "network")
        self.assertEqual(diagram.module_target("services/api", "./local"), "services/api/local")
        self.assertIsNone(diagram.module_target("network", "registry/module"))


def MODULE():
    """The loaded script, shared by all tests that need its constants."""
    if not hasattr(MODULE, "cached"):
        MODULE.cached = module()
    return MODULE.cached


if __name__ == "__main__":
    unittest.main()
