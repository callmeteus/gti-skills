"""Write tools: post, reply, like, retweet. They need a logged-in browser profile."""

from browser_session import session
from tools_read import open_page
from x_state import ACCOUNT_NOT_FOUND, TwitterError

_TEXTBOX = '[data-testid="tweetTextarea_0"]'


async def _open_tweet(tweet_url: str):
    page = await open_page(tweet_url, '[data-testid="tweet"]', ("TweetDetail", "TweetResultByRestId"))
    if page is None:
        raise TwitterError(ACCOUNT_NOT_FOUND, f"The tweet {tweet_url} is not available.")
    return page


async def _type_and_send(page, text: str):
    textbox = page.locator(_TEXTBOX).first
    await textbox.click()
    await textbox.fill(text)
    await page.locator('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]').first.click()
    await page.wait_for_timeout(3000)


async def post_tweet(text: str) -> str:
    """Post a tweet to X/Twitter."""
    page = await open_page("https://x.com/compose/post", _TEXTBOX, ())
    if page is None:
        raise TwitterError(ACCOUNT_NOT_FOUND, "The compose box did not open.")
    await _type_and_send(page, text)
    return f"Tweet posted: {text[:50]}..."


async def reply_to_tweet(tweet_url: str, text: str) -> str:
    """Reply to a specific tweet."""
    page = await _open_tweet(tweet_url)
    await page.locator('[data-testid="reply"]').first.click()
    await page.wait_for_selector(_TEXTBOX, timeout=10000)
    await _type_and_send(page, text)
    return f"Replied to tweet: {text[:50]}..."


async def like_tweet(tweet_url: str) -> str:
    """Like a specific tweet."""
    page = await _open_tweet(tweet_url)
    await page.locator('[data-testid="like"]').first.click()
    await page.wait_for_timeout(2000)
    return f"Liked tweet: {tweet_url}"


async def retweet(tweet_url: str) -> str:
    """Retweet a specific tweet."""
    page = await _open_tweet(tweet_url)
    await page.locator('[data-testid="retweet"]').first.click()
    await page.locator('[data-testid="retweetConfirm"]').first.click()
    await page.wait_for_timeout(2000)
    return f"Retweeted tweet: {tweet_url}"


def sync_post_tweet(text: str) -> str:
    return session.run(lambda: post_tweet(text))


def sync_reply_to_tweet(tweet_url: str, text: str) -> str:
    return session.run(lambda: reply_to_tweet(tweet_url, text))


def sync_like_tweet(tweet_url: str) -> str:
    return session.run(lambda: like_tweet(tweet_url))


def sync_retweet(tweet_url: str) -> str:
    return session.run(lambda: retweet(tweet_url))
