"""File system helpers that never follow links, never cross into other mounts, and never raise on one bad file."""

from __future__ import annotations

import glob
import hashlib
import os
import shutil
import stat
import subprocess
import time
from pathlib import Path

IS_WINDOWS = os.name == "nt"
REPARSE_POINT = 0x400  # FILE_ATTRIBUTE_REPARSE_POINT: symlinks, junctions, cloud placeholders
RECALL_ON_OPEN = 0x40000  # FILE_ATTRIBUTE_RECALL_ON_OPEN: cloud file not on disk
RECALL_ON_DATA_ACCESS = 0x400000
OFFLINE = 0x1000

DAY = 86400


def expand(pattern):
    """Expands ~, environment variables, and globs. Unset variables drop the pattern."""
    text = os.path.expandvars(os.path.expanduser(str(pattern)))
    if "$" in text or "%" in text:
        return []
    return sorted(set(glob.glob(text)))


def lstat(path):
    try:
        return os.lstat(path)
    except OSError:
        return None


def is_link(st):
    """True for symlinks, junctions, and other reparse points (including cloud placeholders)."""
    if st is None:
        return False
    if stat.S_ISLNK(st.st_mode):
        return True
    attributes = getattr(st, "st_file_attributes", 0)
    return bool(attributes & REPARSE_POINT)


def is_cloud_placeholder(st):
    """A Windows cloud file whose data is not on this disk: deleting it frees nothing and deletes it in the cloud."""
    attributes = getattr(st, "st_file_attributes", 0)
    return bool(attributes & (RECALL_ON_OPEN | RECALL_ON_DATA_ACCESS | OFFLINE))


def allocated(st):
    """Bytes the file takes on disk. Sparse files (Docker.raw, VM images) report far less than st_size."""
    blocks = getattr(st, "st_blocks", None)
    return blocks * 512 if blocks is not None else st.st_size


def norm(path):
    path = os.path.normpath(os.path.abspath(str(path)))
    return path.lower() if IS_WINDOWS else path


def is_under(path, root):
    path, root = norm(path), norm(root)
    if path == root:
        return True
    return path.startswith(root.rstrip("\\/") + os.sep)


class Tree:
    """Size, file count, and newest change time of a folder tree."""

    __slots__ = ("size", "files", "newest", "errors")

    def __init__(self):
        self.size = 0
        self.files = 0
        self.newest = 0.0
        self.errors = 0


def tree(path, skip=(), stop=None, older_than=None, seen=None):
    """Walks a tree without following links or entering `skip` paths. `older_than` counts only old files."""
    result = Tree()
    seen = seen if seen is not None else set()
    skip = {norm(p) for p in skip}
    cutoff = time.time() - older_than * DAY if older_than else None
    root_st = lstat(path)
    if root_st is None or is_link(root_st):
        return result
    if not stat.S_ISDIR(root_st.st_mode):
        result.size, result.files, result.newest = allocated(root_st), 1, root_st.st_mtime
        return result
    stack = [str(path)]
    while stack:
        current = stack.pop()
        try:
            entries = os.scandir(current)
        except OSError:
            result.errors += 1
            continue
        with entries:
            for entry in entries:
                try:
                    st = entry.stat(follow_symlinks=False)
                except OSError:
                    result.errors += 1
                    continue
                if is_link(st):
                    continue
                if stat.S_ISDIR(st.st_mode):
                    if norm(entry.path) in skip or (stop and stop(entry.path)):
                        continue
                    stack.append(entry.path)
                    continue
                key = (st.st_dev, st.st_ino) if st.st_ino else None
                if key and st.st_nlink > 1:
                    if key in seen:
                        continue
                    seen.add(key)
                result.newest = max(result.newest, st.st_mtime)
                if cutoff is not None and st.st_mtime > cutoff:
                    continue
                result.size += allocated(st)
                result.files += 1
    return result


_DU = []


def du_tool():
    """A native du, much faster than walking in Python or PowerShell. On Windows only Sysinternals du whose EULA
    the user already accepted (this skill never accepts it for them). Returns (kind, exe) or None."""
    if _DU:
        return _DU[0]
    tool = None
    if IS_WINDOWS:
        accepted = False
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Sysinternals\Du") as key:
                accepted = winreg.QueryValueEx(key, "EulaAccepted")[0] == 1
        except (ImportError, OSError):
            accepted = False
        for name in ("du64", "du"):
            exe = shutil.which(name)
            if exe and accepted:
                out = _capture([exe, "-nobanner", "-c", "-q", "-l", "0", os.environ.get("TEMP", ".")], 30)
                if out and "DirectorySize" in out:
                    tool = ("sysinternals", exe)
                    break
    else:
        exe = shutil.which("du")
        if exe:
            tool = ("posix", exe)
    _DU.append(tool)
    return tool


def _capture(argv, timeout):
    """Stdout even when the tool exits non-zero (du does when one subfolder is unreadable)."""
    try:
        completed = subprocess.run(argv, capture_output=True, text=True, timeout=timeout, encoding="utf-8",
                                   errors="replace", stdin=subprocess.DEVNULL)
    except (OSError, subprocess.SubprocessError):
        return None
    return completed.stdout


def fast_size(path):
    """Allocated size of a whole tree, through a native du when there is one, else the Python walk."""
    tool = du_tool()
    st = lstat(path)
    if st is None or is_link(st):
        return 0
    if tool and stat.S_ISDIR(st.st_mode):
        kind, exe = tool
        if kind == "posix":
            out = _capture([exe, "-skx", str(path)], 900)
            try:
                return int(out.strip().splitlines()[-1].split()[0]) * 1024
            except (AttributeError, IndexError, ValueError):
                pass
        else:
            out = _capture([exe, "-nobanner", "-c", "-q", str(path)], 900)
            size = parse_sysinternals_du(out or "")
            if size is not None:
                return size
    return tree(path).size


