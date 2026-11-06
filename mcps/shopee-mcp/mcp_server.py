"""MCP wrapper for omkarcloud/shopee-scraper.

Exposes the scraper's 10 Shopee endpoints as MCP tools, with Brazil (`br`)
as the default market. No API key — it uses the scraper's curl_cffi TLS
impersonation to talk to Shopee directly.

Run (stdio):  python mcp_server.py
"""

import json
import os
import sys

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
# Shopee's /api/v4/search/search_items is behind the 90309999 "Login
# Required" gate for logged-out visitors (verified 2026-11). We cross it with
# cookies captured by login.py from the user's logged-in browser session.

COOKIE_FILE = os.path.join(_SCRIPT_DIR, "cookies.json")
_search_session_obj = None

_SEARCH_SORT = {
    "relevancy": ("relevancy", "desc"),
    "sales": ("sales", "desc"),
    "newest": ("ctime", "desc"),
    "price_asc": ("price", "asc"),
    "price_desc": ("price", "desc"),
}


def _load_cookie_header():
    if not os.path.exists(COOKIE_FILE):
        return None
    try:
        with open(COOKIE_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return data.get("cookie_header") or None
    except Exception:
        return None


def _search_session():
    global _search_session_obj
    if _search_session_obj is None:
        from curl_cffi import requests as curl_requests
        _search_session_obj = curl_requests.Session(impersonate="chrome")
    return _search_session_obj


def _parse_search_items(payload, country):
    """Shopee search_items payload -> list of clean product rows."""
    data = (payload or {}).get("data") or {}
    rows = []
    for it in data.get("items") or []:
        if not isinstance(it, dict):
            continue
        b = it.get("item_basic") or it
        if not isinstance(b, dict) or not b.get("itemid"):
            continue
        shop_id, item_id = b.get("shopid"), b.get("itemid")
        rating = b.get("item_rating") or {}
        rows.append({
            "id": item_id,
            "shop_id": shop_id,
            "name": parsers.text(b.get("name")),
            "link": refs.product_link(country, shop_id, item_id),
            "image": parsers.image(country, b.get("image")),
            "images": parsers.images(country, b.get("images")),
            "currency": refs.CURRENCY_OF[country],
            "price": parsers.money(b.get("price")),
            "price_min": parsers.money(b.get("price_min")),
            "price_max": parsers.money(b.get("price_max")),
            "price_before_discount": parsers.money(b.get("price_before_discount")),
            "discount_percent": parsers.number(b.get("show_discount")) or None,
            "sold_count": parsers.number(b.get("historical_sold")),
            "stock": parsers.number(b.get("stock")),
            "rating": parsers.rating_block(rating),
            "likes_count": parsers.number(b.get("liked_count")),
            "shop_location": parsers.text(b.get("shop_location")),
            "is_shopee_verified": parsers.flag(b.get("shopee_verified")),
            "is_official_shop": parsers.flag(b.get("is_official_shop")),
            "is_adult": parsers.flag(b.get("is_adult")),
            "listed_at": parsers.ts(b.get("ctime")),
        })
    total = data.get("total_count") or data.get("total")
    return rows, total


def _search_request(country, keyword, sort, page, limit, min_price, max_price):
    cookie_header = _load_cookie_header()
    if not cookie_header:
        return {
            "error": "Shopee keyword search requires login. Run `python login.py` "
                     "in the shopee-scraper folder once, log in, then retry."
        }
    if sort not in _SEARCH_SORT:
        return {"error": f"sort must be one of {', '.join(_SEARCH_SORT)}"}
    by, order = _SEARCH_SORT[sort]
    params = {
        "by": by, "keyword": keyword, "limit": limit,
        "newest": (page - 1) * limit, "order": order,
        "page_type": "search", "scenario": "PAGE_GLOBAL_SEARCH", "version": 2,
    }
    if min_price is not None:
        params["price_min"] = int(min_price * 100000)
    if max_price is not None:
        params["price_max"] = int(max_price * 100000)
    headers = {
        "accept": "application/json",
        "x-api-source": "pc",
        "x-requested-with": "XMLHttpRequest",
        "x-shopee-language": "en",
        "accept-language": refs.ACCEPT_LANGUAGE_OF[country],
        "referer": refs.search_link(country, keyword),
        "Cookie": cookie_header,
    }
    try:
        resp = _search_session().get(
            refs.site(country) + "/api/v4/search/search_items",
            params=params, headers=headers, timeout=40)
    except Exception as e:
        return {"error": f"request failed: {type(e).__name__}: {e}"}
    if resp.status_code in (401, 403, 418, 429):
        return {"error": f"Shopee search blocked (HTTP {resp.status_code}). "
                         "Cookies may have expired — run login.py again."}
    try:
        payload = resp.json()
    except Exception:
        return {"error": f"non-JSON search response (HTTP {resp.status_code})"}
    err = payload.get("error")
    if err == 90309999 or payload.get("redirect_to_error_page"):
        return {"error": "Shopee search requires login (error 90309999). "
                         "Cookies missing or expired — run login.py again."}
    if err not in (None, 0, ""):
        return {"error": f"upstream error {err}: {payload.get('error_msg') or ''}".strip()}
    rows, total = _parse_search_items(payload, country)
    return {
        "country": country,
        "currency": refs.CURRENCY_OF[country],
        "query": keyword,
        "sort": sort,
        "page": page,
        "total": total,
        "count": len(rows),
        "results": rows,
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
def search_products(
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

    sort: relevancy, sales, newest, price_asc, price_desc.
    min_price / max_price are in the market currency (BRL for country=br).
    """
    return _safe(lambda: _search_request(
        _country(country), keyword, sort, page, limit, min_price, max_price))


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
