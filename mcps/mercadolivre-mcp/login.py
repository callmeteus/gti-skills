"""One-time Mercado Livre login for the MCP.

Opens a real Chrome with a persistent profile. Log in in the window that
opens; the script keeps the browser open for up to 10 minutes and saves
the session automatically when login is detected.

Run:  python login.py
"""
import asyncio
import json
import os
import shutil
import sys
import time
from datetime import datetime, timezone

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
COOKIE_FILE = os.path.join(_SCRIPT_DIR, "cookies.json")
PROFILE_DIR = os.path.join(_SCRIPT_DIR, ".browser-profile")

CHROME_USER_DATA = os.path.join(
    os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
    "Google", "Chrome", "User Data",
)

PROFILE_FILES = [
    "Local State",
    os.path.join("Default", "Network", "Cookies"),
    os.path.join("Default", "Network", "Cookies-journal"),
    os.path.join("Default", "Cookies"),
    os.path.join("Default", "Cookies-journal"),
    os.path.join("Default", "Preferences"),
    os.path.join("Default", "Secure Preferences"),
]

TIMEOUT_SECONDS = 10 * 60


def _cookies_to_header(cookies):
    return "; ".join(f"{c['name']}={c['value']}" for c in cookies if c.get("name"))


def _save(cookies):
    cookies = cookies or []
    data = {
        "captured_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cookie_header": _cookies_to_header(cookies),
        "cookies": cookies,
    }
    with open(COOKIE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\nOK: {len(cookies)} cookies salvos em {COOKIE_FILE}")


def _profile_ready():
    return (os.path.exists(os.path.join(PROFILE_DIR, "Default", "Network", "Cookies"))
            or os.path.exists(os.path.join(PROFILE_DIR, "Default", "Cookies")))


def _seed_profile():
    copied = []
    for rel in PROFILE_FILES:
        src = os.path.join(CHROME_USER_DATA, rel)
        if not os.path.exists(src):
            continue
        dst = os.path.join(PROFILE_DIR, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        try:
            shutil.copy2(src, dst)
            copied.append(rel)
        except OSError:
            pass
    return copied


async def _is_logged_in(page):
    try:
        url = page.url
        txt = await page.inner_text("body")
    except Exception:
        return False
    # Must NOT be on login/identification/challenge page
    if "login" in url or "identification" in url or "challenge" in url:
        return False
    # Check for strong logged-in markers (user menu, account name)
    strong_markers = ["Sair", "Minha conta", "Meu perfil"]
    # Also check the navigation header for the user's name
    if any(m in txt for m in strong_markers):
        return True
    return False


async def main():
    from patchright.async_api import async_playwright

    print("== Mercado Livre login helper ==")

    if not _profile_ready():
        if os.path.exists(CHROME_USER_DATA):
            print(f"Herdando a sessao do Chrome: {CHROME_USER_DATA}")
            copied = _seed_profile()
            print(f"Arquivos copiados: {len(copied)}")
        os.makedirs(PROFILE_DIR, exist_ok=True)

    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            channel="chrome",
            headless=False,
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
            viewport={"width": 1366, "height": 900},
        )
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()

        print("Abrindo o Mercado Livre...")
        try:
            await page.goto("https://www.mercadolivre.com.br", timeout=60000,
                            wait_until="domcontentloaded")
        except Exception as e:
            print(f"Aviso ao navegar: {type(e).__name__}: {e}")

        print()
        print(">>> Faca login na janela do Chrome.")
        print(">>> O script detecta o login automaticamente (ate 10 min).")
        print(">>> NAO feche a janela antes de ver 'Login detectado!'.")
        print()

        start = time.time()
        last_cookies = []
        while time.time() - start < TIMEOUT_SECONDS:
            await page.wait_for_timeout(3000)
            if await _is_logged_in(page):
                print("\nLogin detectado! Salvando...")
                await page.wait_for_timeout(5000)
                last_cookies = await ctx.cookies()
                break
            elapsed = int(time.time() - start)
            print(f"  aguardando login... ({elapsed}s)   ", end="\r")

        try:
            last_cookies = await ctx.cookies() or last_cookies
            await ctx.close()
        except Exception:
            pass

    if not last_cookies:
        print("ERRO: nenhum cookie capturado. Rode de novo e conclua o login.")
        sys.exit(1)

    _save(last_cookies)
    print()
    print("Perfil salvo em:", PROFILE_DIR)


if __name__ == "__main__":
    asyncio.run(main())
EOF