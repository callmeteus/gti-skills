# Errors and Fallback

Read this when a `twitter_*` call returns `Error [KIND]:` and you need more than the table in `SKILL.md`.

## Why calls fail

X has no public free API, so the MCP drives a real browser that is logged in to the user's account. X limits how often one account may load its web app. Each full page load calls an internal endpoint named `Viewer`, and that endpoint answers HTTP 429 once the account has loaded the app too many times in about 15 minutes. While it is blocked, X renders a blank page: no tweets, no error text, and no login prompt.

Older versions of the MCP launched a new browser for every call and restored every old tab, so each call spent several page loads. The budget ran out after 3 calls, and every later call looked like a selector timeout (`Page.wait_for_selector: Timeout 10000ms exceeded`). The current MCP keeps one headless browser and one tab, navigates inside the loaded app, spaces calls by a few seconds, and reports the block as `RATE_LIMITED` with the reset time.

## Error kinds

| Kind | Cause | Retry inside the task? |
|------|-------|------------------------|
| `RATE_LIMITED` | HTTP 429 from X. The MCP refuses further calls until the reset time, without contacting X | No. Wait for the reset, which is usually more than this task can wait |
| `LOGIN_REQUIRED` | X redirected to its login page or answered HTTP 401 | No. The user must log in again |
| `PROFILE_IN_USE` | A second Chromium process holds `~/.twitter-mcp/chrome-profile`, for example another agent running the same MCP | No. The user must close the other process |
| `PAGE_ERROR` | X showed "Something went wrong" three times | Once, after a pause |
| `TIMEOUT` | Nothing rendered within 20 seconds, three times | Once, after a pause |
| `SELECTOR_CHANGED` | X returned the data, but the page has none of the elements the MCP reads | No. The MCP code needs an update |
| `ACCOUNT_NOT_FOUND` | The account or tweet does not exist, or is suspended | No. Check the spelling |
| `BROWSER_ERROR` | The browser crashed or could not start | Once. The MCP relaunches the browser |

An empty result (`No tweets found for query: ...`) is not an error. The query matched nothing; adjust the operators if the topic should have results.

## Fallback answer

When X data is unavailable, research the same question with web search and tell the user so at the top of the answer. Example opening, written in the user's language:

```text
X search was unavailable for this answer: X rate limited the account (RATE_LIMITED, resets at 12:56).
The findings below come from web sources: news sites, vendor advisories, and tweets indexed by search engines.
```

Useful web queries:

- The topic plus `site:x.com` or `site:twitter.com`, to find tweets that search engines indexed.
- The topic plus the names of accounts the user cares about.
- The primary sources that tweets usually link to: advisories, changelogs, GitHub issues, blog posts.

## What the user can do

| Problem | Fix |
|---------|-----|
| `RATE_LIMITED` keeps happening | Run fewer X calls per task, or raise `TWITTER_MCP_MIN_INTERVAL` (seconds between page loads, default 4) in the MCP server environment |
| `LOGIN_REQUIRED` | Stop the MCP server, run `python packages/python/twitter-mcp/login.py` from the gti-skills checkout, log in, and press Enter |
| `PROFILE_IN_USE` | Close other agent sessions that run the twitter MCP, or end the leftover Chromium process that uses `~/.twitter-mcp/chrome-profile` |
| Want to watch the browser | Set `TWITTER_MCP_HEADLESS=0` in the MCP server environment |
