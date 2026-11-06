"""One-time Shopee login for the MCP.

Chrome 136+ refuses remote debugging on the default profile, so this uses a
dedicated persistent profile (`.browser-profile`) instead. On first run it
copies the essential files of the user's Chrome profile (Local State and the
cookie database) so an existing Shopee login is inherited; otherwise you just
log in in the window that opens.

The profile is deliberately kept after the run: Shopee trusts a browser that
has completed a login, and `search_products` reuses the same profile. Deleting
it would force a fresh login and trigger the anti-bot wall.

Cookies are also saved to `cookies.json` as a backup, even if you close the
window right after logging in.

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

# Cookies that only exist after a real login. SPC_F alone is set for anonymous
# devices too, so it is not enough.
LOGIN_INDICATORS = {"SPC_EC", "SPC_U", "sessionid"}

TIMEOUT_SECONDS = 10 * 60  # 10 minutes to finish logging in

CHROME_USER_DATA = os.path.join(
    os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
    "Google", "Chrome", "User Data",
)

# Files that carry the Chrome session. Chrome 130+ keeps cookies under
# Default/Network/, older versions under Default/.
PROFILE_FILES = [
    "Local State",
    os.path.join("Default", "Network", "Cookies"),
    os.path.join("Default", "Network", "Cookies-journal"),
    os.path.join("Default", "Cookies"),
    os.path.join("Default", "Cookies-journal"),
    os.path.join("Default", "Preferences"),
    os.path.join("Default", "Secure Preferences"),
]


def _cookies_to_header(cookies):
    return "; ".join(f"{c['name']}={c['value']}" for c in cookies if c.get("name"))


def _logged_in(names):
    return bool(LOGIN_INDICATORS & set(names))


def _save(cookies):
    cookies = cookies or []
    names = sorted({c["name"] for c in cookies})
    data = {
        "captured_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cookie_header": _cookies_to_header(cookies),
        "cookies": cookies,
        "logged_in": _logged_in(names),
    }
    with open(COOKIE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"OK: {len(cookies)} cookies salvos em {COOKIE_FILE}")
    print(f"Login detectado: {'SIM' if _logged_in(names) else 'NAO CONFIRMADO'}")


def _profile_ready():
    return (os.path.exists(os.path.join(PROFILE_DIR, "Default", "Network", "Cookies"))
            or os.path.exists(os.path.join(PROFILE_DIR, "Default", "Cookies")))


def _seed_profile():
    """Copy the small set of files that carry the Chrome session."""
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
            pass  # locked (Chrome open) or unreadable, skip
    return copied


async def main():
    from patchright.async_api import async_playwright

    print("== Shopee login helper ==")

    if not _profile_ready():
        if os.path.exists(CHROME_USER_DATA):
            print(f"Herdando a sessao do Chrome: {CHROME_USER_DATA}")
            copied = _seed_profile()
            print(f"Arquivos copiados: {len(copied)}")
            if not _profile_ready():
                print()
                print("ATENCAO: nao consegui copiar o banco de cookies do Chrome.")
                print("O Chrome parece estar aberto e travando o arquivo.")
                print("Feche TODAS as janelas do Chrome e rode de novo se quiser")
                print("herdar a sessao — ou apenas faca login na janela a seguir.")
        os.makedirs(PROFILE_DIR, exist_ok=True)

    last_cookies = []

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

        print("Abrindo a Shopee...")
        try:
            await page.goto("https://shopee.com.br", timeout=60000,
                            wait_until="domcontentloaded")
        except Exception as e:
            print(f"Aviso ao navegar: {type(e).__name__}: {e}")

        print("Faca login na janela (QR, e-mail/senha ou Facebook).")
        print("Pode fechar a janela quando terminar: os cookies sao salvos de qualquer forma.")
        print("Aguardando o login...")

        start = time.time()
        try:
            while time.time() - start < TIMEOUT_SECONDS:
                await page.wait_for_timeout(2000)
                last_cookies = await ctx.cookies()
                if _logged_in({c["name"] for c in last_cookies}):
                    print("Login detectado! Deixando a pagina terminar de carregar...")
                    await page.wait_for_timeout(6000)
                    last_cookies = await ctx.cookies()
                    break
        except Exception as e:
            print(f"Aviso: janela fechada ({type(e).__name__}). "
                  "Salvando os ultimos cookies vistos...")

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
    print("(nao apague essa pasta: e o navegador confiavel que o MCP usa nas buscas)")


if __name__ == "__main__":
    asyncio.run(main())
