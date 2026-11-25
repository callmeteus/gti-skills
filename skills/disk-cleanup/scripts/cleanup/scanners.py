"""The parallel scan: every category runs at the same time, and each one fans out its own measurements."""

from __future__ import annotations

import heapq
import os
import re
import stat
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from cleanup import fsutil
from cleanup.model import COMMAND, DELETE, REPORT, Finding

MB = 1024 * 1024

INSTALLER_EXT = (".exe", ".msi", ".msix", ".msixbundle", ".appx", ".dmg", ".pkg", ".mpkg", ".deb", ".rpm",
                 ".snap", ".flatpakref", ".iso", ".img", ".vhd", ".vhdx", ".apk", ".xapk")
ARCHIVE_EXT = (".zip", ".7z", ".rar", ".tar", ".tar.gz", ".tgz", ".tar.xz", ".txz", ".tar.bz2", ".tbz2",
               ".tar.zst", ".gz", ".xz", ".bz2", ".zst")

# Build output folders and the file next to them that proves they are build output.
ARTIFACTS = {
    "node_modules": ("package.json",),
    "target": ("Cargo.toml", "pom.xml"),
    ".venv": ("pyvenv.cfg@",),
    "venv": ("pyvenv.cfg@",),
    "__pycache__": (),
    ".pytest_cache": (),
    ".mypy_cache": (),
    ".ruff_cache": (),
    ".tox": ("tox.ini", "pyproject.toml", "setup.cfg"),
    ".nox": ("noxfile.py",),
    ".next": ("package.json",),
    ".nuxt": ("package.json",),
    ".turbo": ("package.json", "turbo.json"),
    ".parcel-cache": ("package.json",),
    ".svelte-kit": ("package.json",),
    ".angular": ("angular.json",),
    ".expo": ("package.json",),
    ".gradle": ("build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"),
    "build": ("build.gradle", "build.gradle.kts", "CMakeLists.txt", "pubspec.yaml", "setup.py", "meson.build"),
    "dist": ("package.json", "setup.py", "pyproject.toml"),
    "obj": ("*.csproj", "*.fsproj", "*.vbproj"),
    "bin": ("*.csproj", "*.fsproj", "*.vbproj"),
    "Pods": ("Podfile",),
    ".dart_tool": ("pubspec.yaml",),
    ".terraform": ("*.tf",),
    "zig-cache": ("build.zig",),
    ".zig-cache": ("build.zig",),
    "_build": ("mix.exs", "dune-project"),
    "deps": ("mix.exs",),
    ".stack-work": ("stack.yaml",),
    "cmake-build-debug": ("CMakeLists.txt",),
    "cmake-build-release": ("CMakeLists.txt",),
}
# Folders that hold real source in some projects: only deleted when git says nothing inside is tracked.
MAYBE_TRACKED = {"build", "dist", "bin", "obj", "deps", "_build", "target"}
TINY_CACHES = {"__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache"}
BACKUP_WORDS = re.compile(r"(^|[^a-z])(backup|backups|bkp|bak|copia|copias|respaldo|sauvegarde|time machine)([^a-z]|$)", re.I)
PACKAGE_DIRS = {"node_modules", "site-packages", "dist-packages", ".venv", "venv", "vendor", "pods", ".git",
                ".svn", ".hg", ".cargo", ".rustup", ".m2", ".gradle", "go", ".nuget"}
BUNDLE_SUFFIXES = (".app", ".photoslibrary", ".musiclibrary", ".tvlibrary", ".fcpbundle", ".imovielibrary",
                   ".aplibrary", ".lrdata", ".lrcat-data", ".logicx", ".band", ".xcarchive", ".pvm", ".vmwarevm",
                   ".utm", ".sparsebundle", ".backupdb", ".photolibrary")


def run_parallel(tasks, jobs, ctx):
    """Runs named callables at once. A failing task becomes a note, never a failed scan."""
    results, timings = {}, {}
    with ThreadPoolExecutor(max_workers=max(1, min(jobs, len(tasks)))) as pool:
        started = {name: time.time() for name in tasks}
        futures = {pool.submit(fn): name for name, fn in tasks.items()}
        for future in as_completed(futures):
            name = futures[future]
            try:
                results[name] = future.result() or []
            except Exception as error:  # noqa: BLE001 - one broken probe must not stop the scan
                results[name] = []
                ctx.note(f"{name}: {type(error).__name__}: {error}")
            timings[name] = round(time.time() - started[name], 2)
    return results, timings


