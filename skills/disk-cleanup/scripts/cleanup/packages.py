"""Packages installed many times over: browser builds that Playwright, Puppeteer, and Cypress download once per
version into a shared cache and never remove, global CLIs installed again in every Node version, and heavy
packages copied into every project or virtual environment instead of shared."""

from __future__ import annotations

import glob
import json
import os
import re
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from cleanup import fsutil
from cleanup.model import COMMAND, DELETE, REPORT, Finding, human

MB = 1024 * 1024
COPY_MIN = 200 * MB  # copies of one package worth reporting

# Heavy npm packages that end up copied into many projects with npm or Yarn (pnpm and Bun link them instead).
HEAVY_NODE_PACKAGES = (
    "electron", "puppeteer", "puppeteer-core", "playwright-core", "@playwright/test", "typescript", "@swc/core",
    "@next/swc-linux-x64-gnu", "@next/swc-linux-x64-musl", "@next/swc-darwin-arm64", "@next/swc-win32-x64-msvc",
    "esbuild", "@esbuild", "sharp", "@img", "prisma", "@prisma/engines", "canvas", "onnxruntime-node",
    "@tensorflow/tfjs-node", "@sentry/cli", "cypress", "@biomejs", "@rollup", "@napi-rs",
)
# Heavy Python packages copied into every virtual environment (uv links them from its cache instead).
HEAVY_PYTHON_PACKAGES = ("torch", "tensorflow", "jaxlib", "nvidia", "triton", "cupy", "onnxruntime", "xformers",
                         "transformers", "scipy", "pandas", "opencv_python", "cv2", "llvmlite", "pyarrow")


def version_key(text):
    """'v26.1.0' -> [26, 1, 0]; 'linux-131.0.6778.85' -> [131, 0, 6778, 85]. Letters and prefixes are ignored."""
    return [int(n) for n in re.findall(r"\d+", str(text))]


def single_link_size(path):
    """Bytes freed by deleting `path`: files hardlinked from a shared store (pnpm, Bun, uv) stay on disk."""
    total = 0
    stack = [str(path)]
    while stack:
        current = stack.pop()
        try:
            entries = list(os.scandir(current))
        except OSError:
            continue
        for entry in entries:
            st = fsutil.lstat(entry.path)
            if st is None or fsutil.is_link(st):
                continue
            if entry.is_dir(follow_symlinks=False):
                stack.append(entry.path)
            elif getattr(st, "st_nlink", 1) <= 1:
                total += fsutil.allocated(st)
    return total


# Cache locations ------------------------------------------------------------------------------------

def playwright_cache(platform_name, home):
    if os.environ.get("PLAYWRIGHT_BROWSERS_PATH") not in (None, "", "0"):
        return Path(os.environ["PLAYWRIGHT_BROWSERS_PATH"])
    if platform_name == "windows":
        return Path(os.environ.get("LOCALAPPDATA", home / "AppData/Local")) / "ms-playwright"
    if platform_name == "macos":
        return home / "Library/Caches/ms-playwright"
    return Path(os.environ.get("XDG_CACHE_HOME", home / ".cache")) / "ms-playwright"


def puppeteer_cache(home):
    return Path(os.environ.get("PUPPETEER_CACHE_DIR") or home / ".cache/puppeteer")


def cypress_cache(platform_name, home):
    if os.environ.get("CYPRESS_CACHE_FOLDER"):
        return Path(os.environ["CYPRESS_CACHE_FOLDER"])
    if platform_name == "windows":
        return Path(os.environ.get("LOCALAPPDATA", home / "AppData/Local")) / "Cypress/Cache"
    if platform_name == "macos":
        return home / "Library/Caches/Cypress"
    return home / ".cache/Cypress"


