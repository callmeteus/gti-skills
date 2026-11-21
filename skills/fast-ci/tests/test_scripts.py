"""Tests for the Fast CI scripts.

The timing tests feed small API payloads shaped like GitHub Actions, Gitea and Forgejo, Woodpecker,
GitLab, Jenkins, and Kubernetes pods, then check the normalized rows and the analysis. The shard tests
plan, list, and verify against JUnit XML written to a temporary folder. The rollback tests scan a small
repository written to a temporary folder and time a drill. Nothing touches the network.
"""

import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))

from audit import ci_timings as ct  # noqa: E402
from rollback import rollback_check as rc  # noqa: E402
from shards import shard_plan as sp  # noqa: E402

T0 = 1_700_000_000


def iso(offset):
    from datetime import datetime, timezone
    return datetime.fromtimestamp(T0 + offset, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class TimeParsingTests(unittest.TestCase):
    def test_iso_epoch_seconds_and_milliseconds_all_become_epoch_seconds(self):
        self.assertEqual(ct.ts(iso(10)), T0 + 10)
        self.assertEqual(ct.ts(T0 + 10), T0 + 10)
        self.assertEqual(ct.ts((T0 + 10) * 1000), T0 + 10)
        self.assertEqual(ct.ts("2024-01-01T00:00:00.123456789+00:00"), ct.ts("2024-01-01T00:00:00.123456+00:00"))

    def test_empty_and_zero_dates_are_unknown(self):
        for value in (None, "", 0, "0001-01-01T00:00:00Z", "not a date"):
            self.assertIsNone(ct.ts(value))


class ParserTests(unittest.TestCase):
    def test_github_splits_setup_steps_from_running_steps(self):
        runs = [{"id": 1, "event": "pull_request", "head_branch": "feat", "run_attempt": 1, "created_at": iso(0)}]
        jobs = {1: [{"name": "test", "conclusion": "success", "created_at": iso(0), "started_at": iso(20),
                     "completed_at": iso(80), "steps": [
                         {"name": "Set up job", "started_at": iso(20), "completed_at": iso(22)},
                         {"name": "Run actions/checkout@v4", "started_at": iso(22), "completed_at": iso(30)},
                         {"name": "bun test", "started_at": iso(30), "completed_at": iso(80)}]}]}
        [r] = ct.parse_github(runs, jobs)
        self.assertEqual(ct.job_parts(r), (20.0, 10.0, 50.0))
        self.assertFalse(r["approx"])

    def test_forgejo_tasks_have_no_steps_and_are_marked_approximate(self):
        [r] = ct.parse_gitea_tasks([{"id": 7, "run_number": 3, "name": "lint", "status": "success",
                                     "created_at": iso(0), "run_started_at": iso(4), "updated_at": iso(14)}])
        self.assertTrue(r["approx"])
        self.assertEqual(ct.job_parts(r), (4.0, None, 10.0))

    def test_woodpecker_reads_workflows_and_their_steps_in_unix_seconds(self):
        pipe = {"number": 9, "event": "push", "branch": "main", "created": T0, "workflows": [
            {"name": "ci", "state": "success", "started": T0 + 3, "finished": T0 + 40, "children": [
                {"name": "clone", "started": T0 + 3, "finished": T0 + 8},
                {"name": "test", "started": T0 + 8, "finished": T0 + 40}]}]}
        [r] = ct.parse_woodpecker([pipe])
        self.assertEqual(ct.job_parts(r), (3.0, 5.0, 32.0))

    def test_woodpecker_accepts_the_legacy_procs_key(self):
        pipe = {"number": 1, "created": T0, "procs": [{"name": "ci", "start_time": T0 + 1, "end_time": T0 + 2}]}
        self.assertEqual(len(ct.parse_woodpecker([pipe])), 1)

    def test_gitlab_uses_queued_duration_for_waiting(self):
        pipes = [{"id": 5, "ref": "main", "source": "merge_request_event", "created_at": iso(0)}]
        jobs = {5: [{"name": "rspec", "status": "success", "created_at": iso(0), "queued_duration": 12.5,
                     "started_at": iso(15), "finished_at": iso(45)}]}
        [r] = ct.parse_gitlab(pipes, jobs)
        self.assertEqual(ct.job_parts(r)[0], 12.5)

    def test_jenkins_counts_queue_time_and_checkout_stages(self):
        build = {"id": "42", "status": "SUCCESS", "startTimeMillis": (T0 + 30) * 1000, "durationMillis": 60000,
                 "queueDurationMillis": 30000, "stages": [
                     {"name": "Declarative: Checkout SCM", "startTimeMillis": (T0 + 30) * 1000, "durationMillis": 9000},
                     {"name": "Test", "startTimeMillis": (T0 + 39) * 1000, "durationMillis": 51000}]}
        [r] = ct.parse_jenkins([build], "app/main")
        self.assertEqual(ct.job_parts(r), (30.0, 9.0, 51.0))

    def test_k8s_pod_waiting_is_scheduling_and_setup_is_pull_and_init(self):
        pods = {"items": [{
            "metadata": {"name": "build-x7k2p-test-pod", "creationTimestamp": iso(0),
                         "labels": {"tekton.dev/pipelineRun": "build-x7k2p", "tekton.dev/pipelineTask": "test"}},
            "status": {"phase": "Succeeded",
                       "conditions": [{"type": "PodScheduled", "status": "True", "lastTransitionTime": iso(2)}],
                       "containerStatuses": [{"state": {"terminated": {"startedAt": iso(20), "finishedAt": iso(50)}}}]}}]}
        [r] = ct.parse_k8s_pods(pods, "tekton.dev/pipelineRun", "tekton.dev/pipelineTask")
        self.assertEqual((r["run_id"], r["job"]), ("build-x7k2p", "test"))
        self.assertEqual(ct.job_parts(r), (2.0, 18.0, 30.0))

    def test_k8s_pods_still_pending_are_skipped(self):
        pods = {"items": [{"metadata": {"name": "p"}, "status": {"containerStatuses": [{"state": {"waiting": {}}}]}}]}
        self.assertEqual(ct.parse_k8s_pods(pods), [])


def make_run(run_id, wait, setup, running, attempt=1, day=0):
    start = T0 + day * 86400
    return ct.row(platform="github", run_id=str(run_id), job="test", attempt=attempt, run_created=start,
                  queued=start, started=start + wait, finished=start + wait + setup + running, setup_s=setup)


class AnalyzeTests(unittest.TestCase):
    def test_percentiles_use_nearest_rank(self):
        self.assertEqual(ct.percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50), 5)
        self.assertEqual(ct.percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10)
        self.assertIsNone(ct.percentile([], 50))

    def test_biggest_bucket_and_budget_violations(self):
        rows = [make_run(i, wait=40, setup=10, running=20) for i in range(10)]
        result = ct.analyze(rows)
        self.assertEqual(result["biggest_bucket"], "waiting")
        self.assertEqual(result["summary"]["time_to_result_p50"], 70)
        whats = {v["what"] for v in result["violations"]}
        self.assertIn("time_to_result_p50", whats)
        self.assertIn("test waiting p50", whats)
        self.assertNotIn("test setup p50", whats)

    def test_time_to_result_is_the_slowest_job_not_the_sum(self):
        a = make_run(1, 1, 1, 10)
        b = dict(make_run(1, 1, 1, 30), job="lint")
        self.assertEqual(ct.analyze([a, b])["summary"]["time_to_result_p50"], 32)

    def test_per_job_budgets_override_the_default_job_budget(self):
        rows = [make_run(i, 1, 5, 50) for i in range(3)]
        self.assertTrue(any(v["what"] == "test job p50" for v in ct.analyze(rows)["violations"]))
        self.assertFalse(any(v["what"] == "test job p50"
                             for v in ct.analyze(rows, {"per_job": {"test": 60}})["violations"]))

    def test_monthly_cost_and_rerun_share(self):
        rows = [make_run(i, 0, 0, 60, attempt=2 if i == 0 else 1, day=i) for i in range(11)]
        s = ct.analyze(rows, price_per_minute=0.01)["summary"]
        self.assertAlmostEqual(s["runs_per_day"], 1.1)
        self.assertAlmostEqual(s["billable_minutes_per_month"], 33.0)
        self.assertAlmostEqual(s["cost_per_month"], 0.33)
        self.assertAlmostEqual(s["rerun_share"], 1 / 11)

    def test_unfinished_runs_are_left_out(self):
        rows = [make_run(1, 1, 1, 1), dict(make_run(2, 1, 1, 1), finished=None)]
        self.assertEqual(ct.analyze(rows)["summary"]["runs"], 1)

    def test_markdown_names_the_biggest_bucket(self):
        md = ct.render_markdown(ct.analyze([make_run(1, 1, 30, 5)]), ["x.jsonl"])
        self.assertIn("| setup (biggest) |", md)


class CliTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["GTI_HOME"] = self.tmp.name

    def tearDown(self):
        os.environ.pop("GTI_HOME", None)
        self.tmp.cleanup()

    def test_record_then_analyze_writes_under_gti_home(self):
        code = ct.main(["--project", "demo", "record", "--job", "lint", "--run", "r1", "--",
                        sys.executable, "-c", "pass"])
        self.assertEqual(code, 0)
        rows_file = Path(self.tmp.name) / "fast-ci" / "demo" / "timings" / "manual.jsonl"
        self.assertTrue(rows_file.exists())
        with redirect_stdout(io.StringIO()):
            self.assertEqual(ct.main(["--project", "demo", "analyze", str(rows_file)]), 0)
        self.assertTrue(list((Path(self.tmp.name) / "fast-ci" / "demo" / "audits").glob("*.md")))

    def test_record_returns_the_command_exit_code(self):
        code = ct.main(["--project", "demo", "record", "--job", "t", "--", sys.executable, "-c", "raise SystemExit(3)"])
        self.assertEqual(code, 3)

    def test_csv_rows_are_accepted(self):
        path = Path(self.tmp.name) / "rows.csv"
        path.write_text("platform,run_id,job,queued,started,finished,setup_s\n"
                        "manual,1,build,%s,%s,%s,2\n" % (iso(0), iso(1), iso(11)), encoding="utf-8")
        [r] = ct.read_rows([path])
        self.assertEqual(ct.job_parts(r), (1.0, 2.0, 8.0))


