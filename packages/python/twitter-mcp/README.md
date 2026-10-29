# Twitter MCP server

An MCP server that reads and posts on X (Twitter) by driving a logged-in headless Chromium, with no API key.

## Overview

This package is the `twitter` MCP server that the [X Research](../../../skills/x-research/README.md) skill calls. It is a fork of [Miles0sage/twitter-mcp](https://github.com/Miles0sage/twitter-mcp) (MIT, see [LICENSE](LICENSE)), changed to survive real research sessions:

- **One shared browser:** the first tool call launches one Chromium on a persistent profile, and every later call reuses it on a single tab. Calls run one at a time. Each full page load of x.com calls the rate-limited `Viewer` API, so the server navigates inside the loaded app instead of reloading.
- **Headless by default:** the window only appears with `TWITTER_MCP_HEADLESS=0` or during `login.py`.
- **Typed errors:** a failed call returns one line, `Error [KIND]: ...`. `RATE_LIMITED` includes the reset time, and calls made before that time fail at once without contacting X. The kinds are defined in `x_state.py`.
- **Pacing and retries:** at least `TWITTER_MCP_MIN_INTERVAL` seconds between page loads, and two retries with backoff for `PAGE_ERROR` and `TIMEOUT`.

The server does not bypass X limits, CAPTCHAs, or login checks. It needs an X account that you log in to once with `login.py`. Engagement counts come from the public FxTwitter API when it answers, and from the page otherwise.

## Run

Install the dependencies and the Chromium build that Playwright uses:

```bash
python -m pip install -r packages/python/twitter-mcp/requirements.txt
python -m playwright install chromium
```

Log in once. Run this while no MCP server is running, because two browsers cannot share the profile:

```bash
python packages/python/twitter-mcp/login.py
```

Register the server with your agent. The command it runs is:

```bash
python packages/python/twitter-mcp/server.py
```

For example, for OpenCode:

```bash
opencode mcp add twitter --global -- python /absolute/path/to/gti-skills/packages/python/twitter-mcp/server.py
```

To try the read tools without an agent, from the package folder:

```bash
cd packages/python/twitter-mcp
python tools_read.py "CVE" "from:TheHackerWire"
```

## Layout

| Path | Responsibility |
|------|----------------|
| `server.py` | MCP entry point: tool definitions, `twitter_status`, and error formatting |
| `browser_session.py` | Shared browser session: launch, single tab, serialized calls, pacing, rate-limit circuit breaker, settings |
| `x_state.py` | Error kinds and the classifier that turns page and network state into a result or a typed error. No Playwright import |
| `tools_read.py` | `twitter_search`, `twitter_user`, `twitter_user_tweets`, `twitter_trending`, and the navigation and wait logic |
| `tools_feed.py` | `twitter_feed`, `twitter_notifications`, `twitter_bookmarks` |
| `tools_write.py` | `twitter_post`, `twitter_reply`, `twitter_like`, `twitter_retweet` |
| `login.py` | Opens a visible browser on the profile for a one-time login |
| `twitter_keepalive.py` | Optional standalone ping that keeps the session cookies fresh; logs to `data/` |
| `tests/` | Unit tests for `x_state.py` |

## Scripts

| Command | Action |
|---------|--------|
| `python server.py` | Start the MCP server on stdio |
| `python login.py` | Log in to X in a visible browser and save the session |
| `python tools_read.py [QUERY ...]` | Run searches from the terminal and print the results or the typed error |
| `python twitter_keepalive.py` | Load x.com once to refresh cookies; exits 1 when the session expired |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `TWITTER_MCP_PROFILE` | `~/.twitter-mcp/chrome-profile` | Chromium profile folder that holds the X login |
| `TWITTER_MCP_HEADLESS` | `1` | `0` shows the browser window |
| `TWITTER_MCP_MIN_INTERVAL` | `4` | Minimum seconds between page loads |
| `TWITTER_MCP_CALL_TIMEOUT` | `120` | Maximum seconds for one tool call |

The session cookies are also backed up to `~/.twitter-mcp/storage_state.json`. A new, empty profile is seeded from that file.

## Testing

```bash
python -m unittest discover -s packages/python/twitter-mcp/tests -v
```

The tests cover the classifier in `x_state.py`: results, empty results, the blank page that X shows with HTTP 429 on `Viewer`, login redirects, missing accounts, changed selectors, timeouts, and the error message format. They do not touch the network or launch a browser. `npm test` runs them with the other Python tests.

See [../../../README.md](../../../README.md) for the full repository.
