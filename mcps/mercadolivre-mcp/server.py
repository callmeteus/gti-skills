"""MCP server for Mercado Livre (mercadolivre.com.br).

Mercado Livre serves search results only to a real browser (bot detection
shows a "login to continue" wall to plain HTTP clients). This server drives a
real Chrome via Patchright to run the search and extract product cards.

No API key, no login (logged-out search works in a real browser).

Run (stdio):  python mcp_server.py
"""

import asyncio
import os

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("mercadolivre")

# Mercado Livre detects headless Chrome (serves an empty page); a visible
# browser window is required. Set ML_HEADLESS=1 to force headless anyway.
_HEADLESS = os.environ.get("ML_HEADLESS", "0") == "1"

_playwright = None
_browser = None
_page = None

_EXTRACT_JS = r"""
(items) => items.map(el => {
  const a = el.querySelector('h3.poly-component__title-wrapper a, a.poly-component__title');
  const img = el.querySelector('img.poly-component__picture');
  const title = ((a && a.textContent) || (img && img.alt) || '').trim();
  const href = a ? a.href : '';
  let url = href;
  let item_id = null;
  const m = href.match(/item_id(?:%3A|:)(ML[AB]\d+)/i);
  if (m) { item_id = m[1]; url = 'https://www.mercadolivre.com.br/p/' + m[1]; }
  const frac = el.querySelector('.andes-money-amount__fraction');
  const cents = el.querySelector('.andes-money-amount__cents');
  let price = null;
  if (frac) {
    const f = frac.textContent.replace(/\./g, '').replace(/\D/g, '');
    const c = cents ? cents.textContent.trim().replace(/\D/g, '') : '';
    price = c ? parseFloat(f + '.' + c) : parseInt(f || '0', 10);
  }
  const prev = el.querySelector('.andes-money-amount--previous .andes-money-amount__fraction');
  let oldPrice = null;
  if (prev) {
    const f = prev.textContent.replace(/\./g, '').replace(/\D/g, '');
    const pc = el.querySelector('.andes-money-amount--previous .andes-money-amount__cents');
    const cc = pc ? pc.textContent.trim().replace(/\D/g, '') : '';
    oldPrice = cc ? parseFloat(f + '.' + cc) : parseInt(f || '0', 10);
  }
  const rating = (el.querySelector('.poly-component__review-compacted .polylabel-label') || {}).textContent || null;
  const seller = (el.querySelector('.poly-component__seller') || {}).textContent || null;
  const shipEl = el.querySelector('.poly-component__shipping-v2, .poly-component__shipping');
  const shipping = shipEl ? shipEl.textContent.trim().replace(/\\s+/g, ' ') : null;
  return { title, item_id, url, price, old_price: oldPrice, rating: rating ? rating.trim() : null, seller: seller ? seller.trim() : null, shipping };
})
"""


async def _get_page():
    global _playwright, _browser, _page
    if _page is None:
        from patchright.async_api import async_playwright
        _playwright = await async_playwright().start()
        _browser = await _playwright.chromium.launch(channel="chrome", headless=_HEADLESS)
        ctx = await _browser.new_context(
            locale="pt-BR", timezone_id="America/Sao_Paulo",
            viewport={"width": 1366, "height": 900},
        )
        _page = await ctx.new_page()
    return _page


def _slug(query):
    import re
    s = query.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "busca"