# Targets --------------------------------------------------------------------------------------------

def scan_targets(platform, ctx):
    """Expands every known target, keeps the ones on the selected drives, and measures them in parallel."""
    targets = list(platform.targets(ctx)) + list(platform.trash_targets(ctx))
    jobs, claimed = [], []
    for target in targets:
        for pattern in target.patterns:
            for path in fsutil.expand(pattern):
                if not ctx.on_selected(path) or blocked(platform, path) or platform.skip_target(path):
                    continue
                if any(fsutil.is_under(path, c) for c in claimed):
                    continue  # an earlier, more specific target already covers it
                st = fsutil.lstat(path)
                if st is None or fsutil.is_link(st):
                    continue
                if target.action == "delete_contents" and not stat.S_ISDIR(st.st_mode):
                    continue
                claimed.append(path)
                jobs.append((target, path))
    findings = []
    min_size = ctx.pref("min_finding_mb") * MB

    def measure(item):
        target, path = item
        age = target.older_than_days
        if age == "temp":
            age = ctx.pref("temp_age_days")
        if target.action == "delete_contents" and age:
            size = fsutil.tree(path, older_than=age).size
        else:
            size = fsutil.fast_size(path)
        return target, path, size, age

    with ThreadPoolExecutor(max_workers=ctx.jobs) as pool:
        for target, path, size, age in pool.map(measure, jobs):
            if size < min_size:
                continue
            findings.append(Finding(
                category=target.category, title=target.title, action=target.action, level=target.level,
                size=size, paths=[path], admin=target.admin, auto=target.auto, reason=target.reason,
                risk=target.risk, restore=target.restore, older_than_days=age,
                drive=getattr(ctx.drive_of(path), "id", None),
            ))
    return merge_same_title(findings)


def merge_same_title(findings):
    """One finding per target title, so twenty browser profiles read as one line."""
    merged = {}
    for f in findings:
        key = (f.category, f.title, f.action, f.level, f.older_than_days, f.admin)
        if key in merged:
            merged[key].paths.extend(f.paths)
            merged[key].size += f.size
        else:
            merged[key] = f
    for f in merged.values():
        f.id = ""
        f.__post_init__()
    return list(merged.values())


def blocked(platform, path):
    for denied in platform.denied_paths():
        if fsutil.is_under(path, denied):
            return True
    return False


# Commands -------------------------------------------------------------------------------------------

def scan_commands(platform, ctx):
    findings = []

    def evaluate(cmd):
        if cmd.binary and not fsutil.run_exists(cmd.binary):
            return None
        if cmd.on and not ctx.on_selected(cmd.on):
            return None
        size, estimate, details = 0, False, {}
        if cmd.probe:
            probed = cmd.probe(ctx)
            if probed is None:
                return None
            size, estimate, details = probed
        elif cmd.measure:
            for pattern in cmd.measure:
                for path in fsutil.expand(pattern):
                    size += fsutil.fast_size(path)
        if size < ctx.pref("min_finding_mb") * MB and not estimate:
            return None
        return Finding(
            category=cmd.category, title=cmd.title, action=COMMAND, level=cmd.level, size=size,
            command=cmd.argv, shell=cmd.shell, admin=cmd.admin, auto=cmd.auto, estimate=estimate,
            reason=cmd.reason, risk=cmd.risk, restore=cmd.restore, details=details,
            drive=getattr(ctx.drive_of(cmd.on or str(platform.home)), "id", None),
        )

    with ThreadPoolExecutor(max_workers=ctx.jobs) as pool:
        for finding in pool.map(evaluate, platform.commands(ctx)):
            if finding:
                findings.append(finding)
    return findings


# The data walk: duplicates, build output, large files, space by folder --------------------------------

