"""Logged-in read tools: home feed, notifications, bookmarks. Output is JSON."""

import json

from browser_session import session
from tools_read import _collect_tweets, open_page


async def read_feed(max_results: int = 20) -> str:
    """Read tweets from the Twitter home feed."""
    page = await open_page("https://x.com/home", '[data-testid="tweet"]', ("HomeTimeline", "HomeLatestTimeline"))
    if page is None:
        return json.dumps([])
    tweets = await _collect_tweets(page, max_results, max_scrolls=10)
    return json.dumps(
        [{"author": t["name"], "text": t["text"], "timestamp": t["time"]} for t in tweets], ensure_ascii=False
    )


async def read_notifications() -> str:
    """Read notifications from Twitter."""
    page = await open_page(
        "https://x.com/notifications", '[data-testid="cellInnerDiv"] time, [data-testid="notification"]', ("NotificationsTimeline",)
    )
    if page is None:
        return json.dumps([])
    items = await page.evaluate(
        """() => [...document.querySelectorAll('[data-testid="cellInnerDiv"]')].slice(0, 20).map(el => ({
            text: el.innerText, timestamp: (el.querySelector('time') || {getAttribute: () => ''}).getAttribute('datetime') || ''
        }))"""
    )
    notifications = []
    for item in items:
        lines = [l.strip() for l in item["text"].split("\n") if l.strip()]
        text = " ".join(lines[:5])
        if len(text) >= 5:
            notifications.append({"text": text[:300], "timestamp": item["timestamp"]})
    return json.dumps(notifications, ensure_ascii=False)


async def read_bookmarks(max_results: int = 20) -> str:
    """Read bookmarked tweets from Twitter."""
    page = await open_page("https://x.com/i/bookmarks", '[data-testid="tweet"]', ("Bookmarks",))
    if page is None:
        return json.dumps([])
    tweets = await _collect_tweets(page, max_results, max_scrolls=10)
    return json.dumps(
        [
            {
                "author": t["name"],
                "text": t["text"],
                "timestamp": t["time"],
                "link": f"https://x.com{t['href']}" if t["href"].startswith("/") else t["href"],
            }
            for t in tweets
        ],
        ensure_ascii=False,
    )


def sync_read_feed(max_results: int = 20) -> str:
    return session.run(lambda: read_feed(max_results))


def sync_read_notifications() -> str:
    return session.run(read_notifications)


def sync_read_bookmarks(max_results: int = 20) -> str:
    return session.run(lambda: read_bookmarks(max_results))
