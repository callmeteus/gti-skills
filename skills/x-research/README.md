# x-research

X/Twitter research skill for AI agents. Free, no API key, no intermediary — uses a Playwright-based MCP server (`twitter`) plus optional `x-tweet-fetcher` fallback.

## Features

- Search tweets by keyword/hashtag
- User profiles and recent tweets
- Trending topics
- Engagement metrics (Views, Likes, Retweets, Replies/comments)
- Reply/mention monitoring
- Watchlist support

## Requirements

- OpenCode (or Claude Code) with the `twitter` MCP server configured
- Python 3.10+ (for the `x-tweet-fetcher` fallback)
- A logged-in X session in the persistent browser profile (for search)

## Install

Copy this directory to your skills folder:

- OpenCode: `~/.config/opencode/skills/x-research`
- Claude Code: `~/.claude/skills/x-research`

## Setup (twitter MCP)

1. Clone and install the MCP server:
   ```bash
   git clone https://github.com/Miles0sage/twitter-mcp.git ~/.config/opencode/mcp-servers/twitter-mcp
   cd ~/.config/opencode/mcp-servers/twitter-mcp
   pip install -r requirements.txt
   python -m playwright install chromium
   ```
2. Register it in OpenCode:
   ```bash
   opencode mcp add twitter --global -- python ~/.config/opencode/mcp-servers/twitter-mcp/server.py
   ```
3. Log in once (headed browser) so the session persists:
   ```bash
   cd ~/.config/opencode/mcp-servers/twitter-mcp
   python login.py
   ```

## Fallback

`x-tweet-fetcher` (`xtf`) for single tweets/profiles without login:
```bash
pip install git+https://github.com/ythx-101/x-tweet-fetcher.git
xtf --url <tweet_url>
xtf --user-info <username>
```

## License

MIT
