"""Classify what an X page is showing, so tools fail with a typed error instead of a blind timeout.

This module has no Playwright import: it works on plain dicts, so it can be unit tested offline.
"""

import time
from datetime import datetime

# Error kinds returned to the agent. Keep these names stable: the x-research skill refers to them.
RATE_LIMITED = "RATE_LIMITED"          # X answered HTTP 429; wait for the reset time
LOGIN_REQUIRED = "LOGIN_REQUIRED"      # session expired or logged out; run login.py
ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND"  # profile does not exist or is suspended
PAGE_ERROR = "PAGE_ERROR"              # X showed "Something went wrong"; usually transient
SELECTOR_CHANGED = "SELECTOR_CHANGED"  # data arrived but the expected elements are missing
TIMEOUT = "TIMEOUT"                    # nothing usable rendered in time
PROFILE_IN_USE = "PROFILE_IN_USE"      # another browser already holds the profile folder
BROWSER_ERROR = "BROWSER_ERROR"        # the browser crashed or could not start

# Errors worth one more attempt inside the same tool call.
RETRYABLE = {PAGE_ERROR, TIMEOUT}

# GraphQL operations whose 429 means the account itself is throttled.
# Viewer runs on every full page load, so it is usually the first to hit the limit.
DEFAULT_RATE_WINDOW = 15 * 60


class TwitterError(Exception):
    def __init__(self, kind: str, detail: str, reset_at: float | None = None):
        self.kind = kind
        self.detail = detail
        self.reset_at = reset_at
        super().__init__(self.message())

    def message(self) -> str:
        text = f"Error [{self.kind}]: {self.detail}"
        if self.reset_at:
            wait = max(0, int(self.reset_at - time.time()))
            clock = datetime.fromtimestamp(self.reset_at).strftime("%H:%M:%S")
            text += f" Limit resets at {clock} local time (in {wait // 60} min {wait % 60} s)."
        return text + " " + HINTS.get(self.kind, "")


HINTS = {
    RATE_LIMITED: "Do not retry or simplify the query before the reset; tell the user and fall back to web search.",
    LOGIN_REQUIRED: "Ask the user to run login.py in the twitter-mcp folder, then retry.",
    ACCOUNT_NOT_FOUND: "Check the username spelling.",
    PAGE_ERROR: "X failed to load the page after retries. Wait a minute before the next call.",
    SELECTOR_CHANGED: "X likely changed its page layout; the MCP selectors need an update.",
    TIMEOUT: "X did not render results in time. Wait a minute before the next call.",
    PROFILE_IN_USE: "Close the other browser or MCP server process that uses ~/.twitter-mcp/chrome-profile, then retry.",
    BROWSER_ERROR: "The MCP will relaunch the browser on the next call.",
}


def rate_limit_reset(responses: list[dict]) -> float | None:
    """Return the reset epoch of the first HTTP 429 response, or None when there was no 429.

    Each response is {"op": str, "status": int, "reset": str | None}.
    """
    for r in responses:
        if r.get("status") == 429:
            try:
                return float(r.get("reset"))
            except (TypeError, ValueError):
                return time.time() + DEFAULT_RATE_WINDOW
    return None


def classify(dom: dict, responses: list[dict], data_ops: tuple[str, ...], final: bool) -> str | None:
    """Decide what the page shows.

    dom: counts and flags read from the page: ready, empty, login, error, not_found, url.
    responses: X API responses seen since navigation started.
    data_ops: GraphQL operation names that carry this page's data, such as ("SearchTimeline",).
    final: True when the wait time is over; then a decision is always returned.

    Returns "ready", "empty", an error kind, or None to keep waiting.
    """
    if dom.get("ready"):
        return "ready"
    url = dom.get("url") or ""
    if "/login" in url or "/i/flow/" in url or dom.get("login"):
        return LOGIN_REQUIRED
    if rate_limit_reset(responses) is not None:
        return RATE_LIMITED
    if any(r.get("status") == 401 for r in responses):
        return LOGIN_REQUIRED
    if dom.get("not_found"):
        return ACCOUNT_NOT_FOUND
    if dom.get("empty"):
        return "empty"
    if dom.get("error"):
        return PAGE_ERROR
    if not final:
        return None
    if any(r.get("op") in data_ops and r.get("status") == 200 for r in responses):
        return SELECTOR_CHANGED
    return TIMEOUT
