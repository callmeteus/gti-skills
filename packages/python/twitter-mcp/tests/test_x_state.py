import sys
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from x_state import (  # noqa: E402
    LOGIN_REQUIRED, PAGE_ERROR, RATE_LIMITED, SELECTOR_CHANGED, TIMEOUT, ACCOUNT_NOT_FOUND,
    TwitterError, classify, rate_limit_reset,
)

SEARCH = ("SearchTimeline",)


class ClassifyTest(unittest.TestCase):
    def test_results_on_the_page_win_over_everything(self):
        dom = {"ready": True, "error": True}
        self.assertEqual(classify(dom, [{"op": "Viewer", "status": 429, "reset": "1"}], SEARCH, False), "ready")

    def test_viewer_429_with_blank_page_is_rate_limited(self):
        # Observed on 2026-10-29: X returns 429 on Viewer and renders an empty app shell.
        responses = [{"op": "Viewer", "status": 429, "reset": "1793289400"}, {"op": "timeline.json", "status": 200, "reset": None}]
        self.assertEqual(classify({"url": "https://x.com/search?q=CVE"}, responses, SEARCH, False), RATE_LIMITED)

    def test_login_redirect_is_login_required(self):
        self.assertEqual(classify({"url": "https://x.com/i/flow/login?redirect_after_login=%2Fsearch"}, [], SEARCH, False), LOGIN_REQUIRED)

    def test_401_is_login_required(self):
        self.assertEqual(classify({"url": "https://x.com/home"}, [{"op": "Viewer", "status": 401, "reset": None}], SEARCH, False), LOGIN_REQUIRED)

    def test_empty_state_is_an_empty_result_not_an_error(self):
        self.assertEqual(classify({"empty": True}, [], SEARCH, False), "empty")

    def test_missing_account_beats_empty_state(self):
        self.assertEqual(classify({"empty": True, "not_found": True}, [], SEARCH, False), ACCOUNT_NOT_FOUND)

    def test_something_went_wrong_is_a_page_error(self):
        self.assertEqual(classify({"error": True}, [], SEARCH, False), PAGE_ERROR)

    def test_keeps_waiting_while_nothing_is_decided(self):
        self.assertIsNone(classify({}, [], SEARCH, False))

    def test_data_arrived_but_no_elements_means_selectors_changed(self):
        self.assertEqual(classify({}, [{"op": "SearchTimeline", "status": 200, "reset": None}], SEARCH, True), SELECTOR_CHANGED)

    def test_nothing_at_all_is_a_timeout(self):
        self.assertEqual(classify({}, [], SEARCH, True), TIMEOUT)


class RateLimitMessageTest(unittest.TestCase):
    def test_reset_header_is_used(self):
        self.assertEqual(rate_limit_reset([{"op": "Viewer", "status": 429, "reset": "1793289400"}]), 1793289400.0)

    def test_missing_header_assumes_a_15_minute_window(self):
        reset = rate_limit_reset([{"op": "Viewer", "status": 429, "reset": None}])
        self.assertAlmostEqual(reset, time.time() + 900, delta=5)

    def test_message_names_the_kind_and_the_reset(self):
        text = TwitterError(RATE_LIMITED, "X rate limited this account.", reset_at=time.time() + 120).message()
        self.assertTrue(text.startswith("Error [RATE_LIMITED]: "))
        self.assertIn("Limit resets at", text)
        self.assertIn("fall back to web search", text)


if __name__ == "__main__":
    unittest.main()
