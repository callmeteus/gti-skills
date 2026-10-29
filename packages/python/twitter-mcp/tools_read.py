"""Read-only tools: search, profile, user tweets, trending.

Every tool runs on the shared browser session (one tab, one call at a time) and either returns
results or raises TwitterError with a typed kind (see x_state.py).
"""

import asyncio
import re
import time
import urllib.parse

import httpx
from playwright.async_api import Page
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from browser_session import session
from x_state import (
    PAGE_ERROR,
    RATE_LIMITED,
    RETRYABLE,
    TIMEOUT,
    TwitterError,
    classify,
    rate_limit_reset,
)

WAIT_SECONDS = 20          # how long to wait for a page to show results or a known state
RETRY_BACKOFF = (5, 15)    # seconds to wait before attempts 2 and 3 on transient failures
FX_CONCURRENCY = 5

# Elements that can carry over from the previous page during in-app navigation.
_STALE_SELECTORS = '[data-testid="tweet"], [data-testid="emptyState"], [data-testid="trend"], [data-testid="UserName"]'

_DOM_STATE_JS = """(ready) => {
  const fresh = s => [...document.querySelectorAll(s)].filter(e => !e.hasAttribute('data-xmcp-stale')).length;
  const col = document.querySelector('[data-testid="primaryColumn"]');
  const text = col ? col.innerText : '';
  return {
    url: location.href,
    ready: fresh(ready) > 0,
    empty: fresh('[data-testid="emptyState"]') > 0,
    login: !!document.querySelector('input[autocomplete="username"], [data-testid="loginButton"]') && !col,
    error: /Something went wrong|Try reloading|Rate limit exceeded/i.test(text),
    not_found: /This account doesn.t exist|Account suspended|Hmm\\.\\.\\.this page doesn.t exist/i.test(text),
  };
}"""

_EXTRACT_TWEETS_JS = """() => [...document.querySelectorAll('[data-testid="tweet"]:not([data-xmcp-stale])')].map(el => {
  const q = s => el.querySelector(s);
  const label = s => (q(s) && q(s).getAttribute('aria-label')) || '';
  const userName = q('[data-testid="User-Name"]');
  let handle = '';
  if (userName) {
    for (const sp of userName.querySelectorAll('span')) {
      const t = sp.innerText.trim();
      if (t.startsWith('@')) { handle = t; break; }
    }
  }
  const time = q('time');
  const link = (time && time.closest('a')) || q('a[href*="/status/"]');
  const href = (link && link.getAttribute('href')) || '';
  return {
    name: userName ? ((userName.querySelector('span') || {}).innerText || '') : '',
    handle,
    text: (q('[data-testid="tweetText"]') || {}).innerText || '',
    time: time ? time.getAttribute('datetime') : '',
    reply: label('[data-testid="reply"]'),
    retweet: label('[data-testid="retweet"], [data-testid="unretweet"]'),
    like: label('[data-testid="like"], [data-testid="unlike"]'),
    href,
  };
})"""


# ---------------------------------------------------------------------------
# Navigation with state detection
# ---------------------------------------------------------------------------

async def _app_loaded(page: Page) -> bool:
    if not page.url.startswith("https://x.com/"):
        return False
    try:
        return await page.evaluate("() => !!document.querySelector('[data-testid=\"primaryColumn\"]')")
    except Exception:
        return False


async def _go(page: Page, url: str, full_reload: bool):
    """Navigate to url. Inside a loaded x.com app, use in-app navigation: a full page load
    re-fetches the rate-limited Viewer API, an in-app route change does not."""
    if not full_reload and await _app_loaded(page):
        await page.evaluate(
            """([url, stale]) => {
                document.querySelectorAll(stale).forEach(e => e.setAttribute('data-xmcp-stale', ''));
                history.pushState({}, '', url);
                window.dispatchEvent(new PopStateEvent('popstate', {state: {}}));
            }""",
            [url, _STALE_SELECTORS],
        )
        return
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    except PlaywrightTimeoutError:
        pass  # the state wait below decides what happened


async def _wait_state(page: Page, ready: str, responses: list, data_ops: tuple) -> str:
    deadline = time.time() + WAIT_SECONDS
    while True:
        final = time.time() >= deadline
        try:
            dom = await page.evaluate(_DOM_STATE_JS, ready)
        except Exception:
            dom = {}  # page is mid-navigation
        state = classify(dom, responses, data_ops, final)
        if state is not None:
            return state
        await asyncio.sleep(0.4)


