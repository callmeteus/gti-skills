"""MCP wrapper for omkarcloud/shopee-scraper.

Exposes the scraper's 10 Shopee endpoints as MCP tools, with Brazil (`br`)
as the default market. No API key — it uses the scraper's curl_cffi TLS
impersonation to talk to Shopee directly.

Run (stdio):  python mcp_server.py
"""

import functools
import json
import os
import re
import sys
import threading
import time

# Make the repo root importable so `from shopee import ...` works regardless
# of the process working directory.
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)

from mcp.server.fastmcp import FastMCP

from shopee import api, parsers, refs

mcp = FastMCP("shopee")

DEFAULT_COUNTRY = "br"
MARKETS = list(refs.MARKETS)


def _resolve_product(value, country):
    """Canonicalize a product ref and honour a link's own market."""
    ref = refs.resolve_product(value)
    cc = ref.country or country
    return cc, f"{ref.shop_id}.{ref.item_id}"


def _resolve_shop(value, country):
    """Canonicalize a shop ref and honour a link's own market."""
    ref = refs.resolve_shop(value)
    cc = ref.country or country
    canonical = str(ref.shop_id) if ref.shop_id else ref.username
    return cc, canonical


def _country(cc):
    cc = (cc or DEFAULT_COUNTRY).lower()
    if cc not in refs.MARKETS:
        raise ValueError(f"country must be one of {', '.join(refs.MARKETS)} (got {cc!r})")
    return cc


def _safe(fn):
    """Run a scraper call and fold exceptions into a clean error dict."""
    try:
        return fn()
    except Exception as e:  # noqa: BLE001 - report any scraper failure to the agent
        return {"error": str(e)}


# ---- keyword search (login-gated) -------------------------------------------
# Shopee's /api/v4/search/search_items rejects plain HTTP with captured cookies
# (anti-bot error 90309999) and ignores headless browsers. A real, headed
# Chrome passes, so login.py keeps a persistent profile and the search reads
# the JSON the page itself loads.

COOKIE_FILE = os.path.join(_SCRIPT_DIR, "cookies.json")

_SEARCH_SORT = {
    "relevancy": ("relevancy", "desc"),
    "sales": ("sales", "desc"),
    "newest": ("ctime", "desc"),
    "price_asc": ("price", "asc"),
    "price_desc": ("price", "desc"),
}