class WalkResult:
    def __init__(self):
        self.by_size = defaultdict(list)    # size -> [path]
        self.large = []                     # heap of (size, path, mtime)
        self.artifacts = {}                 # path -> name
        self.artifact_size = defaultdict(int)
        self.folders = defaultdict(int)     # first-level folder -> bytes
        self.files = 0
        self.bytes = 0
        self.errors = 0
        self.seconds = 0.0

    def add_large(self, item):
        if len(self.large) < 50:
            heapq.heappush(self.large, item)
        else:
            heapq.heappushpop(self.large, item)

    def merge(self, other):
        for size, paths in other.by_size.items():
            self.by_size[size].extend(paths)
        for item in other.large:
            self.add_large(item)
        self.artifacts.update(other.artifacts)
        for key, value in other.artifact_size.items():
            self.artifact_size[key] += value
        for key, value in other.folders.items():
            self.folders[key] += value
        self.files += other.files
        self.bytes += other.bytes
        self.errors += other.errors


def walk_data(platform, ctx, roots):
    """One pass over the user's data on the selected drives, never following links or entering other mounts.
    The tree is split breadth first until there is work for every CPU, and each piece runs in its own process."""
    result = WalkResult()
    started = time.time()
    walker = Walker(platform, ctx)
    jobs = []
    for root in roots:
        jobs.append((root, root, None, True, None))
    workers = max(1, min(ctx.jobs, os.cpu_count() or 1))
    depth = 0
    while jobs and len(jobs) < workers * 8 and depth < 4:
        expanded = []
        for job in jobs:
            expanded.extend(walker.list_folder(job, result))
        jobs, depth = expanded, depth + 1
    jobs.sort(key=lambda job: job[0])
    chunks = [jobs[i::workers * 4] for i in range(workers * 4)]
    chunks = [c for c in chunks if c]
    try:
        import multiprocessing
        from concurrent.futures import ProcessPoolExecutor
        # spawn, not fork: the scan runs other threads, and forking a threaded process can deadlock.
        with ProcessPoolExecutor(max_workers=workers, mp_context=multiprocessing.get_context("spawn")) as pool:
            for part in pool.map(walker.walk_many, chunks):
                result.merge(part)
    except (OSError, ImportError, RuntimeError, NotImplementedError) as error:
        ctx.note(f"Process pool unavailable ({type(error).__name__}); walked with threads instead.")
        with ThreadPoolExecutor(max_workers=workers) as pool:
            for part in pool.map(walker.walk_many, chunks):
                result.merge(part)
    result.seconds = round(time.time() - started, 2)
    return result


class Walker:
    def __init__(self, platform, ctx):
        self.home = str(platform.home)
        self.skip = platform.walk_skip(ctx)
        self.appdata = platform.appdata_names()
        self.min_dup = ctx.pref("min_duplicate_mb") * MB
        self.large_min = ctx.pref("large_file_mb") * MB
        self.seen_inodes = set()

    def walk_many(self, jobs):
        part = WalkResult()
        stack = list(jobs)
        while stack:
            stack.extend(self.list_folder(stack.pop(), part))
        return part

    def list_folder(self, job, part):
        folder, root, top, dup_ok, art = job
        try:
            entries = list(os.scandir(folder))
        except OSError:
            part.errors += 1
            return []
        names = {e.name for e in entries}
        child_dup_ok = dup_ok and ".git" not in names
        children = []
        for entry in entries:
            item = self.visit(entry, folder, root, top, child_dup_ok, art, names, part)
            if item:
                children.append(item)
        return children

    def visit(self, entry, folder, root, top, dup_ok, art, names, part):
        """Counts a file, or returns the walk job for a folder."""
        try:
            st = entry.stat(follow_symlinks=False)
        except OSError:
            part.errors += 1
            return None
        if fsutil.is_link(st):
            return None
        key = top or entry.path
        if stat.S_ISDIR(st.st_mode):
            if fsutil.norm(entry.path) in self.skip:
                return None
            lower = entry.name.lower()
            child_art = art
            if art is None and entry.name in ARTIFACTS and is_artifact(entry.name, folder, names):
                part.artifacts[entry.path] = entry.name
                child_art = entry.path
            child_ok = dup_ok and child_art is None and lower not in PACKAGE_DIRS and lower not in self.appdata \
                and not lower.endswith(BUNDLE_SUFFIXES) and not TOOLCHAIN_DIRS.search(lower) \
                and not (entry.name.startswith(".") and root == self.home)
            return (entry.path, root, key, child_ok, child_art)
        if not stat.S_ISREG(st.st_mode) or fsutil.is_cloud_placeholder(st):
            return None
        if st.st_nlink > 1 and st.st_ino:
            inode = (st.st_dev, st.st_ino)
            if inode in self.seen_inodes:
                return None
            self.seen_inodes.add(inode)
        size = fsutil.allocated(st)
        part.files += 1
        part.bytes += size
        part.folders[key] += size
        if art and st.st_nlink <= 1:
            part.artifact_size[art] += size  # hardlinked files (pnpm, bun) stay on disk after the folder is deleted
        if dup_ok and st.st_size >= self.min_dup and is_user_content(entry.name):
            part.by_size[st.st_size].append(entry.path)
        if size >= self.large_min:
            part.add_large((size, entry.path, st.st_mtime))
        return None