def nvm_versions(platform_name, home):
    """Node versions installed by nvm, nvm-windows, fnm, or Volta: [(version, folder, global node_modules)]."""
    found = []
    if platform_name == "windows":
        roots = [os.environ.get("NVM_HOME"), str(Path(os.environ.get("APPDATA", "")) / "nvm"), "C:\\nvm4w"]
        for root in filter(None, roots):
            for folder in glob.glob(os.path.join(root, "v*")):
                found.append((os.path.basename(folder), folder, os.path.join(folder, "node_modules")))
    else:
        nvm_dir = os.environ.get("NVM_DIR") or str(home / ".nvm")
        for folder in glob.glob(os.path.join(nvm_dir, "versions/node/v*")):
            found.append((os.path.basename(folder), folder, os.path.join(folder, "lib/node_modules")))
        for folder in glob.glob(str(home / ".local/share/fnm/node-versions/v*")):
            found.append((os.path.basename(folder), folder, os.path.join(folder, "installation/lib/node_modules")))
    unique = {os.path.realpath(f): (v, f, m) for v, f, m in found if os.path.isdir(f)}
    return sorted(unique.values(), key=lambda row: version_key(row[0]))


# What the user's projects still use ------------------------------------------------------------------

def project_node_modules(walk):
    return [p for p, name in walk.artifacts.items() if name == "node_modules"]


def project_venvs(walk):
    return [p for p, name in walk.artifacts.items() if name in (".venv", "venv")]


def package_dirs(node_modules, package):
    """A package folder in a node_modules, including pnpm's .pnpm layout."""
    dirs = [os.path.join(node_modules, package)]
    flat = package.replace("/", "+")
    dirs += glob.glob(os.path.join(glob.escape(node_modules), ".pnpm", f"{glob.escape(flat)}@*", "node_modules", package))
    return [d for d in dirs if os.path.isdir(d)]