def _parse_search_items(payload, country):
    """Shopee search_items payload -> list of clean product rows.

    Handles both shapes Shopee serves: the classic `data.items[].item_basic`
    and the current web BFF shape with the item at the root and the fields
    split across `item_data` / `item_card_displayed_asset`.
    """
    payload = payload or {}
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    items = data.get("items") or payload.get("items") or []

    def first(*values):
        return next((v for v in values if v not in (None, "")), None)

    def sold_number(value):
        if isinstance(value, dict):
            value = first(value.get("historical_sold_count"), value.get("text"),
                          value.get("value"), value.get("count"))
        if isinstance(value, bool) or value is None:
            return None
        if isinstance(value, (int, float)):
            return value
        text_value = str(value).lower().replace(".", "").replace(",", ".")
        match = re.search(r"[\d.]+", text_value)
        if not match:
            return None
        amount = float(match.group(0))
        if "mil" in text_value:
            amount *= 1000
        elif "k" in text_value:
            amount *= 1000
        return int(amount) if amount.is_integer() else amount

    rows = []
    for it in items:
        if not isinstance(it, dict):
            continue
        b = it.get("item_basic") or {}
        d = it.get("item_data") or {}
        a = it.get("item_card_displayed_asset") or {}
        price_info = d.get("item_card_display_price") or {}
        shop_id = first(b.get("shopid"), d.get("shopid"), it.get("shopid"))
        item_id = first(b.get("itemid"), d.get("itemid"), it.get("itemid"))
        if not item_id:
            continue
        shop_data = d.get("shop_data") or {}
        rating = first(b.get("item_rating"), d.get("item_rating")) or {}
        rows.append({
            "id": item_id,
            "shop_id": shop_id,
            "name": parsers.text(first(b.get("name"), a.get("name"))),
            "link": refs.product_link(country, shop_id, item_id),
            "image": parsers.image(country, first(b.get("image"), a.get("image"))),
            "images": parsers.images(country, first(b.get("images"), a.get("images"))),
            "currency": refs.CURRENCY_OF[country],
            "price": parsers.money(first(b.get("price"), price_info.get("price"))),
            "price_min": parsers.money(b.get("price_min")),
            "price_max": parsers.money(b.get("price_max")),
            "price_before_discount": parsers.money(first(
                b.get("price_before_discount"), price_info.get("strikethrough_price"))),
            "discount_percent": parsers.number(first(
                b.get("show_discount"), price_info.get("discount"))) or None,
            "sold_count": sold_number(first(
                b.get("historical_sold"), d.get("item_card_display_sold_count"),
                a.get("sold_count"))),
            "stock": parsers.number(b.get("stock")) if b.get("stock") is not None else (
                0 if d.get("is_sold_out") else None),
            "rating": parsers.rating_block(rating),
            "likes_count": parsers.number(first(b.get("liked_count"), d.get("liked_count"))),
            "shop_location": parsers.text(first(b.get("shop_location"), a.get("shop_location"))),
            "is_shopee_verified": parsers.flag(first(
                b.get("shopee_verified"), d.get("shopee_verified"),
                shop_data.get("is_shopee_verified"))),
            "is_official_shop": parsers.flag(first(
                b.get("is_official_shop"), shop_data.get("is_official_shop"))),
            "is_adult": parsers.flag(first(b.get("is_adult"), d.get("is_adult"))),
            "is_ad": bool(it.get("adsid")),
            "listed_at": parsers.ts(first(b.get("ctime"), d.get("ctime"))),
        })
    total = first(data.get("total_count"), data.get("total"), payload.get("total_count"))
    return rows, total


# ---- browser search ----------------------------------------------------------
# Shopee's anti-bot (error 90309999) rejects plain HTTP with captured cookies
# and also rejects headless Chrome: the request needs the page-generated
# `af-ac-enc-dat` token and a `global_search_session_id`. A real, headed
# browser passes, so the search runs there and we capture the JSON response
# the page itself loads.

BROWSER_PROFILE = os.path.join(_SCRIPT_DIR, ".browser-profile")

_COOKIE_KEYS = {"name", "value", "domain", "path", "expires", "httpOnly", "secure", "sameSite"}


def _browser_cookies():
    """Cookies from cookies.json in Playwright's add_cookies format."""
    if not os.path.exists(COOKIE_FILE):
        return []
    with open(COOKIE_FILE, encoding="utf-8") as f:
        raw = (json.load(f) or {}).get("cookies") or []
    out = []
    for c in raw:
        c = {k: v for k, v in c.items() if k in _COOKIE_KEYS}
        same_site = (c.get("sameSite") or "").lower()
        if same_site:
            c["sameSite"] = {"lax": "Lax", "strict": "Strict", "none": "None"}.get(
                same_site, "Lax")
        else:
            c.pop("sameSite", None)
        if c.get("expires") in (None, 0):
            c["expires"] = -1
        if "domain" not in c and "url" not in c:
            continue
        out.append(c)
    return out


# Searches are serialized and rate-limited: this runs on real customer
# accounts, so one window at a time, one page load per call, and a minimum
# gap between searches. Slow is fine; hammering is not.
_BROWSER_LOCK = threading.Lock()
_BROWSER_LAST_DONE = [0.0]
_BROWSER_MIN_INTERVAL = max(
    0.0, float(os.environ.get("SHOPEE_MIN_INTERVAL_SECONDS", "10") or 0))