# Only the user's own content is checked for duplicates. Programs, libraries, and SDKs ship identical files on
# purpose, and deleting one copy breaks the program that loads it.
USER_CONTENT_EXT = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".tif", ".tiff", ".bmp", ".raw", ".cr2", ".cr3",
    ".nef", ".arw", ".dng", ".orf", ".rw2", ".psd", ".xcf", ".svg", ".ai", ".eps",
    ".mp4", ".mov", ".mkv", ".avi", ".wmv", ".m4v", ".webm", ".mpg", ".mpeg", ".3gp", ".mts", ".m2ts",
    ".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".wma", ".aiff", ".alac",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp", ".rtf", ".epub", ".mobi",
    ".pages", ".numbers", ".key", ".csv", ".txt", ".md",
    ".zip", ".7z", ".rar", ".tar", ".gz", ".tgz", ".xz", ".bz2", ".zst",
    ".iso", ".img", ".dmg", ".exe", ".msi", ".pkg", ".deb", ".rpm", ".apk", ".appimage",
    ".blend", ".fbx", ".obj", ".stl", ".3mf", ".max", ".c4d", ".prproj", ".aep", ".kdenlive", ".drp",
}
TOOLCHAIN_DIRS = re.compile(r"^(sdk|sdks|ndk|toolchains?|android|\.?android|jdk.*|jre.*|flutter|unity|"
                            r"steamapps|games|program files.*|applications|opt|lib|lib64|bin|share|include)$")


def is_user_content(name):
    lower = name.lower()
    return any(lower.endswith(ext) for ext in USER_CONTENT_EXT)


def is_artifact(name, parent, sibling_names):
    markers = ARTIFACTS[name]
    if not markers:
        return True
    for marker in markers:
        if marker.endswith("@"):
            if os.path.exists(os.path.join(parent, name, marker[:-1])):
                return True
        elif marker.startswith("*"):
            if any(n.endswith(marker[1:]) for n in sibling_names):
                return True
        elif marker in sibling_names:
            return True
    return False


def find_duplicates(walk, ctx):
    """Size, then the first and last 64 KiB, then the whole file: only identical content is a duplicate."""
    candidates = []
    for paths in walk.by_size.values():
        if len(paths) < 2:
            continue
        by_inode = {}
        for path in paths:  # two names of one hardlinked file are not two copies
            st = fsutil.lstat(path)
            if st:
                by_inode.setdefault((st.st_dev, st.st_ino) if st.st_ino else path, path)
        if len(by_inode) > 1:
            candidates.append(list(by_inode.values()))
    if not candidates:
        return []
    with ThreadPoolExecutor(max_workers=ctx.jobs) as pool:
        flat = [p for group in candidates for p in group]
        partial = dict(zip(flat, pool.map(lambda p: fsutil.hash_file(p, partial=True), flat)))
        second = []
        for group in candidates:
            buckets = defaultdict(list)
            for path in group:
                if partial.get(path):
                    buckets[partial[path]].append(path)
            second.extend(b for b in buckets.values() if len(b) > 1)
        flat = [p for group in second for p in group]
        full = dict(zip(flat, pool.map(fsutil.hash_file, flat)))
    findings = []
    for group in second:
        buckets = defaultdict(list)
        for path in group:
            if full.get(path):
                buckets[full[path]].append(path)
        for digest, paths in buckets.items():
            if len(paths) < 2:
                continue
            keeper = choose_keeper(paths, ctx)
            copies = [p for p in paths if p != keeper]
            size = os.path.getsize(keeper)
            backup = any(BACKUP_WORDS.search(p) for p in paths)
            findings.append(Finding(
                category="duplicates", title=f"{len(paths)} identical copies of {os.path.basename(keeper)}",
                action=DELETE, level="yolo" if backup else "aggressive", size=size * len(copies), paths=copies,
                keep=keeper, digest=digest, auto=not backup,
                reason="Same size and same BLAKE2b hash of the whole file.",
                risk="A copy inside a backup folder is a backup: kept unless the level is yolo." if backup else
                "Programs or shortcuts that open a deleted copy by its path will not find it.",
                restore="The kept copy has the same content; copy it back to the old path if needed.",
                drive=getattr(ctx.drive_of(keeper), "id", None),
            ))
    findings.sort(key=lambda f: f.size, reverse=True)
    return findings


