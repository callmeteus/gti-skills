# Shopee MCP server

An MCP server that searches products, flash deals, shop profiles, reviews, trending and categories on Shopee across 9 markets.

No API key. Keyword search requires a one-time login (QR code or email/password) because Shopee only serves search results to a logged-in browser.

## Why the search opens a browser window

Shopee protects search with an anti-bot token (`af-ac-enc-dat`) that only the page itself can generate. Plain HTTP and headless browsers are rejected with error `90309999`. The server therefore runs the search in a real, visible Chrome window and reads the JSON response the page loads.

It is deliberately conservative because it runs on real customer accounts:

- **One window at a time.** Concurrent calls queue instead of opening several browsers.
- **One page load per search.** No reloads and no retry loops.
- **Minimum gap between searches.** `SHOPEE_MIN_INTERVAL_SECONDS` (default `10`) is enforced after the previous search finishes.
- Slow is fine; hammering is not.

## Run

Install the dependencies:

```bash
python -m pip install -r requirements.txt
```

Log in once (opens a visible Chrome window):

```bash
python login.py
```

The login helper keeps a dedicated Chrome profile in `.browser-profile/`. Do not delete it: Shopee trusts a browser that has completed a login, and `search_products` reuses the same profile. It also saves `cookies.json` as a backup — both contain real session tokens and are ignored by git.

Register the server with your agent. The command it runs is:

```bash
python mcp_server.py
```

For example, for OpenCode:

```bash
opencode mcp add shopee --global -- python /absolute/path/to/gti-skills/mcps/shopee-mcp/mcp_server.py
```

## Tools

| Tool | Purpose |
|------|---------|
| `search_products(keyword, sort, page, limit, min_price, max_price)` | Full keyword search with live prices |
| `search_autocomplete(query)` | Keyword and shop suggestions |
| `search_trending()` | Current trending searches |
| `products_trending()` | ~100 trending products |
| `product_details(product)` | Product detail by id or URL |
| `deals_flash_sale(...)` | Live flash-sale deals |
| `shop_details(shop)` | Shop profile, rating, followers |
| `shop_reviews(shop, rating, page)` | Shop reviews |
| `shop_categories(shop)` | Shop category tree |
| `shops_official()` | Official-store directory |
| `categories_list()` | Full category tree |

`sort` accepts `relevancy`, `sales`, `newest`, `price_asc`, `price_desc`. Prices are in the market currency (BRL for `country=br`).

## Layout

| Path | Responsibility |
|------|----------------|
| `mcp_server.py` | MCP entry point: 10+ Shopee tools |
| `login.py` | One-time Shopee login + persistent browser profile |
| `shopee/` | Scraper package (api, parsers, refs, schemas) |
| `pyproject.toml` | Project metadata and dependencies |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `SHOPEE_MIN_INTERVAL_SECONDS` | `10` | Minimum gap between two browser searches |
| `SHOPEE_HEADLESS` | `0` | Kept for compatibility; search requires a visible window |

See [../../../README.md](../../../README.md) for the full repository.
