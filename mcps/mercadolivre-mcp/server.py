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
  return { title, item_id, url, price, old_price: oldPrice, rating: rating ? rating.trim() : null, seller: seller ? seller.trim() : null };
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


if __name__ == "__main__":
    mcp.run()
