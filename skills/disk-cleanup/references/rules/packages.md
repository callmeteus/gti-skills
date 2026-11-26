# Packages installed many times

The `packages` category finds tools that keep a full copy per version or per project when one shared copy would do. It runs inside the data walk, so it sees the projects found on the chosen drives.

```bash
python3 <skill-dir>/scripts/disk_cleanup.py scan --categories packages
```

## What is found

| Finding | Level | Action | What stays |
|---------|-------|--------|------------|
| Playwright browser revisions no install uses | safe | delete | Every revision listed in the `browsers.json` of an install in the cache's `.links` folder, or of a `playwright-core` in a scanned project. This is the rule `npx playwright install` applies itself |
| Playwright revisions when the cache has no `.links` | aggressive | delete | The newest revision of each browser and every revision a project references |
| Old Puppeteer browser builds | aggressive | delete | The newest build of each browser (chrome, chrome-headless-shell, firefox) and every build a project's `puppeteer-core` `revisions.js` names |
| Old Cypress binaries | aggressive | delete | The newest version and every version a project's `node_modules/cypress` has |
| Browsers bundled inside a project's `node_modules` | aggressive | report | Nothing is deleted. Puppeteer before 19 and `PLAYWRIGHT_BROWSERS_PATH=0` download a browser per project; upgrading or unsetting it keeps one shared copy |
| Global npm packages installed in several Node versions | aggressive | report | nvm, nvm-windows, and fnm keep global packages per Node version (pm2 in five versions is five copies) |
| Node.js versions | yolo | command, never automatic | The current version (`node -v`), the newest installed, the newest match of the nvm default alias, and the newest match of every `.nvmrc` or `.node-version` in a scanned project |
| Heavy packages copied into several projects or virtual environments (electron, esbuild, typescript, sharp, prisma engines, torch, tensorflow, nvidia) | aggressive | report | Nothing is deleted. Copies hardlinked by pnpm, Bun, or uv cost nothing and are not counted |

## Where the shared caches are

| Tool | Linux | macOS | Windows | Override |
|------|-------|-------|---------|----------|
| Playwright | `~/.cache/ms-playwright` | `~/Library/Caches/ms-playwright` | `%LOCALAPPDATA%\ms-playwright` | `PLAYWRIGHT_BROWSERS_PATH` |
| Puppeteer 19+ | `~/.cache/puppeteer` | `~/.cache/puppeteer` | `%USERPROFILE%\.cache\puppeteer` | `PUPPETEER_CACHE_DIR` |
| Cypress | `~/.cache/Cypress` | `~/Library/Caches/Cypress` | `%LOCALAPPDATA%\Cypress\Cache` | `CYPRESS_CACHE_FOLDER` |
| nvm | `~/.nvm/versions/node` | `~/.nvm/versions/node` | `%NVM_HOME%` (nvm-windows) | `NVM_DIR` |

These caches are never emptied as a whole: the packages scan keeps every version still in use.

## How to keep one copy

- **Node projects:** pnpm (or Bun) stores each file once and links it into every project; switching an npm or Yarn project is `pnpm import` then `pnpm install`.
- **Python environments:** uv links packages from one cache into every environment (`uv venv`, `uv pip install`).
- **Global CLIs:** install them with `pnpm add -g` or Volta, which are not tied to one Node version, or keep few Node versions.
- **Browsers:** let Puppeteer and Playwright use their shared cache; do not set `PLAYWRIGHT_BROWSERS_PATH=0` or `PUPPETEER_DOWNLOAD_PATH` per project.

Removing an old Node version runs `nvm uninstall <version>`; ask the user first, it is never automatic.
