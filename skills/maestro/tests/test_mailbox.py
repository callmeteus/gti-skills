"""Tests for scripts/team/mailbox.py, run through its real command line."""

import json
import subprocess
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "team" / "mailbox.py"


class MailboxTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.team = Path(self.temp.name) / "team"

    def tearDown(self):
        self.temp.cleanup()

    def run_cmd(self, *args):
        done = subprocess.run(
            [sys.executable, str(SCRIPT), "--team", str(self.team), *args],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        return done.returncode, json.loads(done.stdout)

    def open_team(self, budget=40):
        code, _ = self.run_cmd("open", "--members", "w1,w2,w3", "--goal", "find the bug", "--budget", str(budget))
        self.assertEqual(code, 0)

    def test_direct_message_reaches_only_the_recipient_once(self):
        self.open_team()
        code, _ = self.run_cmd("send", "--from", "w1", "--to", "w2", "--kind", "question", "--text", "Does retry run before capture?")
        self.assertEqual(code, 0)

        _, first = self.run_cmd("read", "--as", "w2")
        self.assertEqual([item["text"] for item in first["messages"]], ["Does retry run before capture?"])
        _, again = self.run_cmd("read", "--as", "w2")
        self.assertEqual(again["messages"], [])
        _, other = self.run_cmd("read", "--as", "w3")
        self.assertEqual(other["messages"], [])

    def test_board_post_reaches_every_other_member_but_not_the_author(self):
        self.open_team()
        self.run_cmd("post", "--from", "w1", "--kind", "ruled-out", "--text", "Not the queue", "--evidence", "replay.log")

        _, author = self.run_cmd("read", "--as", "w1")
        _, peer = self.run_cmd("read", "--as", "w3")
        self.assertEqual(author["board"], [])
        self.assertEqual(peer["board"][0]["kind"], "ruled-out")
        self.assertEqual(peer["board"][0]["evidence"], "replay.log")

    def test_second_claim_on_a_held_task_is_refused_until_release(self):
        self.open_team()
        self.assertEqual(self.run_cmd("claim", "--as", "w1", "--task", "fix-retry")[0], 0)

        code, refused = self.run_cmd("claim", "--as", "w2", "--task", "fix-retry")
        self.assertEqual(code, 3)
        self.assertIn("w1", refused["error"])

        self.assertEqual(self.run_cmd("release", "--as", "w2", "--task", "fix-retry")[0], 3)
        self.assertEqual(self.run_cmd("release", "--as", "w1", "--task", "fix-retry", "--done")[0], 0)
        self.assertEqual(self.run_cmd("claim", "--as", "w2", "--task", "fix-retry")[0], 0)

    def test_parallel_claims_give_the_task_to_exactly_one_member(self):
        self.open_team()
        with ThreadPoolExecutor(max_workers=3) as pool:
            codes = list(pool.map(lambda name: self.run_cmd("claim", "--as", name, "--task", "t1")[0], ["w1", "w2", "w3"]))
        self.assertEqual(sorted(codes), [0, 3, 3])

    def test_parallel_sends_keep_every_line_whole(self):
        self.open_team(budget=100)
        texts = [f"finding {index}" for index in range(12)]
        with ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(lambda text: self.run_cmd("send", "--from", "w1", "--to", "w2", "--text", text), texts))
        _, inbox = self.run_cmd("read", "--as", "w2")
        self.assertEqual(sorted(item["text"] for item in inbox["messages"]), sorted(texts))

    def test_budget_stops_a_chatty_worker_but_not_maestro(self):
        self.open_team(budget=2)
        self.run_cmd("send", "--from", "w1", "--to", "w2", "--text", "one")
        self.run_cmd("post", "--from", "w1", "--text", "two")
        code, refused = self.run_cmd("send", "--from", "w1", "--to", "w2", "--text", "three")
        self.assertEqual(code, 4)
        self.assertIn("2 messages", refused["error"])
        for index in range(3):
            self.assertEqual(self.run_cmd("send", "--from", "maestro", "--to", "w1", "--text", f"note {index}")[0], 0)

    def test_closed_team_refuses_sends_and_claims_but_still_reads(self):
        self.open_team()
        self.run_cmd("send", "--from", "w1", "--to", "w2", "--text", "last word")
        self.run_cmd("close")

        self.assertEqual(self.run_cmd("send", "--from", "w2", "--to", "w1", "--text", "hello")[0], 5)
        self.assertEqual(self.run_cmd("claim", "--as", "w2", "--task", "t1")[0], 5)
        _, inbox = self.run_cmd("read", "--as", "w2")
        self.assertEqual(inbox["status"], "closed")
        self.assertEqual(inbox["messages"][0]["text"], "last word")

    def test_outsiders_long_text_and_path_names_are_rejected(self):
        self.open_team()
        self.assertEqual(self.run_cmd("send", "--from", "intruder", "--to", "w1", "--text", "hi")[0], 2)
        self.assertEqual(self.run_cmd("send", "--from", "w1", "--to", "w2", "--text", "x" * 2001)[0], 2)
        self.assertEqual(self.run_cmd("claim", "--as", "w1", "--task", "../escape")[0], 2)
        self.assertFalse((self.team.parent / "escape.lock").exists())

    def test_status_counts_unread_and_lists_locks(self):
        self.open_team()
        self.run_cmd("send", "--from", "w1", "--to", "maestro", "--kind", "blocker", "--text", "need the staging schema")
        self.run_cmd("claim", "--as", "w3", "--task", "t9")

        _, status = self.run_cmd("status")
        self.assertEqual(status["members"]["maestro"]["unread"], 1)
        self.assertEqual(status["members"]["w1"]["sent"], 1)
        self.assertEqual([lock["owner"] for lock in status["locks"]], ["w3"])

    def test_missing_team_is_reported(self):
        code, result = self.run_cmd("read", "--as", "w1")
        self.assertEqual(code, 5)
        self.assertFalse(result["ok"])


if __name__ == "__main__":
    unittest.main()
