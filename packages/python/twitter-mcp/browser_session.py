"""Shared browser session for every tool.

One Chromium process with a persistent profile is launched on the first tool call and reused by
every later call. All browser work runs on a single background event loop, one call at a time, on
a single tab. This matters because:

- Each full page load of x.com re-fetches the Viewer API, which X rate limits per account.
  Launching a new browser per call (and restoring old tabs) burned that limit in a few calls.
- Two Chromium processes cannot share one profile folder. A second launch hands off to the first
  process and exits, which surfaced as "Target page, context or browser has been closed".

Configuration (environment variables):
- TWITTER_MCP_PROFILE: browser profile folder (default ~/.twitter-mcp/chrome-profile).
- TWITTER_MCP_HEADLESS: "1" (default) runs headless; "0" shows the browser window.
- TWITTER_MCP_MIN_INTERVAL: minimum seconds between page navigations (default 4).
- TWITTER_MCP_CALL_TIMEOUT: maximum seconds for one tool call (default 120).
"""

import asyncio
import atexit
import json
import os
import random
import sys
import threading
import time
from pathlib import Path

from playwright.async_api import BrowserContext, Page, async_playwright

from x_state import BROWSER_ERROR, PROFILE_IN_USE, RATE_LIMITED, TIMEOUT, TwitterError

PROFILE_DIR = os.environ.get("TWITTER_MCP_PROFILE") or str(Path.home() / ".twitter-mcp" / "chrome-profile")
STORAGE_BACKUP = str(Path.home() / ".twitter-mcp" / "storage_state.json")

HEADLESS = os.environ.get("TWITTER_MCP_HEADLESS", "1") != "0"
MIN_INTERVAL = float(os.environ.get("TWITTER_MCP_MIN_INTERVAL", "4"))
CALL_TIMEOUT = float(os.environ.get("TWITTER_MCP_CALL_TIMEOUT", "120"))

# No --restore-last-session: it reopened every old tab on each launch. Cookies with an expiry
# date (auth_token, ct0) persist in the profile without it.
BROWSER_ARGS = ["--disable-blink-features=AutomationControlled"]
IGNORE_ARGS = ["--enable-automation"]

# Headless Chromium reports "HeadlessChrome" in its user agent, which X treats as a bot.
if sys.platform == "win32":
    _UA_PLATFORM = "Windows NT 10.0; Win64; x64"
elif sys.platform == "darwin":
    _UA_PLATFORM = "Macintosh; Intel Mac OS X 10_15_7"
else:
    _UA_PLATFORM = "X11; Linux x86_64"
USER_AGENT = f"Mozilla/5.0 ({_UA_PLATFORM}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"


async def get_persistent_context(headless: bool = HEADLESS) -> tuple:
    """Launch a browser on the persistent profile. Returns (playwright, context).

    Used by the shared session and by standalone scripts such as twitter_keepalive.py.
    Raises TwitterError(PROFILE_IN_USE) when another browser already holds the profile.
    """
    os.makedirs(PROFILE_DIR, exist_ok=True)
    fresh_profile = not (Path(PROFILE_DIR) / "Default").exists()
    pw = await async_playwright().start()
    try:
        context = await pw.chromium.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            headless=headless,
            args=BROWSER_ARGS,
            ignore_default_args=IGNORE_ARGS,
            viewport={"width": 1280, "height": 900},
            user_agent=USER_AGENT,
        )
    except Exception as e:
        await pw.stop()
        text = str(e)
        if "existing browser session" in text or "has been closed" in text or "ProcessSingleton" in text:
            raise TwitterError(
                PROFILE_IN_USE,
                f"Another Chromium process already uses the profile folder {PROFILE_DIR}.",
            ) from e
        raise TwitterError(BROWSER_ERROR, f"Could not launch Chromium: {text.splitlines()[0]}") from e

    # Seed a fresh profile from the storage_state.json backup.
    if fresh_profile and Path(STORAGE_BACKUP).exists():
        try:
            with open(STORAGE_BACKUP) as f:
                state = json.load(f)
            if "cookies" in state:
                await context.add_cookies(state["cookies"])
        except Exception:
            pass  # Non-critical
    return pw, context


