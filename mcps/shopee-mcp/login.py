"""One-time Shopee login + cookie capture.

Opens a real Chrome (headed) on shopee.com.br, waits for you to log in
(QR code or email/password), then saves every cookie to `cookies.json` so
the `search_products` MCP tool can use them to cross Shopee's login-gated
search.

Run:  python login.py
"""

import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
COOKIE_FILE = os.path.join(_SCRIPT_DIR, "cookies.json")

# Cookie names that only appear once you are actually logged in.
LOGIN_INDICATORS = {"sessionid", "SPC_EC"}

TIMEOUT_SECONDS = 10 * 60  # 10 minutes to finish logging in


def _cookies_to_header(cookies):
    return "; ".join(f"{c['name']}={c['value']}" for c in cookies if c.get("name"))


async def _is_logged_in(ctx):
    cookies = await ctx.cookies()
    names = {c["name"] for c in cookies}
    if LOGIN_INDICATORS & names:
        return True, cookies
    return False, cookies


async def main():
    from patchright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome", headless=False)
        ctx = await browser.new_context(
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
            viewport={"width": 1366, "height": 900},
        )
        page = await ctx.new_page()
        await page.goto("https://shopee.com.br", timeout=60000, wait_until="domcontentloaded")

        print("== Shopee login helper ==")
        print("Uma janela do Chrome abriu. Faca login na Shopee (QR ou e-mail/senha).")
        print("O script detecta o login automaticamente e salva os cookies. Aguarde...")

        start = time.time()
        cookies = []
        while time.time() - start < TIMEOUT_SECONDS:
            await page.wait_for_timeout(3000)
            logged, cookies = await _is_logged_in(ctx)
            if logged:
                break

        if not cookies:
            print("ERRO: nenhum cookie capturado. Tente novamente e conclua o login.")
            await browser.close()
            sys.exit(1)

        # extra settle time so the session cookies are fully written
        await page.wait_for_timeout(3000)
        cookies = await ctx.cookies()

        data = {
            "captured_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "cookie_header": _cookies_to_header(cookies),
            "cookies": cookies,
        }
        with open(COOKIE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        names = sorted(c["name"] for c in cookies)
        logged = bool(LOGIN_INDICATORS & set(names))
        print(f"OK: {len(cookies)} cookies salvos em {COOKIE_FILE}")
        print(f"Login detectado: {'SIM' if logged else 'NAO CONFIRMADO (verifique)'}")
        print("Cookies:", ", ".join(names))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