def _search_browser(country, keyword, sort, page, limit, min_price, max_price):
    """Run the search in a real headed Chrome and capture the page's own JSON."""
    try:
        from patchright.sync_api import sync_playwright
    except ImportError:
        return {"error": "browser fallback unavailable: pip install patchright"}

    if sort not in _SEARCH_SORT:
        return {"error": f"sort must be one of {', '.join(_SEARCH_SORT)}"}
    by, order = _SEARCH_SORT[sort]
    url = (f"{refs.site(country)}/search?keyword={keyword.replace(' ', '%20')}"
           f"&page={page - 1}&sortBy={by}&order={order}")

    captured = []

    def on_response(resp):
        if "/api/v4/search/search_items" not in resp.url:
            return
        try:
            payload = resp.json()
        except Exception:
            return
        data = (payload or {}).get("data")
        items = ((data.get("items") if isinstance(data, dict) else None)
                 or (payload or {}).get("items") or [])
        if items and (payload or {}).get("error") in (None, 0, ""):
            captured.append(payload)

    with _BROWSER_LOCK:
        wait = _BROWSER_MIN_INTERVAL - (time.time() - _BROWSER_LAST_DONE[0])
        if wait > 0:
            time.sleep(wait)
        try:
            with sync_playwright() as p:
                ctx = p.chromium.launch_persistent_context(
                    user_data_dir=BROWSER_PROFILE,
                    channel="chrome",
                    headless=False,
                    locale="pt-BR",
                    timezone_id="America/Sao_Paulo",
                    viewport={"width": 1366, "height": 900},
                )
                try:
                    tab = ctx.pages[0] if ctx.pages else ctx.new_page()
                    tab.on("response", on_response)

                    shopee_cookies = [c for c in ctx.cookies()
                                      if "shopee" in c["domain"]]
                    if not any(c["name"] == "SPC_U" for c in shopee_cookies):
                        cookies = _browser_cookies()
                        if cookies:
                            ctx.add_cookies(cookies)

                    # One navigation only. No reloads, no retries.
                    tab.goto(url, wait_until="domcontentloaded", timeout=45000)

                    deadline = time.time() + 25
                    while time.time() < deadline and not captured:
                        tab.wait_for_timeout(1000)
                finally:
                    try:
                        ctx.close()
                    except Exception:
                        pass
        except Exception as e:
            return {"error": f"browser search failed: {type(e).__name__}: {e}"}
        finally:
            _BROWSER_LAST_DONE[0] = time.time()

    if not captured:
        return {"error": "Shopee did not return results in the browser. "
                         "Run `python login.py` again and confirm you are logged in."}

    rows, total = _parse_search_items(captured[0], country)
    if min_price is not None:
        rows = [r for r in rows if (r.get("price") or 0) >= min_price]
    if max_price is not None:
        rows = [r for r in rows if (r.get("price") or 0) <= max_price]
    rows = rows[:limit]
    return {
        "country": country,
        "currency": refs.CURRENCY_OF[country],
        "query": keyword,
        "sort": sort,
        "page": page,
        "total": total,
        "count": len(rows),
        "results": rows,
        "source": "browser",
    }


# ---- search ------------------------------------------------------------------


@mcp.tool()
def search_autocomplete(query: str, country: str = DEFAULT_COUNTRY) -> dict:
    """Shopee search autocomplete: keyword and shop suggestions for a partial
    query. Returns suggested keywords and matching shops."""
    cc = _country(country)
    return _safe(lambda: api.search_autocomplete(country=cc, query=query))


@mcp.tool()
def search_trending(country: str = DEFAULT_COUNTRY) -> dict:
    """Shopee's current trending searches for a market."""
    cc = _country(country)
    return _safe(lambda: api.search_trending(country=cc))