async def save_session(context: BrowserContext):
    """Save current session back to storage_state.json as backup."""
    try:
        os.makedirs(os.path.dirname(STORAGE_BACKUP), exist_ok=True)
        await context.storage_state(path=STORAGE_BACKUP)
    except Exception:
        pass  # Non-critical: the profile folder is the primary store


async def close_session(pw, context: BrowserContext):
    """Save session and close a browser opened with get_persistent_context."""
    await save_session(context)
    await context.close()
    await pw.stop()


class SharedSession:
    """Owns the browser and runs every tool coroutine on one background loop, one at a time."""

    def __init__(self):
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._loop.run_forever, name="twitter-mcp-browser", daemon=True)
        self._thread.start()
        self._lock: asyncio.Lock | None = None
        self._pw = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None
        self._last_nav = 0.0
        self.blocked_until = 0.0
        self.blocked_detail = ""

    def run(self, make_coro, timeout: float = CALL_TIMEOUT):
        """Run make_coro() on the browser loop and wait for its result.

        make_coro is a zero-argument function that returns a coroutine, so the coroutine is
        created on the browser thread. Calls from several threads queue up and run one at a time.
        """
        future = asyncio.run_coroutine_threadsafe(self._serialized(make_coro), self._loop)
        try:
            return future.result(timeout=timeout)
        except TimeoutError:
            future.cancel()
            raise TwitterError(TIMEOUT, f"The tool call took longer than {int(timeout)} s and was cancelled.")

    async def _serialized(self, make_coro):
        if self._lock is None:
            self._lock = asyncio.Lock()
        async with self._lock:
            self.check_rate_limit()
            try:
                return await make_coro()
            except TwitterError:
                raise
            except Exception as e:
                if "has been closed" in str(e) or "Target closed" in str(e):
                    await self._reset()
                    raise TwitterError(BROWSER_ERROR, "The browser closed during the call.") from e
                raise

    def check_rate_limit(self):
        if time.time() < self.blocked_until:
            raise TwitterError(
                RATE_LIMITED,
                f"X rate limited this account ({self.blocked_detail}). Skipped the request to avoid extending the block.",
                reset_at=self.blocked_until,
            )

    def mark_rate_limited(self, reset_at: float, detail: str):
        self.blocked_until = max(self.blocked_until, reset_at)
        self.blocked_detail = detail

    async def context(self) -> BrowserContext:
        if self._context is not None and self._page is not None and not self._page.is_closed():
            return self._context
        await self._reset()
        self._pw, self._context = await get_persistent_context()
        pages = self._context.pages
        self._page = pages[0] if pages else await self._context.new_page()
        return self._context

    async def page(self) -> Page:
        """The single shared tab. Any other tab that appeared is closed."""
        context = await self.context()
        for extra in context.pages:
            if extra is not self._page:
                await extra.close()
        return self._page

    async def pace(self):
        """Keep at least MIN_INTERVAL seconds, plus jitter, between navigations."""
        wait = self._last_nav + MIN_INTERVAL + random.uniform(0, 1.5) - time.time()
        if wait > 0:
            await asyncio.sleep(wait)
        self._last_nav = time.time()

    async def save(self):
        if self._context is not None:
            await save_session(self._context)

    async def _reset(self):
        context, pw = self._context, self._pw
        self._context = self._page = self._pw = None
        try:
            if context is not None:
                await context.close()
        except Exception:
            pass
        try:
            if pw is not None:
                await pw.stop()
        except Exception:
            pass

    def shutdown(self):
        if self._context is None:
            return
        try:
            asyncio.run_coroutine_threadsafe(self._shutdown(), self._loop).result(timeout=15)
        except Exception:
            pass

    async def _shutdown(self):
        await self.save()
        await self._reset()


session = SharedSession()
atexit.register(session.shutdown)


async def import_fresh_cookies(cookies_path: str):
    """Import cookies from a storage_state-style JSON file into the persistent profile."""
    pw, context = await get_persistent_context()
    try:
        with open(cookies_path) as f:
            state = json.load(f)
        if "cookies" in state:
            await context.add_cookies(state["cookies"])
        page = context.pages[0] if context.pages else await context.new_page()
        await page.goto("https://x.com/home", wait_until="domcontentloaded")
        await page.wait_for_timeout(5000)
        await save_session(context)
        return "Cookies imported and activated successfully"
    finally:
        await close_session(pw, context)
