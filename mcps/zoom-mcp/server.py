"""MCP server for Zoom (zoom.com.br) — Brazilian price comparator.

Zoom aggregates offers for a product across many stores (KaBuM!, Mercado
Livre, Amazon, Magazine Luiza, Americanas, ...) — the same job Google
Shopping does, but it serves full results server-side (Next.js __NEXT_DATA__),
so it's scrapeable with a plain HTTP client. No API key, no login, no browser.

Run (stdio):  python mcp_server.py
"""

import json
import re

from mcp.server.fastmcp import FastMCP
from curl_cffi import requests as curl_requests

BASE = "https://www.zoom.com.br"

mcp = FastMCP("zoom")

_session_obj = None

_HEADERS = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "user-agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"),
}


def _session():
    global _session_obj
    if _session_obj is None:
        _session_obj = curl_requests.Session(impersonate="chrome")
    return _session_obj


def _next_data(html):
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
    return json.loads(m.group(1)) if m else None


def _product(h):
    merchants = [m.get("name") for m in (h.get("merchants") or []) if m.get("name")]
    return {
        "name": h.get("name") or h.get("shortName"),
        "price": h.get("price"),
        "currency": "BRL",
        "best_store": (h.get("bestOffer") or {}).get("merchantName"),
        "stores": merchants,
        "store_count": h.get("storeCount"),
        "rating": h.get("preciseRating") or h.get("rating"),
        "rating_count": h.get("ratingTotal") or h.get("countOfComments"),
        "discount_percent": h.get("loweringPercentage"),
        "category": h.get("categoryName"),
        "image": h.get("image"),
        "url": BASE + (h.get("url") or ""),
        "badges": h.get("stamps") or [],
    }


@mcp.tool()
def search_products(query: str, page: int = 1) -> dict:
    """Search products on Zoom (price comparator) with the best price and the
    list of stores selling each product. Aggregates KaBuM!, Mercado Livre,
    Amazon, Magazine Luiza, Americanas and others.

    Returns, per product: name, best price (R$), best store, all stores,
    store count, rating and Zoom product URL.
    """
    page = max(1, int(page))
    resp = _session().get(BASE + "/search", params={"q": query, "page": page}, headers=_HEADERS, timeout=40)
    if resp.status_code != 200:
        return {"error": f"Zoom returned HTTP {resp.status_code}"}
    nd = _next_data(resp.text or "")
    if nd is None:
        return {"error": "could not parse Zoom __NEXT_DATA__ (possible anti-bot challenge)"}
    irs = (nd.get("props") or {}).get("initialReduxState") or {}
    hits = irs.get("hits") or {}
    items = hits.get("hits") or []
    pag = hits.get("pagination") or {}
    total = pag.get("nbHits") if isinstance(pag, dict) else None
    return {
        "query": query,
        "page": page,
        "total": total,
        "count": len(items),
        "results": [_product(h) for h in items if isinstance(h, dict)],
    }


if __name__ == "__main__":
    mcp.run()
