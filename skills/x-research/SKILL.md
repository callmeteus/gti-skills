---
name: x-research
description: >
  X/Twitter research agent using the free Playwright-based twitter MCP (no API key, no intermediary).
  Searches X for real-time perspectives, discussions, product feedback,
  breaking news, and expert opinions. Supports reply monitoring,
  profile analysis, thread following, and trend discovery.
  Use when: (1) user says "x research", "search x for", "search twitter for",
  "what are people saying about", "check x for", "x search",
  "/x-research", (2) user wants to find replies, mentions, or engagement data,
  (3) user wants to monitor specific accounts or topics.
  NOT for: posting tweets, account management, DMs.
---

# X Research

## Core Rule
Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

Agentic research over X/Twitter via the free `twitter` MCP server (Playwright browser automation, no API key, no intermediary). Read-only tools work without authentication; write tools require a one-time browser login.

## Available MCP Tools

All tools are provided by the `twitter` MCP server:

- `twitter_search(query, max_results)` — Search tweets by keyword/hashtag. Results include Views, Likes, Retweets, and Replies (comments).
- `twitter_user(username)` — Get a user's profile (bio, followers, following).
- `twitter_user_tweets(username, max_results)` — Get recent tweets from a user.
- `twitter_trending()` — Get trending topics.
- `twitter_feed(max_results)` — Read your home timeline (requires login).
- `twitter_bookmarks(max_results)` — Read saved bookmarks (requires login).
- `twitter_notifications()` — Read notifications/mentions (requires login).
- `twitter_post(text)` — Post a tweet (requires login).
- `twitter_reply(tweet_url, text)` — Reply to a tweet (requires login).
- `twitter_like(tweet_url)` — Like a tweet (requires login).
- `twitter_retweet(tweet_url)` — Retweet (requires login).

## Research Loop (Agentic)

When doing deep research (not just a quick search), follow this loop:

### 1. Decompose the Question into Queries

Turn the research question into 3-5 keyword queries using X search operators:

- **Core query**: Direct keywords for the topic
- **Expert voices**: `from:` specific known experts
- **Pain points**: Keywords like `(broken OR bug OR issue OR migration)`
- **Positive signal**: Keywords like `(shipped OR love OR fast OR benchmark)`
- **Links**: `url:github.com` or `url:` specific domains

### 2. Search and Extract

Run each query via `twitter_search`. After each, assess:
- Signal or noise? Adjust operators.
- Key voices worth checking with `twitter_user_tweets`?
- Threads worth following?
- Linked resources worth deep-diving with `web_fetch`?

### 3. Profile Deep-Dives

For key accounts, use `twitter_user` for profile info and `twitter_user_tweets` for recent posts.

### 4. Trends

Use `twitter_trending` to discover what is currently popular.

### 5. Synthesize

Group findings by theme, not by query. Include engagement data (Views, Likes, Retweets, Replies/comments) and direct links.

## Reply / Mention Monitoring

- Mentions: `twitter_search("@handle")` or `twitter_notifications()` (requires login).
- Replies to an account: `twitter_search("to:handle")`.

## Notes on Reliability

- X changes its UI frequently; if a tool times out, retry or fall back to `x-tweet-fetcher` (`xtf`) for single tweets/profiles.
- For single tweet URLs, `xtf --url <tweet_url>` works without login.
- Avoid redundant calls; there is no cache — batch queries when possible.

## Fallback: x-tweet-fetcher

If the MCP is unavailable, use the installed Python tool:

```
xtf --url <tweet_url>               # single tweet
xtf --user-info <username>          # profile
xtf --user <username> --limit 20    # timeline (needs Nitter)
xtf --search "<query>" --limit 10   # search (needs Nitter)
```

## Watchlist

Maintain a simple list of accounts to monitor. Check them with `twitter_user_tweets(username, 5)` and summarize new posts.

## Credits

- twitter-mcp: https://github.com/Miles0sage/twitter-mcp
- x-tweet-fetcher: https://github.com/ythx-101/x-tweet-fetcher
- Original x-research skill: https://github.com/rohunvora/x-research-skill