@mcp.tool()
async def search_products(
    keyword: str,
    country: str = DEFAULT_COUNTRY,
    sort: str = "relevancy",
    page: int = 1,
    limit: int = 20,
    min_price: float | None = None,
    max_price: float | None = None,
) -> dict:
    """Full keyword product search on Shopee with live prices, discounts,
    ratings and sold counts.

    REQUIRES a logged-in session: run `python login.py` once (it opens a
    browser for you to log in and saves the cookies), then this works.
    Shopee blocks headless and raw HTTP requests (anti-bot error 90309999),
    so the search runs in a real Chrome window and reads the results from
    the page itself. Calls are serialized and spaced by at least
    SHOPEE_MIN_INTERVAL_SECONDS (default 10s) between searches — one
    window, one page load, no retries.

    sort: relevancy, sales, newest, price_asc, price_desc.
    min_price / max_price are in the market currency (BRL for country=br).
    """
    try:
        cc = _country(country)
        import anyio
        return await anyio.to_thread.run_sync(
            functools.partial(_search_browser, cc, keyword, sort, page, limit,
                              min_price, max_price))
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}


# ---- products ----------------------------------------------------------------


@mcp.tool()
def products_trending(country: str = DEFAULT_COUNTRY) -> dict:
    """~100 trending products with live prices and ratings for a market."""
    cc = _country(country)
    return _safe(lambda: api.products_trending(country=cc))


@mcp.tool()
def product_details(product: str, country: str = DEFAULT_COUNTRY) -> dict:
    """Full product detail (title, description, images, variations, SKUs,
    attributes, categories, shipping, shop profile) from a product ID
    ('<shop_id>.<item_id>') or any Shopee product URL.

    NOTE: Shopee only serves price, stock, sold count, rating and review
    count to logged-in sessions, so those fields are null here. Live prices
    come from `deals_flash_sale` and `products_trending` instead."""
    cc = _country(country)
    cc, canonical = _resolve_product(product, cc)
    return _safe(lambda: api.product_details(country=cc, product=canonical))


@mcp.tool()
def deals_flash_sale(
    country: str = DEFAULT_COUNTRY,
    session: int | None = None,
    category: int | None = None,
    page: int = 1,
) -> dict:
    """Live flash-sale deals (50 per page) with price, discount, stock and
    units sold. `session`/`category` are optional IDs from the response's
    `sessions` list; omit both for the ongoing session, all categories."""
    cc = _country(country)
    return _safe(lambda: api.deals_flash_sale(
        country=cc, session=session, category=category, page=page))


# ---- shops -------------------------------------------------------------------


@mcp.tool()
def shop_details(shop: str, country: str = DEFAULT_COUNTRY) -> dict:
    """Shop profile: rating breakdown, followers, response rate, vouchers.
    `shop` is a numeric shop id, a username, or any Shopee shop URL."""
    cc = _country(country)
    cc, canonical = _resolve_shop(shop, cc)
    return _safe(lambda: api.shop_details(country=cc, shop=canonical))


@mcp.tool()
def shop_reviews(
    shop: str,
    rating: int = 5,
    page: int = 1,
    country: str = DEFAULT_COUNTRY,
) -> dict:
    """Buyer reviews for a shop, filtered by star rating (5, 4, 3, 2 or 1;
    default 5). 20 per page."""
    cc = _country(country)
    cc, canonical = _resolve_shop(shop, cc)
    return _safe(lambda: api.shop_reviews(
        country=cc, shop=canonical, rating=int(rating), page=page))


@mcp.tool()
def shop_categories(shop: str, page: int = 1, country: str = DEFAULT_COUNTRY) -> dict:
    """A shop's own product categories with item counts (50 per page)."""
    cc = _country(country)
    cc, canonical = _resolve_shop(shop, cc)
    return _safe(lambda: api.shop_categories(country=cc, shop=canonical, page=page))


@mcp.tool()
def shops_official(page: int = 1, country: str = DEFAULT_COUNTRY) -> dict:
    """Every official brand store in a market (20 per page)."""
    cc = _country(country)
    return _safe(lambda: api.shops_official(country=cc, page=page))


# ---- catalog -----------------------------------------------------------------


@mcp.tool()
def categories_list(country: str = DEFAULT_COUNTRY) -> dict:
    """The full Shopee category tree (IDs and links) for a market."""
    cc = _country(country)
    return _safe(lambda: api.categories_list(country=cc))


if __name__ == "__main__":
    mcp.run()