TRANSIENT = re.compile(r"[\\/](downloads|transfer[eê]ncias|descargas|t[ée]l[ée]chargements|desktop|"
                       r"[áa]rea de trabalho|temp|tmp)[\\/]", re.I)
COPY_NAME = re.compile(r"(\(\d+\)|[ _-]copy( \d+)?|[ _-]c[oó]pia( \d+)?|[ _-]copia( \d+)?|~\d*)(\.[^.]+)?$", re.I)


def choose_keeper(paths, ctx):
    """Keeps the copy that looks like the original: not in Downloads or Desktop, not named 'copy' or '(1)',
    in a backup folder when one copy is (the backup stays), then the shortest path, then the oldest."""
    def score(path):
        name = os.path.basename(path)
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            mtime = time.time()
        return (
            0 if BACKUP_WORDS.search(path) else 1,
            1 if TRANSIENT.search(path) else 0,
            1 if COPY_NAME.search(name) else 0,
            path.count(os.sep),
            mtime,
            path,
        )
    return min(paths, key=score)


def artifact_findings(walk, ctx):
    """Build output in projects: aggressive when the project is stale, yolo when it is in use."""
    stale_days = ctx.pref("stale_project_days")
    min_size = ctx.pref("min_finding_mb") * MB
    roots = [p for p in walk.artifacts if walk.artifact_size[p] >= min_size]

    def evaluate(path):
        name = walk.artifacts[path]
        project = os.path.dirname(path)
        if name in MAYBE_TRACKED and git_tracks(project, name):
            return None
        size = walk.artifact_size[path]
        last = project_activity(project, set(ARTIFACTS))
        days = int((time.time() - last) / 86400) if last else None
        stale = days is not None and days >= stale_days
        return Finding(
            category="dev", title=f"{name} in {os.path.basename(project) or project}",
            action=DELETE, level="aggressive" if stale else "yolo", size=size, paths=[path], auto=True,
            reason=f"Build output or dependency folder; project last changed {days} days ago." if days is not None
            else "Build output or dependency folder.",
            risk="The next build or install downloads or rebuilds it." + ("" if stale else " The project is in use."),
            restore=restore_hint(name), details={"project": project, "idle_days": days},
            drive=getattr(ctx.drive_of(path), "id", None),
        )

    with ThreadPoolExecutor(max_workers=ctx.jobs) as pool:
        found = [f for f in pool.map(evaluate, roots) if f]
    found.sort(key=lambda f: f.size, reverse=True)
    return found


def restore_hint(name):
    hints = {
        "node_modules": "Run the project's install command (npm install, pnpm install, yarn, bun install).",
        "target": "cargo build or mvn package rebuilds it.",
        ".venv": "Recreate the virtual environment and reinstall the requirements.",
        "venv": "Recreate the virtual environment and reinstall the requirements.",
        "Pods": "pod install rebuilds it.",
        ".terraform": "terraform init downloads the providers again.",
    }
    return hints.get(name, "The next build recreates it.")


def git_tracks(project, name):
    if not fsutil.run_exists("git"):
        return True  # without git, never delete a folder that might hold source
    out = fsutil.run(["git", "-C", project, "ls-files", "--", name], timeout=20)
    if out is None:
        return not os.path.isdir(os.path.join(project, ".git")) and _inside_repo(project)
    return bool(out.strip())


def _inside_repo(folder):
    out = fsutil.run(["git", "-C", folder, "rev-parse", "--is-inside-work-tree"], timeout=10)
    return bool(out and out.strip() == "true")


