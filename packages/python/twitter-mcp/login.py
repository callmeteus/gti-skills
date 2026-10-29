"""Open a visible browser on the MCP profile so you can log in to X once.

Run it while no MCP server is running: two browsers cannot share the profile folder.
"""

import asyncio

from browser_session import PROFILE_DIR, close_session, get_persistent_context


async def main():
    pw, context = await get_persistent_context(headless=False)
    page = context.pages[0] if context.pages else await context.new_page()
    await page.goto("https://x.com/login")
    print(f"Browser opened on profile {PROFILE_DIR}. Log in to X in that window.")
    print("After logging in, press Enter here to save the session and close the browser.")
    await asyncio.to_thread(input)
    await close_session(pw, context)
    print("Session saved.")


if __name__ == "__main__":
    asyncio.run(main())
