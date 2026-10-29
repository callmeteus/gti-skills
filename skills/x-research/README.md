<div align="center">

# X Research

> What people on X are saying, with links and engagement

**Researches X (Twitter) through a free, browser-based MCP server: searches, profiles, timelines, and trends, with a web search fallback when X blocks it.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Python](https://img.shields.io/badge/python-3.10%2B-blue.svg)](#requirements)
[![Agents](https://img.shields.io/badge/agents-10%20supported-8A63D2.svg)](#installation)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](#requirements)
[![License](https://img.shields.io/badge/license-not%20declared-lightgrey.svg)](#license)

[Quick Start](#quick-start) • [Usage](#usage) • [Reference](#reference) • [Troubleshooting](#troubleshooting)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Reference](#reference)
- [Output](#output)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Overview

The X API is paid, and agents that scrape X with a browser tend to fail in confusing ways: X rate limits the account after a burst of page loads, then shows a blank page, and the agent sees only selector timeouts. It then retries with ever simpler queries, which extends the block.

X Research gives the agent a research loop over the `twitter` MCP server in [packages/python/twitter-mcp](../../packages/python/twitter-mcp/README.md). The server keeps one logged-in headless browser and runs calls one at a time. Failures come back as typed errors such as `RATE_LIMITED`, with the reset time. The skill tells the agent to plan a small call budget, run calls one after another, stop after repeated errors, and finish the research with web search while telling the user so.

```text
  question
     │
     v
  queries with X operators ──> references/search/operators.md
     │
     v
  twitter_search / twitter_user_tweets / twitter_trending   (one at a time)
     │                     │
     │ results             │ Error [KIND]
     v                     v
  synthesis by theme    stop, report, web search ──> references/reliability/errors-and-fallback.md
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Search X by keyword, operator, account, and date | Post, like, or reply unless you explicitly ask |
| Read profiles, recent tweets, and trending topics | Read DMs or manage the account |
| Report views, likes, retweets, replies, and links | Bypass X rate limits, CAPTCHAs, or login |
| Fall back to web search and say so when X is unavailable | Use the paid X API |

## Features

- **No API key:** the MCP server reads X through a logged-in Chromium profile.
- **Call budget:** the agent plans about 8 to 10 X calls per task and runs them one at a time.
- **Typed errors:** `RATE_LIMITED`, `LOGIN_REQUIRED`, `PROFILE_IN_USE`, `PAGE_ERROR`, `TIMEOUT`, `SELECTOR_CHANGED`, `ACCOUNT_NOT_FOUND`, and `BROWSER_ERROR`, each with a fixed response in the skill.
- **Honest fallback:** when X is unavailable, the answer opens with what failed and when it resets, and marks which findings come from the web.
- **Web search operators:** `from:`, `to:`, `url:`, `filter:links`, `min_faves:`, `since:`, `conversation_id:`, and more.
- **Engagement data:** views, likes, retweets, replies, and the tweet URL for each result.
- **Watchlist:** a JSON list of accounts to check in one pass.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| `twitter` MCP server | [packages/python/twitter-mcp](../../packages/python/twitter-mcp/README.md) | The `twitter_*` tools | No |
| Python | 3.10+ | Runs the MCP server | No |
| `mcp`, `playwright`, `httpx` | Latest | MCP server dependencies | No |
| Playwright Chromium | Matches `playwright` | The browser the server drives | No |
| X account | - | Logged in once with `login.py` | No |
| `x-tweet-fetcher` | Latest | Optional fallback for single tweets and profiles | No |

The MCP server runs the same way on macOS, Linux, and Windows. On a Linux server without a display, keep the default headless mode.

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill x-research
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--scope user` to install for every project, and `--dry-run` to preview.

| Agent | Id | Project folder | User folder |
|-------|----|----------------|-------------|
| Cursor / Cursor CLI | `cursor` | `.cursor/skills` | `~/.cursor/skills` |
| Claude / Claude Code | `claude` | `.claude/skills` | `~/.claude/skills` |
| Antigravity | `antigravity` | `.agents/skills` | `~/.gemini/antigravity/skills` |
| OpenCode | `opencode` | `.opencode/skills` | `~/.config/opencode/skills` |
| Cline | `cline` | `.cline/skills` | `~/.cline/skills` |
| Kilo Code | `kilo` | `.kilocode/skills` | `~/.kilocode/skills` |
| Kiro | `kiro` | `.kiro/skills` | `~/.kiro/skills` |
| Codex | `codex` | `.agents/skills` | `~/.agents/skills` |
| GitHub Copilot | `copilot` | `.github/skills` | `~/.copilot/skills` |
| Muse Code | `muse` | `.agents/skills` | `~/.agents/skills` |

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/x-research` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/x-research .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\x-research .claude\skills\
```

Then set up the MCP server, from the repository root. Install its dependencies:

```bash
python -m pip install -r packages/python/twitter-mcp/requirements.txt
python -m playwright install chromium
```

Log in to X once in a visible browser. Run it while no MCP server is running:

```bash
python packages/python/twitter-mcp/login.py
```

Register the server with your agent, using the absolute path of your checkout. In Claude Code:

```bash
claude mcp add twitter --scope user -- python /absolute/path/to/gti-skills/packages/python/twitter-mcp/server.py
```

In OpenCode:

```bash
opencode mcp add twitter --global -- python /absolute/path/to/gti-skills/packages/python/twitter-mcp/server.py
```

Each agent has a short guide in `skills/x-research/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

Optionally, install the fallback tool for single tweets and profiles:

```bash
python -m pip install git+https://github.com/ythx-101/x-tweet-fetcher.git
```

## Quick Start

```text
What are security researchers on X saying about the latest Node.js CVE?
```

The agent turns the question into a few operator queries, runs them one at a time through the MCP server, checks the key accounts, and returns findings grouped by theme with engagement numbers and tweet links.

## Usage

### Input

| Input | Required | Example |
|-------|:--------:|---------|
| Topic or question | Yes | "What do people think of Bun 2.0?" |
| Accounts | No | `@TheHackerWire`, a watchlist file |
| Time range | No | "this week", `since:2026-10-01` |
| Depth | No | "quick check" or "deep research" |

### Examples

```text
Search X for CVE-2026-111497 and tell me who reported it first.
```

```text
Check my watchlist.json accounts on X and summarize anything new.
```

```text
What is trending on X right now, and which trends are about security?
```

## How It Works

```text
  1. Decompose      3-5 queries with X web search operators
          │
  2. Search         twitter_search, one call at a time, budget of 8-10 calls
          │
  3. Deep-dive      twitter_user and twitter_user_tweets for key accounts
          │
  4. Trends         twitter_trending when the question needs it
          │
  5. Synthesize     themes, engagement, links
          │
  on Error [KIND]   stop after two errors, twitter_status, web search, say so
```

## Reference

### Reference files

The agent reads a file only when a step needs it.

| File | Purpose | Used in |
|------|---------|---------|
| `references/search/operators.md` | X web search operators and query advice | Step 1 |
| `references/reliability/errors-and-fallback.md` | Causes of each error kind, fallback answer, fixes for the user | Errors |
| `assets/templates/watchlist.example.json` | Watchlist file format | Watchlist |

### MCP tools used

| Tool | Purpose | Key parameters |
|------|---------|----------------|
| `twitter_search` | Latest tweets for a query | `query`, `max_results` |
| `twitter_user` | Profile: name, bio, followers, following | `username` |
| `twitter_user_tweets` | Recent tweets from an account | `username`, `max_results` |
| `twitter_trending` | Trending topics | None |
| `twitter_status` | Rate-limit state, without contacting X | None |
| `twitter_feed`, `twitter_notifications`, `twitter_bookmarks` | Logged-in timelines | `max_results` |

The MCP server settings (`TWITTER_MCP_HEADLESS`, `TWITTER_MCP_MIN_INTERVAL`, `TWITTER_MCP_PROFILE`, `TWITTER_MCP_CALL_TIMEOUT`) are documented in the [package README](../../packages/python/twitter-mcp/README.md#environment).

## Output

```markdown
## Node.js CVE-2026-111497 on X

### Exploit reports
- @TheHackerWire: proof of concept published, links the GitHub repository.
  Views: 12400 | Likes: 210 | Retweets: 85 | Replies (comments): 14
  https://x.com/TheHackerWire/status/1850000000000000000

### Patch status
- ...
```

| Section | Contents |
|---------|----------|
| Availability note | Only when X failed: the error kind, the reset time, and that web sources were used |
| Themes | Findings grouped by theme, not by query |
| Evidence | Author, summary, engagement numbers, and the tweet URL for each finding |
| Sources | Which findings come from X and which from the web |

## Security

- **Account:** the MCP server acts as your logged-in X account. Read tools only read; write tools (`twitter_post`, `twitter_reply`, `twitter_like`, `twitter_retweet`) are used only when you explicitly ask.
- **Session files:** the login lives in `~/.twitter-mcp/chrome-profile` and `~/.twitter-mcp/storage_state.json`. Treat them like a password.
- **Network:** the server talks to x.com and to the public FxTwitter API (`api.fxtwitter.com`) for engagement numbers. The fallback sends queries to a web search engine.

## Troubleshooting

<details>
<summary><strong>Every call returns Error [RATE_LIMITED]</strong></summary>

X throttled the account after too many page loads in about 15 minutes. Wait for the reset time in the message; calls before it fail at once without contacting X. If it happens often, run fewer calls per task or raise `TWITTER_MCP_MIN_INTERVAL` in the MCP server environment.

</details>

<details>
<summary><strong>Calls return Error [LOGIN_REQUIRED]</strong></summary>

The X session in the browser profile expired. Stop the agent that runs the MCP server, then log in again.

```bash
python packages/python/twitter-mcp/login.py
```

</details>

<details>
<summary><strong>Calls return Error [PROFILE_IN_USE]</strong></summary>

Another MCP server process or browser already uses `~/.twitter-mcp/chrome-profile`, often a second agent session. Close it, or end the leftover Chromium process, and retry.

</details>

<details>
<summary><strong>The agent says the twitter tools are missing</strong></summary>

The MCP server is not registered in your agent. Register it as shown in [Installation](#installation) and restart the agent session.

</details>

<details>
<summary><strong>Calls return Error [SELECTOR_CHANGED]</strong></summary>

X changed its page layout and the server no longer finds tweets in the page. The selectors in `packages/python/twitter-mcp/tools_read.py` need an update.

</details>

## Limitations

- X allows only a limited number of page loads per account in about 15 minutes; deep research may need to wait for a reset.
- Search reads the Latest tab only, about 10 to 30 tweets per query.
- Results depend on X's page layout, which changes without notice.
- The fallback relies on what search engines indexed from X, which is incomplete and delayed.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [twitter-mcp](https://github.com/Miles0sage/twitter-mcp) | MIT | Base of the MCP server in `packages/python/twitter-mcp` |
| [FxEmbed](https://github.com/FxEmbed/FxEmbed) | MIT | Public API for engagement numbers |
| [x-tweet-fetcher](https://github.com/ythx-101/x-tweet-fetcher) | MIT | Fallback for single tweets and profiles |
| [x-research-skill](https://github.com/rohunvora/x-research-skill) | Not declared | The original research loop |

## License

No license has been declared for this skill yet. See the [root README](../../README.md#license).
