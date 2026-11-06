# Shopee MCP server

An MCP server that searches products, flash deals, shop profiles, reviews, trending and categories on Shopee across 9 markets. No API key — uses curl_cffi TLS impersonation to talk to Shopee directly.

Requires a one-time login (QR code or email/password) to cross Shopee's login-gated search. Run `login.py` once before using.

## Run

Install the dependencies:

```bash
python -m pip install -r requirements.txt
```

Log in once (opens a visible Chrome window):

```bash
python login.py
```

Register the server with your agent. The command it runs is:

```bash
python mcp_server.py
```

For example, for OpenCode:

```bash
opencode mcp add shopee --global -- python /absolute/path/to/gti-skills/mcps/shopee-mcp/mcp_server.py
```

## Layout

| Path | Responsibility |
|------|----------------|
| `mcp_server.py` | MCP entry point: 10+ Shopee tools |
| `login.py` | One-time Shopee login + cookie capture |
| `shopee/` | Scraper package (api, parsers, refs, schemas) |
| `pyproject.toml` | Project metadata and dependencies |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `SHOPEE_HEADLESS` | `0` | `1` shows the browser window during login |

See [../../../README.md](../../../README.md) for the full repository.
