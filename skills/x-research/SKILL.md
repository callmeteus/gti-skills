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
compatibility: Requires the twitter MCP server from packages/python/twitter-mcp in the gti-skills repository (Python 3.10+, Playwright Chromium) and an X account logged in once with its login.py.
---

# X Research

## Core Rule
Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

Agentic research over X/Twitter via the free `twitter` MCP server (Playwright browser automation, no API key, no intermediary). The MCP drives one shared headless browser with a logged-in X session. Search and timelines need that login; X shows almost nothing to logged-out visitors.

## Available MCP Tools

All tools are provided by the `twitter` MCP server. If no `twitter_*` tools are available, tell the user the MCP server is not configured (setup: `packages/python/twitter-mcp/README.md` in the gti-skills repository) and use the web search fallback described in [When a Tool Fails](#when-a-tool-fails).

- `twitter_search(query, max_results)`: Search tweets by keyword or hashtag. Results include Views, Likes, Retweets, Replies (comments), and the tweet URL.
- `twitter_user(username)`: Get a user's profile (bio, followers, following).
- `twitter_user_tweets(username, max_results)`: Get recent tweets from a user.
- `twitter_trending()`: Get trending topics.
- `twitter_status()`: Report whether the MCP is rate limited and until when. It does not contact X.
- `twitter_feed(max_results)`: Read your home timeline.
- `twitter_bookmarks(max_results)`: Read saved bookmarks.
- `twitter_notifications()`: Read notifications and mentions.
- `twitter_post(text)`, `twitter_reply(tweet_url, text)`, `twitter_like(tweet_url)`, `twitter_retweet(tweet_url)`: Write actions. Use them only when the user explicitly asks.

## Call Budget and Concurrency

X rate limits the logged-in account, not the query. Every call costs part of a budget that resets about every 15 minutes, whatever the query is.

- **One call at a time:** never issue `twitter_*` calls in parallel. Wait for each result before the next call. The MCP queues parallel calls anyway, so parallel calls only make the wait longer and hide which call failed.
- **Budget:** plan at most 8 to 10 X calls per research task. Prefer one good query with operators over several near-duplicate queries.
- **No redundant calls:** do not repeat a query that already returned results, and do not fetch a profile when its tweets are enough.

## Research Loop (Agentic)

When doing deep research (not just a quick search), follow this loop:

### 1. Decompose the Question into Queries

Turn the research question into 3-5 keyword queries using X web search operators. Read [references/search/operators.md](references/search/operators.md) for the full list; `twitter_search` takes web search syntax such as `filter:links` and `min_faves:`, not the paid API syntax such as `has:links`.

- **Core query**: Direct keywords for the topic
- **Expert voices**: `from:` specific known experts
- **Pain points**: Keywords like `(broken OR bug OR issue OR migration)`
- **Positive signal**: Keywords like `(shipped OR love OR fast OR benchmark)`
- **Links**: `url:github.com` or `url:` specific domains
- **Less noise**: add `-filter:replies -filter:nativeretweets`, or `min_faves:10` on busy topics

### 2. Search and Extract

Run the queries one after another via `twitter_search`. After each, assess:
- Signal or noise? Adjust operators.
- Key voices worth checking with `twitter_user_tweets`?
- Threads worth following?
- Linked resources worth deep-diving with `web_fetch`?

If a call returns an error, follow [When a Tool Fails](#when-a-tool-fails) before running the next query.

### 3. Profile Deep-Dives

For key accounts, use `twitter_user` for profile info and `twitter_user_tweets` for recent posts.

### 4. Trends

Use `twitter_trending` to discover what is currently popular.

### 5. Synthesize

Group findings by theme, not by query. Include engagement data (Views, Likes, Retweets, Replies/comments) and direct links.

## When a Tool Fails

Failed calls return one line that starts with `Error [KIND]:`. Act on the kind, not on the wording:

| Kind | What it means | What to do |
|------|---------------|------------|
| `RATE_LIMITED` | X answered HTTP 429; the message gives the reset time | Stop all X calls until the reset. Fall back to web search |
| `LOGIN_REQUIRED` | The browser session is logged out | Ask the user to run `python packages/python/twitter-mcp/login.py` from the gti-skills checkout. Fall back to web search |
| `PROFILE_IN_USE` | Another browser or MCP process holds the profile | Tell the user to close the other process. Fall back to web search |
| `PAGE_ERROR`, `TIMEOUT` | X failed to render after the MCP's own retries | Make one more call after a pause. If it fails again, treat it as `RATE_LIMITED` |
| `SELECTOR_CHANGED` | Data arrived but the page layout changed | The MCP needs a code update. Tell the user and fall back to web search |
| `ACCOUNT_NOT_FOUND` | The account or tweet does not exist or is suspended | Check the spelling; continue with other calls |
| `BROWSER_ERROR` | The browser crashed | Retry once; the MCP relaunches the browser |

Rules:

- **Never retry with simpler queries.** A shorter query does not get past a rate limit or a login wall. It spends the budget faster and extends the block.
- **Stop after two errors in a row** of any kind except `ACCOUNT_NOT_FOUND`. Call `twitter_status` once to read the reset time, then stop calling X tools for this task.
- **Fall back and say so.** Continue the research with web search (search the web for the topic plus `site:x.com` or `twitter`, and use the original sources the tweets would link to). Open the answer with one sentence that says X data was unavailable, which error happened, and when it resets, so the user knows the results do not come from a live X search.
- **Keep partial results.** If some X calls succeeded before the failure, use them and mark which findings come from X and which from the web.

See [references/reliability/errors-and-fallback.md](references/reliability/errors-and-fallback.md) for the causes behind each kind, an example fallback answer, and how the user can fix the MCP.

## Reply / Mention Monitoring

- Mentions: `twitter_search("@handle")` or `twitter_notifications()`.
- Replies to an account: `twitter_search("to:handle")`.

## Fallback: x-tweet-fetcher

For a single tweet or profile, the installed Python tool works without the MCP and without login:

```
xtf --url <tweet_url>               # single tweet
xtf --user-info <username>          # profile
xtf --user <username> --limit 20    # timeline (needs Nitter)
xtf --search "<query>" --limit 10   # search (needs Nitter)
```

## Watchlist

Keep the accounts to monitor in a `watchlist.json` in the user's project, in the format of [assets/templates/watchlist.example.json](assets/templates/watchlist.example.json). Check them one at a time with `twitter_user_tweets(username, 5)` and summarize new posts. A watchlist of more than about 8 accounts does not fit in one rate-limit window; check the rest after the reset.

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`. The `twitter` MCP server is configured separately in each agent.

## Credits

- twitter-mcp: https://github.com/Miles0sage/twitter-mcp
- x-tweet-fetcher: https://github.com/ythx-101/x-tweet-fetcher
- Original x-research skill: https://github.com/rohunvora/x-research-skill
