"""Twitter/X MCP Server: tools for reading and posting on Twitter/X, no API key needed.

All tools share one headless browser and run one at a time. Failures return a line that starts
with "Error [KIND]:", where KIND is one of the names in x_state.py, for example RATE_LIMITED.
"""

import asyncio
import time
from datetime import datetime

from mcp.server.fastmcp import FastMCP

from browser_session import HEADLESS, MIN_INTERVAL, session
from x_state import BROWSER_ERROR, TwitterError


async def _call(fn, *args) -> str:
    """Run a blocking tool function off the server loop and turn failures into typed errors."""
    try:
        return await asyncio.to_thread(fn, *args)
    except TwitterError as e:
        return e.message()
    except Exception as e:
        return TwitterError(BROWSER_ERROR, str(e).splitlines()[0] if str(e) else type(e).__name__).message()


def create_server():
    mcp = FastMCP("twitter-mcp")

    @mcp.tool()
    async def twitter_status() -> str:
        """Report the MCP state without contacting X: rate-limit block and settings.
        Call this after an error, before retrying."""
        lines = [f"Headless: {HEADLESS}", f"Minimum seconds between page loads: {MIN_INTERVAL}"]
        if time.time() < session.blocked_until:
            clock = datetime.fromtimestamp(session.blocked_until).strftime("%H:%M:%S")
            lines.insert(0, f"RATE_LIMITED until {clock} local time ({session.blocked_detail}). Calls fail fast until then.")
        else:
            lines.insert(0, "Not rate limited.")
        return "\n".join(lines)

    @mcp.tool()
    async def twitter_search(query: str, max_results: int = 10) -> str:
        """Search Twitter/X for tweets by keyword (latest tab). Run searches one at a time.
        Args:
            query: Search query, X search operators allowed
            max_results: Max tweets to return (default 10)
        """
        from tools_read import search_tweets
        return await _call(search_tweets, query, max_results)

    @mcp.tool()
    async def twitter_user(username: str) -> str:
        """Get a Twitter/X user's profile (bio, followers, following).
        Args:
            username: Twitter username (without @)
        """
        from tools_read import get_user_profile
        return await _call(get_user_profile, username)

    @mcp.tool()
    async def twitter_user_tweets(username: str, max_results: int = 10) -> str:
        """Get recent tweets from a Twitter/X user.
        Args:
            username: Twitter username (without @)
            max_results: Max tweets (default 10)
        """
        from tools_read import get_user_tweets
        return await _call(get_user_tweets, username, max_results)

    @mcp.tool()
    async def twitter_trending() -> str:
        """Get trending topics on Twitter/X."""
        from tools_read import get_trending
        return await _call(get_trending)

    @mcp.tool()
    async def twitter_post(text: str) -> str:
        """Post a tweet. Requires a logged-in browser profile (run login.py once).
        Args:
            text: Tweet text (max 280 chars)
        """
        from tools_write import sync_post_tweet
        return await _call(sync_post_tweet, text)

    @mcp.tool()
    async def twitter_reply(tweet_url: str, text: str) -> str:
        """Reply to a tweet. Requires a logged-in browser profile.
        Args:
            tweet_url: URL of the tweet to reply to
            text: Reply text
        """
        from tools_write import sync_reply_to_tweet
        return await _call(sync_reply_to_tweet, tweet_url, text)

    @mcp.tool()
    async def twitter_like(tweet_url: str) -> str:
        """Like a tweet. Requires a logged-in browser profile.
        Args:
            tweet_url: URL of the tweet to like
        """
        from tools_write import sync_like_tweet
        return await _call(sync_like_tweet, tweet_url)

    @mcp.tool()
    async def twitter_retweet(tweet_url: str) -> str:
        """Retweet a tweet. Requires a logged-in browser profile.
        Args:
            tweet_url: URL of the tweet to retweet
        """
        from tools_write import sync_retweet
        return await _call(sync_retweet, tweet_url)

    @mcp.tool()
    async def twitter_feed(max_results: int = 20) -> str:
        """Read your Twitter/X home feed. Requires a logged-in browser profile.
        Args:
            max_results: Max tweets to return (default 20)
        """
        from tools_feed import sync_read_feed
        return await _call(sync_read_feed, max_results)

    @mcp.tool()
    async def twitter_notifications() -> str:
        """Read your Twitter/X notifications and mentions. Requires a logged-in browser profile."""
        from tools_feed import sync_read_notifications
        return await _call(sync_read_notifications)

    @mcp.tool()
    async def twitter_bookmarks(max_results: int = 20) -> str:
        """Read your saved/bookmarked tweets on Twitter/X. Requires a logged-in browser profile.
        Args:
            max_results: Max bookmarks to return (default 20)
        """
        from tools_feed import sync_read_bookmarks
        return await _call(sync_read_bookmarks, max_results)

    return mcp


if __name__ == "__main__":
    mcp = create_server()
    mcp.run()
