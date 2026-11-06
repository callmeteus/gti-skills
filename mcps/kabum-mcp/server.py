"""MCP server for KaBuM! (kabum.com.br) — Brazil's PC hardware & electronics store.

Wraps KaBuM!'s public catalog API (servicespub.prod.api.aws.grupokabum.com.br),
which serves the same product data the site shows to every visitor — no API
key, no login, no browser. Prices are in BRL.

Run (stdio):  python mcp_server.py
"""

from mcp.server.fastmcp import FastMCP
from curl_cffi import requests as curl_requests

BASE = "https://servicespub.prod.api.aws.grupokabum.com.br"
SITE = "https://www.kabum.com.br"

mcp = FastMCP("kabum")

_session_obj = None

_SORT = {
    "most_searched": "most_searched",   # mais relevantes
    "lowest_price": "lowest_price",     # menor preco
    "biggest_price": "biggest_price",   # maior preco
    "best_rated": "best_rated",         # mais bem avaliados
    "most_recent": "most_recent",       # mais recentes
    "biggest_discount": "biggest_discount",  # maior desconto
}

_HEADERS = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "user-agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"),
    "origin": SITE,
    "referer": SITE + "/",
}


def _session():
    global _session_obj
    if _session_obj is None:
        _session_obj = curl_requests.Session(impersonate="chrome")
    return _session_obj


def _get(path, params=None):
    resp = _session().get(BASE + path, params=params, headers=_HEADERS, timeout=40)
    if resp.status_code != 200:
        return {"error": f"KaBuM! API returned HTTP {resp.status_code}"}
    try:
        return resp.json()
    except Exception:
        return {"error": "non-JSON response from KaBuM! API"}


def _product(item):
    a = item.get("attributes") or {}
    pid = item.get("id")
    slug = a.get("product_link") or ""
    url = f"{SITE}/produto/{pid}/{slug}" if slug else f"{SITE}/produto/{pid}"
    return {
        "id": pid,
        "name": a.get("title"),
        "price": a.get("price"),
        "price_with_discount": a.get("price_with_discount"),
        "old_price": a.get("old_price"),
        "discount_percentage": a.get("discount_percentage"),
        "available": a.get("available"),
        "stock": a.get("stock"),
        "rating": a.get("average_of_ratings"),
        "rating_count": a.get("number_of_ratings"),
        "manufacturer": (a.get("manufacturer") or {}).get("name"),
        "image": (a.get("images") or [None])[0],
        "images": a.get("images") or [],
        "category": a.get("menu"),
        "max_installment": a.get("max_installment"),
        "is_marketplace": a.get("is_marketplace"),
        "has_free_shipping": a.get("has_free_shipping"),
        "warranty": a.get("warranty"),
        "url": url,
    }


@mcp.tool()
def search_products(
    query: str,
    page: int = 1,
    page_size: int = 20,
    sort: str = "most_searched",
) -> dict:
    """Keyword search on KaBuM! with live prices (BRL), Pix/discount price,
    stock, rating and product links.

    sort: most_searched, lowest_price, biggest_price, best_rated,
          most_recent, biggest_discount.
    """
    sort_val = _SORT.get(sort, "most_searched")
    page = max(1, int(page))
    page_size = min(max(1, int(page_size)), 60)
    data = _get("/catalog/v2/products", {
        "query": query, "page_number": page, "page_size": page_size,
        "facet_filters": "", "sort": sort_val, "variant": "catalog",
    })
    if isinstance(data, dict) and "error" in data:
        return data
    meta = data.get("meta") or {}
    items = data.get("data") or []
    return {
        "query": query,
        "sort": sort,
        "page": meta.get("page", {}).get("number", page),
        "page_size": meta.get("page", {}).get("size", page_size),
        "total": meta.get("total_items_count"),
        "total_pages": meta.get("total_pages_count"),
        "count": len(items),
        "results": [_product(it) for it in items],
    }


@mcp.tool()
def product_details(product_id: str) -> dict:
    """Full detail for one KaBuM! product by its numeric id (the number in a
    kabum.com.br/produto/<id>/... URL)."""
    data = _get(f"/catalog/v2/products/{product_id}")
    if isinstance(data, dict) and "error" in data:
        return data
    # single-product responses are the JSON:API resource directly
    if isinstance(data, dict) and "attributes" in data:
        return {"result": _product(data)}
    if isinstance(data, dict) and "data" in data:
        inner = data["data"]
        if isinstance(inner, list) and inner:
            return {"result": _product(inner[0])}
        if isinstance(inner, dict):
            return {"result": _product(inner)}
    return {"error": f"could not parse product {product_id}"}


def _session_token() -> str | None:
    data = _get("/lg/v1/session/new-token")
    if isinstance(data, dict):
        return data.get("session")
    return None


@mcp.tool()
def zip_lookup(cep: str) -> dict:
    """Resolve a Brazilian CEP (postal code) to its address via KaBuM!'s
    shipping service. Useful to confirm a CEP before quoting freight."""
    digits = "".join(c for c in str(cep) if c.isdigit())
    if len(digits) != 8:
        return {"error": "CEP must have 8 digits"}
    data = _get(f"/shipping/v1/zip-query?zip_code={digits}")
    return data


@mcp.tool()
def shipping_quote(product_id: str, cep: str, quantity: int = 1) -> dict:
    """Quote shipping (frete) options and prices for a KaBuM! product to a
    Brazilian CEP. Returns delivery options with price (BRL), deadline in days
    and estimated arrival date. Ask the user for their CEP if not provided."""
    digits = "".join(c for c in str(cep) if c.isdigit())
    if len(digits) != 8:
        return {"error": "CEP must have 8 digits"}
    try:
        pid = int(product_id)
    except (TypeError, ValueError):
        return {"error": "product_id must be numeric"}
    qty = max(1, int(quantity))
    token = _session_token()
    if not token:
        return {"error": "could not obtain KaBuM! session token"}
    body = {
        "zip_code": digits,
        "sellers": [{"seller_name": "KaBuM!", "seller_id": "0",
                     "products": [{"code": pid, "quantity": qty, "offer_id": 0}]}],
        "client": {"id": "", "session": token, "type": "F", "is_prime": False},
        "store": 5,
        "origin": "product",
    }
    resp = _session().post(BASE + "/shipping/v4/quotation", json=body,
                          headers=_HEADERS, timeout=40)
    if resp.status_code != 200:
        return {"error": f"KaBuM! shipping API returned HTTP {resp.status_code}"}
    try:
        data = resp.json()
    except Exception:
        return {"error": "non-JSON response from KaBuM! shipping API"}
    out = {"cep": digits, "product_id": pid, "quantity": qty, "quotes": []}
    for q in (data.get("quotes") or []):
        deliveries = []
        for d in (q.get("deliveries") or []):
            deliveries.append({
                "name": d.get("name"),
                "type": d.get("type"),
                "price": d.get("price"),
                "original_price": d.get("original_price"),
                "max_days": d.get("max_days"),
                "arrival_date": d.get("arrival_date")
                    or d.get("expected_arrival_date"),
            })
        out["quotes"].append({
            "seller": q.get("seller_name"),
            "deliveries": deliveries,
        })
    return out


if __name__ == "__main__":
    mcp.run()