def parse_sysinternals_du(text):
    """Sysinternals du -c output: a CSV header and one row; DirectorySizeOnDisk is the allocated size."""
    import csv
    rows = [r for r in csv.reader(text.strip().splitlines()) if r]
    if len(rows) < 2:
        return None
    header, row = rows[0], rows[-1]
    for column in ("DirectorySizeOnDisk", "DirectorySize"):
        if column in header:
            try:
                return int(row[header.index(column)])
            except (IndexError, ValueError):
                return None
    return None


def newest_mtime(path):
    st = lstat(path)
    if st is None:
        return 0.0
    if not stat.S_ISDIR(st.st_mode) or is_link(st):
        return st.st_mtime
    return max(tree(path).newest, st.st_mtime)


def hash_file(path, partial=False, chunk=1024 * 1024):
    """BLAKE2b of the whole file, or of its first and last 64 KiB when `partial`."""
    digest = hashlib.blake2b(digest_size=20)
    try:
        with open(path, "rb") as handle:
            if partial:
                digest.update(handle.read(65536))
                size = os.fstat(handle.fileno()).st_size
                if size > 131072:
                    handle.seek(-65536, os.SEEK_END)
                    digest.update(handle.read(65536))
                return digest.hexdigest()
            for block in iter(lambda: handle.read(chunk), b""):
                digest.update(block)
    except OSError:
        return None
    return digest.hexdigest()


def long_path(path):
    """Windows paths over 260 characters need the \\\\?\\ prefix."""
    path = str(path)
    if IS_WINDOWS and len(path) > 240 and not path.startswith("\\\\?\\"):
        absolute = os.path.abspath(path)
        return "\\\\?\\UNC\\" + absolute[2:] if absolute.startswith("\\\\") else "\\\\?\\" + absolute
    return path


def _make_writable_and_retry(function, path, _info):
    try:
        os.chmod(path, stat.S_IWRITE | stat.S_IREAD | (stat.S_IEXEC if os.path.isdir(path) else 0))
        function(path)
    except OSError:
        pass


def remove(path):
    """Deletes one file, link, or tree. Returns (bytes freed, error message or None)."""
    st = lstat(path)
    if st is None:
        return 0, None
    target = long_path(path)
    try:
        if stat.S_ISDIR(st.st_mode) and not is_link(st):
            size = tree(path).size
            shutil.rmtree(target, onerror=_make_writable_and_retry)
            left = tree(path).size if os.path.lexists(path) else 0
            return max(size - left, 0), ("partly removed: some files are in use or protected" if left else None)
        size = 0 if is_link(st) else allocated(st)
        try:
            os.unlink(target)
        except PermissionError:
            os.chmod(target, stat.S_IWRITE | stat.S_IREAD)
            os.unlink(target)
        return size, None
    except OSError as error:
        return 0, f"{type(error).__name__}: {error}"


SPECIAL_TEMP_NAMES = (
    ".X", ".ICE-unix", ".font-unix", ".Test-unix",  # .X matches every X server lock and socket folder
    "systemd-private-", "snap-private-tmp", "tmux-", "ssh-", "pulse-", ".com.google.Chrome", "com.apple.",
    "dbus-", "krb5cc", "gnupg", "vscode-", "jetbrains", ".s.PGSQL",
)


def empty_folder(path, older_than_days=None, keep_names=SPECIAL_TEMP_NAMES):
    """Deletes the entries of a folder, keeping the folder. Skips sockets, locks, and entries touched recently."""
    freed, errors, removed = 0, [], 0
    cutoff = time.time() - older_than_days * DAY if older_than_days else None
    try:
        entries = list(os.scandir(path))
    except OSError as error:
        return 0, 0, [f"{path}: {error}"]
    for entry in entries:
        if any(entry.name.startswith(prefix) for prefix in keep_names):
            continue
        st = lstat(entry.path)
        if st is None or stat.S_ISSOCK(st.st_mode) or stat.S_ISFIFO(st.st_mode):
            continue
        if cutoff is not None:
            newest = max(st.st_mtime, st.st_atime)  # read recently means a program may still use it
            if stat.S_ISDIR(st.st_mode) and not is_link(st):
                newest = max(newest, tree(entry.path).newest)
            if newest > cutoff:
                continue
        size, error = remove(entry.path)
        freed += size
        if error:
            errors.append(f"{entry.path}: {error}")
        elif not os.path.lexists(entry.path):
            removed += 1
    return freed, removed, errors


def disk_usage(path):
    try:
        usage = shutil.disk_usage(path)
        return {"total": usage.total, "used": usage.used, "free": usage.free}
    except OSError:
        return {"total": 0, "used": 0, "free": 0}


def run_exists(binary):
    return shutil.which(binary) is not None


def run(argv, timeout=60, shell=False):
    """Runs a read-only probe. Returns stdout, or None when the tool is missing, fails, or times out."""
    if not shell and not shutil.which(argv[0]):
        return None
    try:
        completed = subprocess.run(
            argv, shell=shell, capture_output=True, text=True, timeout=timeout,
            encoding="utf-8", errors="replace", stdin=subprocess.DEVNULL,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if completed.returncode != 0:
        return None
    return completed.stdout


def is_elevated():
    if IS_WINDOWS:
        try:
            import ctypes
            return bool(ctypes.windll.shell32.IsUserAnAdmin())
        except (AttributeError, OSError):
            return False
    return hasattr(os, "geteuid") and os.geteuid() == 0


def home():
    return Path.home()