async def open_page(url: str, ready: str, data_ops: tuple) -> Page:
    """Open url on the shared tab and wait until it shows results.

    Returns the page when results are ready, None when X shows an empty result, and raises
    TwitterError for every other state. Retries transient failures with backoff.
    """
    page = await session.page()
    responses: list[dict] = []

    def on_response(r):
        if "/i/api/" in r.url:
            op = r.url.split("?")[0].rstrip("/").split("/")[-1]
            responses.append({"op": op, "status": r.status, "reset": r.headers.get("x-rate-limit-reset")})

    page.on("response", on_response)
    try:
        attempts = len(RETRY_BACKOFF) + 1
        for attempt in range(attempts):
            await session.pace()
            responses.clear()
            await _go(page, url, full_reload=attempt > 0)
            state = await _wait_state(page, ready, responses, data_ops)
            if state == "ready":
                return page
            if state == "empty":
                return None
            if state == RATE_LIMITED:
                ops = sorted({r["op"] for r in responses if r["status"] == 429})
                detail = "HTTP 429 on " + ", ".join(ops)
                reset_at = rate_limit_reset(responses)
                session.mark_rate_limited(reset_at, detail)
                raise TwitterError(RATE_LIMITED, f"X rate limited this account ({detail}).", reset_at=reset_at)
            if state in RETRYABLE and attempt < attempts - 1:
                await asyncio.sleep(RETRY_BACKOFF[attempt])
                continue
            raise TwitterError(state, _describe(state, url, attempt + 1))
    finally:
        page.remove_listener("response", on_response)
        await session.save()


def _describe(state: str, url: str, attempts: int) -> str:
    if state == PAGE_ERROR:
        return f"X showed 'Something went wrong' for {url} ({attempts} attempts)."
    if state == TIMEOUT:
        return f"No results rendered for {url} within {WAIT_SECONDS} s ({attempts} attempts)."
    return f"Failed to load {url}."


# ---------------------------------------------------------------------------
# Tweet extraction
# ---------------------------------------------------------------------------

async def _fetch_fx_stats(client: httpx.AsyncClient, sem: asyncio.Semaphore, username: str, tweet_id: str) -> dict:
    """Fetch engagement stats (views, likes, retweets, replies) from FxTwitter."""
    if not username or not tweet_id:
        return {}
    async with sem:
        try:
            resp = await client.get(f"https://api.fxtwitter.com/{username.lstrip('@')}/status/{tweet_id}")
            if resp.status_code == 200:
                tweet = resp.json().get("tweet", {}) or {}
                return {k: tweet.get(k) for k in ("views", "likes", "retweets", "replies")}
        except Exception:
            pass
    return {}


def _parse_count(label: str) -> str:
    """Extract leading number from an aria-label like '12 Replies. Reply'."""
    if not label:
        return "0"
    m = re.match(r"\s*([\d.,]+[KMB]?)", label)
    return m.group(1) if m else "0"


async def _collect_tweets(page: Page, max_results: int, max_scrolls: int) -> list[dict]:
    """Read tweets from the page, scrolling until max_results unique tweets or max_scrolls."""
    tweets: dict[str, dict] = {}
    for scroll in range(max_scrolls + 1):
        for t in await page.evaluate(_EXTRACT_TWEETS_JS):
            key = t["href"] or (t["handle"] + t["time"] + t["text"][:40])
            tweets.setdefault(key, t)
        if len(tweets) >= max_results or scroll == max_scrolls:
            break
        await page.evaluate("window.scrollBy(0, document.body.scrollHeight)")
        await page.wait_for_timeout(1500)
    return list(tweets.values())[:max_results]


async def _with_stats(tweets: list[dict], default_handle: str = "") -> list[dict]:
    sem = asyncio.Semaphore(FX_CONCURRENCY)
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    async with httpx.AsyncClient(timeout=6.0, headers=headers) as client:
        jobs = []
        for t in tweets:
            m = re.search(r"/status/(\d+)", t["href"] or "")
            t["id"] = m.group(1) if m else ""
            handle = (t["handle"] or default_handle).lstrip("@")
            jobs.append(_fetch_fx_stats(client, sem, handle, t["id"]))
        stats = await asyncio.gather(*jobs)
    for t, s in zip(tweets, stats):
        t["replies"] = s.get("replies") if s.get("replies") is not None else _parse_count(t["reply"])
        t["retweets"] = s.get("retweets") if s.get("retweets") is not None else _parse_count(t["retweet"])
        t["likes"] = s.get("likes") if s.get("likes") is not None else _parse_count(t["like"])
        t["views"] = s.get("views") if s.get("views") is not None else "n/a"
        t["url"] = f"https://x.com{t['href']}" if t["href"].startswith("/") else t["href"]
    return tweets