JUNIT = """<?xml version="1.0"?>
<testsuites>
  <testsuite name="src/a.test.ts" time="30"><testcase name="x" time="30"/></testsuite>
  <testsuite name="src/b.test.ts" time="12"><testcase name="y" time="12"/></testsuite>
  <testsuite name="src/c.test.ts" time="10"><testcase name="z" time="10"/></testsuite>
  <testsuite name="src/d.test.ts" time="8"><testcase name="w" time="8"/></testsuite>
</testsuites>"""

PYTEST = """<?xml version="1.0"?>
<testsuites><testsuite name="pytest" time="5">
  <testcase classname="tests.test_api" file="tests/test_api.py" name="a" time="2"/>
  <testcase classname="tests.test_api" file="tests/test_api.py" name="b" time="1"/>
  <testcase classname="tests.test_db" file="tests/test_db.py" name="c" time="2"/>
</testsuite></testsuites>"""


class ShardTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        (self.dir / "main.xml").write_text(JUNIT, encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def test_reads_suite_times_and_testcase_file_attributes(self):
        self.assertEqual(sp.read_timings([self.dir / "main.xml"])["src/a.test.ts"], 30)
        (self.dir / "py.xml").write_text(PYTEST, encoding="utf-8")
        self.assertEqual(sp.read_timings([self.dir / "py.xml"]), {"tests/test_api.py": 3.0, "tests/test_db.py": 2.0})

    def test_plan_balances_by_time_and_flags_slow_files(self):
        result = sp.plan(sp.read_timings([self.dir / "main.xml"]), 2)
        self.assertEqual(result["shards"], [["src/a.test.ts"], ["src/b.test.ts", "src/c.test.ts", "src/d.test.ts"]])
        self.assertEqual(result["loads"], [30.0, 30.0])
        self.assertEqual(result["files_over_limit"], ["src/a.test.ts"])

    def test_new_files_get_the_median_time_and_deleted_files_are_stale(self):
        result = sp.plan({"a": 10.0, "b": 2.0, "gone": 4.0}, 2, files=["a", "b", "new"])
        self.assertEqual(result["missing_timing"], ["new"])
        self.assertEqual(result["stale_timing"], ["gone"])
        self.assertEqual(sorted(sum(result["shards"], [])), ["a", "b", "new"])

    def test_every_file_lands_in_exactly_one_shard(self):
        times = {"f%02d" % i: float(i % 7 + 1) for i in range(40)}
        shards = sp.plan(times, 6)["shards"]
        flat = sum(shards, [])
        self.assertEqual(sorted(flat), sorted(times))
        self.assertEqual(len(flat), len(set(flat)))

    def test_list_prints_one_shard_and_writes_nothing(self):
        out = io.StringIO()
        with redirect_stdout(out):
            code = sp.main(["list", "--timings", str(self.dir / "main.xml"), "--shards", "2", "--index", "1"])
        self.assertEqual(code, 0)
        self.assertEqual(out.getvalue().split(), ["src/a.test.ts"])

    def test_verify_fails_when_a_file_did_not_run(self):
        (self.dir / "shard1.xml").write_text(
            '<testsuite name="src/a.test.ts" time="1"><testcase name="x" time="1"/></testsuite>', encoding="utf-8")
        with redirect_stdout(io.StringIO()):
            code = sp.main(["verify", "--files", "src/a.test.ts", "src/b.test.ts", "--ran", str(self.dir / "shard1.xml")])
        self.assertEqual(code, 1)
        self.assertEqual(sp.verify(["src/a.test.ts", "src/b.test.ts"], ["src/a.test.ts"])["missing"], ["src/b.test.ts"])

    def test_verify_matches_absolute_report_paths_to_relative_files(self):
        self.assertEqual(sp.verify(["src/a.test.ts"], ["/home/runner/work/app/src/a.test.ts"])["missing"], [])


def write_tree(root, files):
    for rel, text in files.items():
        path = Path(root) / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")


class RollbackScanTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def rules(self, files):
        write_tree(self.root, files)
        return {(f["rule"], f["file"]) for f in rc.scan(self.root)["findings"]}

    def test_unsafe_rollback_script_is_flagged_line_by_line(self):
        found = self.rules({"scripts/rollback.sh": "#!/usr/bin/env bash\n"
                            "read -p 'version? ' V\n"
                            "docker build -t app:latest .\n"
                            "kubectl rollout undo deploy/app || true\n"
                            "sleep 30\n"})
        for rule in ("RB001", "RB010", "RB006", "RB003", "RB004", "RB002", "RB009", "RB005", "RP002"):
            self.assertIn((rule, "scripts/rollback.sh"), found)

    def test_safe_rollback_script_run_from_ci_has_no_findings(self):
        found = self.rules({
            "scripts/rollback.sh": "#!/usr/bin/env bash\nset -euo pipefail\n"
                                   "kubectl set image deploy/app app=registry/app@\"$1\"\n"
                                   "kubectl rollout status deploy/app --timeout=120s\n"
                                   "curl -fsS https://staging.example.test/healthz\n",
            ".github/workflows/rollback.yml": "on: workflow_dispatch\njobs:\n  rollback:\n    runs-on: ubuntu-latest\n"
                                              "    timeout-minutes: 5\n    steps:\n"
                                              "      - run: ./scripts/rollback.sh ${{ inputs.digest }}\n"})
        self.assertEqual(found, set())

    def test_repository_that_deploys_with_no_rollback_is_a_blocker(self):
        found = self.rules({".gitlab-ci.yml": "deploy:\n  script:\n    - helm upgrade app ./chart --atomic --timeout 5m\n"})
        self.assertIn(("RP001", "(repository)"), found)

    def test_helm_rollback_job_in_ci_needs_wait_and_upgrade_needs_atomic(self):
        found = self.rules({"Jenkinsfile": "pipeline {\n  stages {\n    stage('Deploy') {\n"
                                           "      steps { sh 'helm upgrade app ./chart' }\n    }\n"
                                           "    stage('Rollback') {\n      steps {\n"
                                           "        sh 'helm rollback app 0'\n      }\n    }\n  }\n}\n"})
        self.assertIn(("RB008", "Jenkinsfile"), found)
        self.assertIn(("RB014", "Jenkinsfile"), found)

    def test_migrations_missing_down_empty_down_and_one_step_drops(self):
        found = self.rules({
            "db/migrations/001_users.up.sql": "CREATE TABLE users (id int);\n",
            "db/migrations/002_drop.up.sql": "ALTER TABLE users DROP COLUMN email;\n",
            "db/migrations/002_drop.down.sql": "ALTER TABLE users ADD COLUMN email text;\n",
            "alembic/versions/abc_add.py": "def upgrade() -> None:\n    op.drop_column('t', 'c')\n\n\n"
                                           "def downgrade() -> None:\n    pass\n",
            "app/migrations/0003_data.py": "operations = [migrations.RunPython(fill)]\n",
            "database/migrations/2024_x.php": "public function down(): void\n    {\n    }\n"})
        self.assertIn(("MG001", "db/migrations/001_users.up.sql"), found)
        self.assertNotIn(("MG001", "db/migrations/002_drop.up.sql"), found)
        self.assertIn(("MG006", "db/migrations/002_drop.up.sql"), found)
        self.assertIn(("MG002", "alembic/versions/abc_add.py"), found)
        self.assertIn(("MG006", "alembic/versions/abc_add.py"), found)
        self.assertIn(("MG004", "app/migrations/0003_data.py"), found)
        self.assertIn(("MG002", "database/migrations/2024_x.php"), found)

    def test_drops_inside_a_down_migration_are_not_flagged(self):
        found = self.rules({"db/migrate/20240101_add.rb": "class Add < ActiveRecord::Migration[7.1]\n"
                                                          "  def up\n    add_column :users, :age, :integer\n  end\n\n"
                                                          "  def down\n    remove_column :users, :age\n  end\nend\n"})
        self.assertNotIn(("MG006", "db/migrate/20240101_add.rb"), found)

    def test_reversible_run_python_is_not_flagged(self):
        found = self.rules({"app/migrations/0004.py":
                            "operations = [migrations.RunPython(fill, migrations.RunPython.noop)]\n"})
        self.assertNotIn(("MG004", "app/migrations/0004.py"), found)

    def test_checkers_and_tests_named_rollback_are_not_rollback_scripts(self):
        write_tree(self.root, {"scripts/rollback_check.py": "input()\n", "tests/rollback.test.ts": "sleep 5\n",
                               "test_rollback.py": "input()\n"})
        self.assertEqual(rc.scan(self.root)["scripts"], [])

    def test_fail_on_exits_one_and_writes_the_report(self):
        write_tree(self.root, {"rollback.sh": "kubectl rollout undo deploy/app\n"})
        out = self.root / "out"
        with redirect_stdout(io.StringIO()):
            code = rc.main(["--project", "t", "scan", "--root", str(self.root), "--fail-on", "major", "--out", str(out)])
            clean = rc.main(["--project", "t", "scan", "--root", str(self.root), "--out", str(out)])
        self.assertEqual((code, clean), (1, 0))
        self.assertTrue(list(out.glob("rollback-check-*.md")))


class RollbackDrillTests(unittest.TestCase):
    def test_drill_records_time_to_healthy_and_the_failing_verify(self):
        with tempfile.TemporaryDirectory() as tmp:
            log = Path(tmp) / "drills.jsonl"
            ok = rc.main(["--project", "t", "drill", "--name", "staging", "--out", str(log), "--",
                          sys.executable, "-c", "pass"])
            bad = rc.main(["--project", "t", "drill", "--name", "staging", "--out", str(log),
                           "--verify", '"%s" -c "raise SystemExit(3)"' % sys.executable, "--", sys.executable, "-c", "pass"])
            rows = rc.read_drills(log)
        self.assertEqual((ok, bad), (0, 3))
        self.assertEqual([r["verify_exit"] for r in rows], [None, 3])
        summary = rc.drill_summary(rows)
        self.assertEqual((summary["drills"], summary["passed"], summary["last_passed"]), (2, 1, False))


if __name__ == "__main__":
    unittest.main()