def project_activity(project, ignore):
    """Newest change in the project's files two levels deep, plus git's index and HEAD."""
    newest = 0.0
    for extra in (".git/index", ".git/HEAD", ".git/FETCH_HEAD", ".git/logs/HEAD"):
        st = fsutil.lstat(os.path.join(project, extra))
        if st:
            newest = max(newest, st.st_mtime)
    stack = [(project, 0)]
    while stack:
        folder, depth = stack.pop()
        try:
            entries = list(os.scandir(folder))
        except OSError:
            continue
        for entry in entries:
            if entry.name in ignore or entry.name == ".git":
                continue
            try:
                st = entry.stat(follow_symlinks=False)
            except OSError:
                continue
            newest = max(newest, st.st_mtime)
            if stat.S_ISDIR(st.st_mode) and depth < 2 and not fsutil.is_link(st):
                stack.append((entry.path, depth + 1))
    return newest


def download_findings(platform, ctx):
    """Old installers, disk images, and archives already extracted next to themselves."""
    folder = platform.downloads_dir()
    if not folder or not os.path.isdir(folder) or not ctx.on_selected(str(folder)):
        return []
    age = ctx.pref("download_age_days")
    now = time.time()
    groups = defaultdict(list)
    try:
        entries = list(os.scandir(folder))
    except OSError:
        return []
    names = {e.name.lower() for e in entries}
    for entry in entries:
        try:
            st = entry.stat(follow_symlinks=False)
        except OSError:
            continue
        if not stat.S_ISREG(st.st_mode) or fsutil.is_link(st) or fsutil.is_cloud_placeholder(st):
            continue
        lower = entry.name.lower()
        days = (now - st.st_mtime) / 86400
        size = fsutil.allocated(st)
        if lower.endswith(INSTALLER_EXT):
            if days >= age:
                groups[("aggressive", f"Installers and disk images in Downloads older than {age} days")].append((entry.path, size))
            elif days >= 7:
                groups[("yolo", "Installers and disk images in Downloads older than 7 days")].append((entry.path, size))
        elif lower.endswith(ARCHIVE_EXT):
            stem = strip_archive_ext(lower)
            if days >= age and stem in names:
                groups[("aggressive", f"Archives in Downloads already extracted, older than {age} days")].append((entry.path, size))
            elif days >= age:
                groups[("yolo", f"Archives in Downloads older than {age} days")].append((entry.path, size))
    findings = []
    for (level, title), items in groups.items():
        findings.append(Finding(
            category="downloads", title=title, action=DELETE, level=level, auto=True,
            size=sum(s for _, s in items), paths=[p for p, _ in items],
            reason="Downloaded installers and archives are usually used once.",
            risk="The file must be downloaded again if it is needed; check for licenses or installers that are no longer published.",
            restore="Download it again from its source.", drive=getattr(ctx.drive_of(str(folder)), "id", None),
        ))
    return findings


def strip_archive_ext(name):
    for ext in sorted(ARCHIVE_EXT, key=len, reverse=True):
        if name.endswith(ext):
            return name[: -len(ext)]
    return name


def large_findings(walk, ctx):
    items = sorted(walk.large, reverse=True)[:25]
    findings = []
    for size, path, mtime in items:
        findings.append(Finding(
            category="large", title=os.path.basename(path), action=REPORT, level="safe", size=size, paths=[path],
            reason=f"Large file, last changed {time.strftime('%Y-%m-%d', time.localtime(mtime))}. Only the user can judge it.",
            drive=getattr(ctx.drive_of(path), "id", None),
        ))
    return findings


def folder_usage(walk, limit=30):
    return [{"path": p, "size": s} for p, s in sorted(walk.folders.items(), key=lambda kv: kv[1], reverse=True)[:limit]]


def scan_data(platform, ctx):
    roots = []
    for drive in ctx.selected:
        roots.extend(platform.data_roots(ctx, drive))
    roots = [r for r in dict.fromkeys(roots) if os.path.isdir(r)]
    walk = walk_data(platform, ctx, roots)
    tasks = {
        "duplicates": lambda: find_duplicates(walk, ctx),
        "dev": lambda: artifact_findings(walk, ctx),
        "downloads": lambda: download_findings(platform, ctx),
    }
    results, timings = run_parallel(tasks, 3, ctx)
    findings = results["duplicates"] + results["dev"] + results["downloads"] + large_findings(walk, ctx)
    summary = {
        "roots": roots, "files": walk.files, "bytes": walk.bytes, "unreadable": walk.errors,
        "seconds": walk.seconds, "folders": folder_usage(walk), "timings": timings,
    }
    return findings, summary