def used_playwright_dirs(links_dir, node_modules):
    """Browser folders some Playwright install still needs, read the way Playwright reads them: every file in
    .links names a playwright-core folder whose browsers.json lists the revisions. Returns (dirs, readable)."""
    package_paths = set()
    readable = True
    try:
        for name in os.listdir(links_dir):
            try:
                package_paths.add(Path(links_dir, name).read_text(encoding="utf-8").strip())
            except OSError:
                readable = False
    except OSError:
        readable = False
    for folder in node_modules:
        package_paths.update(package_dirs(folder, "playwright-core"))
    used = set()
    for package in package_paths:
        try:
            data = json.loads(Path(package, "browsers.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue  # the install is gone (a deleted project): its browsers are no longer needed
        for browser in data.get("browsers", []):
            name, revision = browser.get("name"), browser.get("revision")
            if name and revision:
                used.add(f"{name.replace('-', '_')}-{revision}")
                for override in (browser.get("revisionOverrides") or {}).values():
                    used.add(f"{name.replace('-', '_')}-{override}")
    return used, readable


def used_puppeteer_builds(node_modules):
    builds = set()
    for folder in node_modules:
        for package in package_dirs(folder, "puppeteer-core"):
            for revisions in glob.glob(os.path.join(glob.escape(package), "lib", "*", "puppeteer", "revisions.js")):
                try:
                    text = Path(revisions).read_text(encoding="utf-8", errors="replace")
                except OSError:
                    continue
                builds.update(re.findall(r"['\"]?[\w-]+['\"]?\s*:\s*['\"]([\w.]+)['\"]", text))
    return builds


def used_cypress_versions(node_modules):
    versions = set()
    for folder in node_modules:
        for package in package_dirs(folder, "cypress"):
            try:
                versions.add(json.loads(Path(package, "package.json").read_text(encoding="utf-8")).get("version"))
            except (OSError, ValueError):
                continue
    return versions


# Findings -------------------------------------------------------------------------------------------

def playwright_findings(cache, node_modules, ctx):
    if not cache.is_dir() or not ctx.on_selected(str(cache)):
        return []
    browsers = [e for e in os.scandir(cache) if e.is_dir(follow_symlinks=False) and re.match(r"^[a-z_]+-\d+$", e.name)]
    if not browsers:
        return []
    used, readable = used_playwright_dirs(cache / ".links", node_modules)
    findings = []
    if readable and (cache / ".links").is_dir():
        unused = [b.path for b in browsers if b.name not in used]
        level, reason = "safe", ("No Playwright install on this machine uses these browser revisions; this is the "
                                 "rule `npx playwright install` applies itself (installs listed in .links).")
    else:
        # No install list: keep the newest revision of each browser and every revision a project references.
        newest = {}
        for b in browsers:
            name, revision = b.name.rsplit("-", 1)
            if int(revision) > int(newest.get(name, ("", "-1"))[1]):
                newest[name] = (b.path, revision)
        keep = {path for path, _ in newest.values()}
        unused = [b.path for b in browsers if b.path not in keep and b.name not in used]
        level, reason = "aggressive", "Older Playwright browser revisions; the newest of each browser stays."
    sizes = {p: fsutil.fast_size(p) for p in unused}
    if unused and sum(sizes.values()) >= ctx.pref("min_finding_mb") * MB:
        findings.append(Finding(
            category="packages", title=f"Playwright browsers no install uses ({len(unused)} revisions)", action=DELETE,
            level=level, auto=True, size=sum(sizes.values()), paths=sorted(unused), reason=reason,
            risk="A project on an old Playwright version downloads its browsers again on `npx playwright install`.",
            restore="npx playwright install", drive=getattr(ctx.drive_of(str(cache)), "id", None),
            details={"kept": sorted(b.name for b in browsers if b.path not in unused)}))
    return findings


def versioned_cache_findings(tool, root, groups, used, ctx, restore):
    """Puppeteer and Cypress keep one folder per downloaded version. Keep the newest of each kind and every
    version a project still references; older ones are duplicates."""
    old, kept = [], []
    for group in groups:
        folders = [e for e in os.scandir(group) if e.is_dir(follow_symlinks=False)] if os.path.isdir(group) else []
        if not folders:
            continue
        newest = max(folders, key=lambda e: version_key(e.name.split("-", 1)[-1]))
        for folder in folders:
            build = folder.name.split("-", 1)[-1]
            if folder.path == newest.path or build in used or folder.name in used:
                kept.append(folder.name)
            else:
                old.append(folder.path)
    sizes = sum(fsutil.fast_size(p) for p in old)
    if not old or sizes < ctx.pref("min_finding_mb") * MB:
        return []
    return [Finding(
        category="packages", title=f"Old {tool} browser builds ({len(old)})", action=DELETE, level="aggressive",
        auto=True, size=sizes, paths=sorted(old),
        reason=f"{tool} downloads a new build on every upgrade and never removes the old ones; the newest build and "
               "every build a project references stay.",
        risk="A project pinned to an older version downloads its build again.", restore=restore,
        drive=getattr(ctx.drive_of(str(root)), "id", None), details={"kept": sorted(kept)})]


def bundled_browser_findings(node_modules, ctx):
    """Browsers downloaded into a project's node_modules instead of the shared cache (Puppeteer before 19,
    PLAYWRIGHT_BROWSERS_PATH=0)."""
    hits = []
    for folder in node_modules:
        for pattern in ("puppeteer/.local-chromium", "puppeteer/.local-firefox", "puppeteer-core/.local-chromium",
                        "playwright-core/.local-browsers", ".pnpm/*/node_modules/puppeteer/.local-chromium",
                        ".pnpm/*/node_modules/playwright-core/.local-browsers"):
            hits += glob.glob(os.path.join(glob.escape(folder), pattern))
    sizes = {p: single_link_size(p) for p in hits}
    total = sum(sizes.values())
    if len(hits) < 1 or total < 100 * MB:
        return []
    return [Finding(
        category="packages", title=f"Browsers bundled inside node_modules of {len(hits)} projects", action=REPORT,
        level="aggressive", size=total, paths=sorted(hits),
        reason="Each project downloaded its own browser. Puppeteer 19+ and Playwright share one cache per user: "
               "upgrade Puppeteer, or unset PLAYWRIGHT_BROWSERS_PATH=0, then reinstall to keep one copy.")]


def pinned_node_versions(node_modules):
    """Versions the user's projects ask for in .nvmrc or .node-version ("22", "v20.11.1", "lts/iron" is ignored)."""
    pins = set()
    for folder in node_modules:
        project = os.path.dirname(folder)
        for name in (".nvmrc", ".node-version"):
            try:
                text = Path(project, name).read_text(encoding="utf-8").strip().lstrip("v")
            except OSError:
                continue
            if re.match(r"^\d+(\.\d+){0,2}$", text):
                pins.add(text)
    return pins


def kept_node_versions(versions, current, default, pins):
    """The current version, the newest installed, and the newest match of the default alias and of each pin."""
    names = [v for v, _, _ in versions]
    keep = {current, max(names, key=version_key)} if names else {current}
    for prefix in {default, *pins} - {""}:
        matches = [v for v in names if v.lstrip("v") == prefix or v.lstrip("v").startswith(prefix + ".")]
        if matches:
            keep.add(max(matches, key=version_key))
    return keep


def node_version_findings(platform_name, home, ctx, node_modules=()):
    versions = nvm_versions(platform_name, home)
    if len(versions) < 2:
        return []
    current = (fsutil.run(["node", "-v"], timeout=10) or "").strip()
    default = ""
    alias = Path(os.environ.get("NVM_DIR") or home / ".nvm") / "alias/default"
    try:
        default = alias.read_text(encoding="utf-8").strip().lstrip("v")
    except OSError:
        pass
    pins = pinned_node_versions(node_modules)
    keep = kept_node_versions(versions, current, default, pins)
    findings = []
    packages = defaultdict(list)  # global package -> [(version, size)]
    for version, _, modules in versions:
        try:
            names = os.listdir(modules)
        except OSError:
            continue
        for name in names:
            if name in ("npm", "corepack") or name.startswith("."):
                continue
            if name.startswith("@"):
                inner = [f"{name}/{n}" for n in os.listdir(os.path.join(modules, name))] if os.path.isdir(os.path.join(modules, name)) else []
            else:
                inner = [name]
            for package in inner:
                packages[package].append((version, os.path.join(modules, package)))
    repeated = {p: rows for p, rows in packages.items() if len(rows) > 1}
    if repeated:
        with ThreadPoolExecutor(max_workers=ctx.jobs) as pool:
            sized = {p: sum(pool.map(lambda row: fsutil.fast_size(row[1]), rows)) for p, rows in repeated.items()}
        total = sum(sized.values())
        if total >= ctx.pref("min_finding_mb") * MB:
            lines = sorted(sized.items(), key=lambda kv: -kv[1])
            findings.append(Finding(
                category="packages", title=f"Global npm packages installed in several Node versions ({len(repeated)})",
                action=REPORT, level="aggressive", size=total,
                paths=[row[1] for p, _ in lines for row in repeated[p]],
                reason="; ".join(f"{p} in {len(repeated[p])} versions ({human(s)})" for p, s in lines[:8]) +
                ". Each Node version keeps its own global packages: remove the old Node versions below, or install "
                "global CLIs once with a tool that is not tied to one Node version (pnpm add -g, Volta).",
                details={"packages": {p: [v for v, _ in repeated[p]] for p in repeated}}))
    for version, folder, _ in versions:
        if version in keep:
            continue
        size = fsutil.fast_size(folder)
        if size < ctx.pref("min_finding_mb") * MB:
            continue
        command = ["nvm", "uninstall", version.lstrip("v")] if platform_name == "windows" else \
            f'. "${{NVM_DIR:-$HOME/.nvm}}/nvm.sh" && nvm uninstall {version}'
        findings.append(Finding(
            category="packages", title=f"Node.js {version} (not current, default, newest, or pinned)", action=COMMAND,
            level="yolo", auto=False, size=size, command=command, shell=isinstance(command, str), paths=[folder],
            reason=f"nvm keeps every Node version with its own global packages. Kept: {', '.join(sorted(keep - {''}, key=version_key))} "
                   f"(current {current or 'unknown'}, default {default or 'unset'}, newest, and the versions projects pin in "
                   f".nvmrc: {', '.join(sorted(pins)) or 'none'}).",
            risk="Projects that pin this version in .nvmrc need it installed again (nvm install).",
            restore=f"nvm install {version}", drive=getattr(ctx.drive_of(folder), "id", None)))
    return findings


def copied_package_findings(node_modules, venvs, ctx):
    """Heavy packages copied into several projects or virtual environments. Hardlinked copies (pnpm, Bun, uv)
    cost nothing and are not counted."""
    findings = []
    node_hits = defaultdict(list)
    for folder in node_modules:
        for package in HEAVY_NODE_PACKAGES:
            path = os.path.join(folder, package)
            if os.path.isdir(path):
                node_hits[package].append(path)
    python_hits = defaultdict(list)
    for venv in venvs:
        for site in glob.glob(os.path.join(glob.escape(venv), "lib", "python*", "site-packages")) + \
                glob.glob(os.path.join(glob.escape(venv), "Lib", "site-packages")):
            for package in HEAVY_PYTHON_PACKAGES:
                path = os.path.join(site, package)
                if os.path.isdir(path):
                    python_hits[package].append(path)

    def measure(item):
        package, paths = item
        return package, paths, sum(single_link_size(p) for p in paths)

    for hits, kind, advice in (
        (node_hits, "projects", "Use pnpm (or Bun), which keeps one copy of each package version for every project."),
        (python_hits, "virtual environments", "Use uv, which links packages from one cache into every environment."),
    ):
        repeated = [(p, paths) for p, paths in hits.items() if len(paths) > 1]
        with ThreadPoolExecutor(max_workers=ctx.jobs) as pool:
            for package, paths, size in pool.map(measure, repeated):
                if size < COPY_MIN:
                    continue
                findings.append(Finding(
                    category="packages", title=f"{package} copied into {len(paths)} {kind}", action=REPORT,
                    level="aggressive", size=size, paths=sorted(paths),
                    reason=f"{len(paths)} separate copies take {human(size)}. {advice} Stale projects' copies are in "
                           "the build output findings."))
    findings.sort(key=lambda f: -f.size)
    return findings


def package_findings(platform, ctx, walk):
    home = platform.home
    name = platform.name
    node_modules = project_node_modules(walk)
    puppeteer = puppeteer_cache(home)
    cypress = cypress_cache(name, home)
    puppeteer_groups = [e.path for e in os.scandir(puppeteer) if e.is_dir(follow_symlinks=False)] \
        if puppeteer.is_dir() and ctx.on_selected(str(puppeteer)) else []
    tasks = [
        lambda: playwright_findings(playwright_cache(name, home), node_modules, ctx),
        lambda: versioned_cache_findings("Puppeteer", puppeteer, puppeteer_groups, used_puppeteer_builds(node_modules),
                                         ctx, "npx puppeteer browsers install chrome"),
        lambda: cypress_findings(cypress, node_modules, ctx),
        lambda: bundled_browser_findings(node_modules, ctx),
        lambda: node_version_findings(name, home, ctx, node_modules),
        lambda: copied_package_findings(node_modules, project_venvs(walk), ctx),
    ]
    findings = []
    with ThreadPoolExecutor(max_workers=len(tasks)) as pool:
        for future in [pool.submit(task) for task in tasks]:
            try:
                findings.extend(future.result())
            except Exception as error:  # noqa: BLE001 - one broken probe must not stop the scan
                ctx.note(f"packages: {type(error).__name__}: {error}")
    return findings


def cypress_findings(cache, node_modules, ctx):
    """Cypress keeps one folder per version directly in its cache."""
    if not cache.is_dir() or not ctx.on_selected(str(cache)):
        return []
    versions = [e for e in os.scandir(cache) if e.is_dir(follow_symlinks=False) and re.match(r"^\d+\.\d+", e.name)]
    if len(versions) < 2:
        return []
    used = used_cypress_versions(node_modules)
    newest = max(versions, key=lambda e: version_key(e.name))
    old = [e.path for e in versions if e.path != newest.path and e.name not in used]
    size = sum(fsutil.fast_size(p) for p in old)
    if not old or size < ctx.pref("min_finding_mb") * MB:
        return []
    return [Finding(
        category="packages", title=f"Old Cypress binaries ({len(old)})", action=DELETE, level="aggressive", auto=True,
        size=size, paths=sorted(old), reason="Cypress keeps every version it ever downloaded; the newest and every "
        "version a project uses stay.", risk="A project on an older Cypress downloads its binary again.",
        restore="npx cypress install", drive=getattr(ctx.drive_of(str(cache)), "id", None),
        details={"kept": sorted(e.name for e in versions if e.path not in old)})]