@mcp.tool()
async def search_products(query: str, limit: int = 20) -> dict:
    """Keyword search on Mercado Livre (Brasil) with price, old price,
    rating, review count and product link. Logged-out — no key, no login.

    Note: runs a real browser, so each search takes a few seconds.
    """
    page = await _get_page()
    slug = _slug(query)
    url = f"https://lista.mercadolivre.com.br/{slug}"
    try:
        await page.goto(url, timeout=60000, wait_until="domcontentloaded")
    except Exception as e:
        return {"error": f"navigation failed: {type(e).__name__}: {e}"}

    # wait for results, with tolerance for the login wall / empty state
    try:
        await page.wait_for_selector("li.ui-search-layout__item", timeout=25000)
    except Exception:
        pass

    items = await page.query_selector_all("li.ui-search-layout__item")
    if not items:
        body = (await page.inner_text("body"))[:300].replace("\n", " ")
        return {"query": query, "count": 0, "results": [], "note": body}

    results = await page.evaluate(_EXTRACT_JS, items)
    results = results[: max(1, min(limit, len(results)))]
    return {
        "query": query,
        "url": url,
        "count": len(results),
        "results": results,
    }


@mcp.tool()
async def shipping_options(item_id: str, cep: str) -> dict:
    """Quote shipping (frete) options for a Mercado Livre item to a Brazilian
    CEP. `item_id` is the MLB... id returned by search_products. Returns
    delivery options with cost (BRL), method and estimated delivery date.
    Ask the user for their CEP if not provided."""
    digits = "".join(c for c in str(cep) if c.isdigit())
    if len(digits) != 8:
        return {"error": "CEP must have 8 digits"}
    iid = str(item_id).strip()
    if not iid.upper().startswith("MLB"):
        return {"error": "item_id must be an MLB... id from search_products"}
    url = f"https://api.mercadolibre.com/items/{iid}/shipping_options?zip_code={digits}"
    import httpx
    try:
        async with httpx.AsyncClient(timeout=40) as client:
            resp = await client.get(url)
    except Exception as e:
        return {"error": f"request failed: {type(e).__name__}: {e}"}
    if resp.status_code != 200:
        return {"error": f"Mercado Livre API returned HTTP {resp.status_code}: {resp.text[:300]}"}
    try:
        data = resp.json()
    except Exception:
        return {"error": "non-JSON response from Mercado Livre API"}
    options = []
    for o in (data.get("options") or []):
        edt = o.get("estimated_delivery_time") or {}
        options.append({
            "id": o.get("id"),
            "shipping_method_type": o.get("shipping_method_type"),
            "shipping_option_type": o.get("shipping_option_type"),
            "cost": o.get("cost"),
            "base_cost": o.get("base_cost"),
            "list_cost": o.get("list_cost"),
            "currency": o.get("currency_id"),
            "display": o.get("display"),
            "estimated_delivery_date": edt.get("date"),
            "shipping_hours": edt.get("shipping"),
            "handling_hours": edt.get("handling"),
        })
    return {
        "item_id": iid,
        "cep": digits,
        "destination": data.get("destination"),
        "options": options,
    }


@mcp.tool()
async def list_orders() -> dict:
    """List the logged-in user's Mercado Livre purchases with shipping status.

    Requires a logged-in session: run `python login.py` first. Uses a real
    browser and the saved profile. Returns the purchases page text and any
    detected order/pack ids and shipping statuses.
    """
    import os
    profile = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".browser-profile")
    if not os.path.exists(profile):
        return {"error": "not logged in: run `python login.py` first"}
    from patchright.async_api import async_playwright
    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(
            user_data_dir=profile, channel="chrome", headless=_HEADLESS,
            locale="pt-BR", timezone_id="America/Sao_Paulo",
            viewport={"width": 1366, "height": 900},
        )
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        try:
            await page.goto("https://myaccount.mercadolivre.com.br/my_purchases/list",
                            timeout=60000, wait_until="domcontentloaded")
            await page.wait_for_timeout(10000)
            url = page.url
            text = (await page.inner_text("body"))[:4000]
        except Exception as e:
            await ctx.close()
            return {"error": f"navigation failed: {type(e).__name__}: {e}"}
        await ctx.close()
    if "login" in url.lower() or "identification" in url.lower():
        return {"error": "not logged in: run `python login.py` first", "url": url}
    return {"url": url, "text": text}


if __name__ == "__main__":
    mcp.run()