def _format_tweet(i: int, t: dict, with_handle: bool = True) -> str:
    lines = [f"{i}. Author: {t['name'] or 'Unknown'}"]
    if with_handle:
        lines.append(f"   Handle: {t['handle'] or 'Unknown'}")
    lines += [
        f"   Text: {t['text']}",
        f"   Timestamp: {t['time'] or 'Unknown'}",
        f"   Views: {t['views']} | Likes: {t['likes']} | Retweets: {t['retweets']} | Replies (comments): {t['replies']}",
    ]
    if t.get("url"):
        lines.append(f"   URL: {t['url']}")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

async def _search_tweets_async(query: str, max_results: int = 10) -> str:
    url = f"https://x.com/search?q={urllib.parse.quote(query)}&f=live"
    page = await open_page(url, '[data-testid="tweet"]', ("SearchTimeline",))
    if page is None:
        return f"No tweets found for query: {query}"
    tweets = await _with_stats(await _collect_tweets(page, max_results, max_scrolls=2))
    if not tweets:
        return f"No tweets found for query: {query}"
    return "\n".join(_format_tweet(i, t) for i, t in enumerate(tweets, 1))


async def _get_user_profile_async(username: str) -> str:
    username = username.lstrip("@")
    page = await open_page(f"https://x.com/{username}", '[data-testid="UserName"]', ("UserByScreenName",))
    if page is None:
        return f"No profile found for user: {username}"
    data = await page.evaluate(
        """() => {
            const txt = s => { const e = document.querySelector(s); return e ? e.innerText : ''; };
            const nameEl = document.querySelector('[data-testid="UserName"] span');
            return {
                name: nameEl ? nameEl.innerText : '',
                bio: txt('[data-testid="UserDescription"]'),
                followers: txt('a[href$="/verified_followers"] span span') || txt('a[href$="/followers"] span span'),
                following: txt('a[href$="/following"] span span'),
            };
        }"""
    )
    return (
        f"Name: {data['name'] or username}\nUsername: @{username}\nBio: {data['bio'] or 'No bio'}\n"
        f"Followers: {data['followers'] or '?'}\nFollowing: {data['following'] or '?'}"
    )


async def _get_user_tweets_async(username: str, max_results: int = 10) -> str:
    username = username.lstrip("@")
    page = await open_page(f"https://x.com/{username}", '[data-testid="tweet"]', ("UserTweets", "UserByScreenName"))
    if page is None:
        return f"No tweets found for user: {username}"
    tweets = await _with_stats(await _collect_tweets(page, max_results, max_scrolls=5), default_handle=username)
    if not tweets:
        return f"No tweets found for user: {username}"
    return f"Tweets from {username}:\n\n" + "\n".join(
        _format_tweet(i, t, with_handle=False) for i, t in enumerate(tweets, 1)
    )


async def _get_trending_async() -> str:
    page = await open_page(
        "https://x.com/explore/tabs/trending", '[data-testid="trend"]', ("ExplorePage", "GenericTimelineById")
    )
    if page is None:
        return "No trending topics shown."
    texts = await page.evaluate(
        "() => [...document.querySelectorAll('[data-testid=\"trend\"]:not([data-xmcp-stale])')].map(e => e.innerText)"
    )
    trends = []
    for full_text in texts:
        lines = [l.strip() for l in full_text.split("\n") if l.strip() and l.strip() != "·"]
        lines = [l for l in lines if len(l) > 1 and l not in ("Trending", "Show more")]
        # Trend cells read "1 · Trending in X" / "Topic" / "12K posts"; skip the rank and context lines.
        content = [l for l in lines if not re.match(r"^\d+$", l) and "Trending" not in l]
        if not content:
            continue
        entry = f"{len(trends) + 1}. {content[0]}"
        if len(content) > 1 and re.search(r"post", content[1], re.I):
            entry += f" ({content[1]})"
        trends.append(entry)
        if len(trends) >= 15:
            break
    if not trends:
        return "No trending topics shown."
    return "Trending Topics:\n" + "\n".join(trends)


# Synchronous entry points used by server.py. Each blocks until the shared session runs the call.

def search_tweets(query: str, max_results: int = 10) -> str:
    return session.run(lambda: _search_tweets_async(query, max_results))


def get_user_profile(username: str) -> str:
    return session.run(lambda: _get_user_profile_async(username))


def get_user_tweets(username: str, max_results: int = 10) -> str:
    return session.run(lambda: _get_user_tweets_async(username, max_results))


def get_trending() -> str:
    return session.run(_get_trending_async)


if __name__ == "__main__":
    import sys

    for q in sys.argv[1:] or ["python programming"]:
        try:
            print(search_tweets(q, 5))
        except TwitterError as e:
            print(e)
