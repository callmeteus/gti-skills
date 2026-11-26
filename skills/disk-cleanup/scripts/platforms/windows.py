"""Windows: drive letters from the Win32 API, Google Drive for desktop on any letter, caches under AppData,
Windows Update leftovers, hibernation, restore points, WSL and Docker disks, and installed programs."""

from __future__ import annotations

import codecs
import glob
import ntpath
import os
import re
import string
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from cleanup import fsutil
from cleanup.drives import Drive, classify, root_names
from cleanup.model import SETTING, Finding, parse_human
from platforms.base import Command, Platform, Target, unused_program
from platforms.linux import DockerProbe

try:
    import winreg
except ImportError:  # imported on other systems by the tests
    winreg = None

DRIVE_TYPES = {2: "removable", 3: "fixed", 4: "network", 5: "optical", 6: "virtual"}
SYSTEM_ROOT_DIRS = {"windows", "program files", "program files (x86)", "programdata", "$recycle.bin",
                    "system volume information", "recovery", "$winreagent", "$windows.~bt", "$windows.~ws",
                    "windows.old", "perflogs", "config.msi", "msocache", "$getcurrent", "$sysreset", "boot",
                    "documents and settings", "onedrivetemp", "intel", "amd", "nvidia"}
UNINSTALL_KEYS = (
    ("HKLM", r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    ("HKLM", r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
    ("HKCU", r"Software\Microsoft\Windows\CurrentVersion\Uninstall"),
)
# Not programs a person opens: runtimes, updates, drivers, services, and parts other software needs.
SKIP_PROGRAMS = re.compile(
    r"(visual c\+\+|visual basic|runtime|redistributable|vcredist|\.net|windows sdk|software development kit|\bsdk\b|"
    r"\bKB\d{6,}\b|update for|security update|hotfix|microsoft update|update health|pc health|webview2|microsoft edge|"
    r"directx|driver|chipset|intel\(r\)|realtek|nvidia|amd software|physx|gameinput|xbox|maintenance service|"
    r"fonts|^vs_|visual studio installer|tools for office|service center|authorization manager|license|"
    r"vanguard|anti-?cheat|battleye|npcap|winfsp|google drive|password manager|senhas do google|"
    r"helper|bootstrapper|launcher service)", re.I)


def reg_values(hive, path):
    """Reads the values of one registry key as a dict. Empty when the key is missing or on other systems."""
    if winreg is None:
        return {}
    root = winreg.HKEY_LOCAL_MACHINE if hive == "HKLM" else winreg.HKEY_CURRENT_USER
    try:
        with winreg.OpenKey(root, path) as key:
            values, index = {}, 0
            while True:
                try:
                    name, value, _ = winreg.EnumValue(key, index)
                except OSError:
                    break
                values[name] = value
                index += 1
            return values
    except OSError:
        return {}


def reg_subkeys(hive, path):
    if winreg is None:
        return []
    root = winreg.HKEY_LOCAL_MACHINE if hive == "HKLM" else winreg.HKEY_CURRENT_USER
    try:
        with winreg.OpenKey(root, path) as key:
            names, index = [], 0
            while True:
                try:
                    names.append(winreg.EnumKey(key, index))
                except OSError:
                    break
                index += 1
            return names
    except OSError:
        return []


def google_drive_registry_mounts():
    """Mount points Google Drive for desktop or its admin policy declares, when they are in the registry."""
    mounts = []
    for hive, path in (("HKCU", r"Software\Google\DriveFS"), ("HKLM", r"SOFTWARE\Google\DriveFS"),
                       ("HKLM", r"SOFTWARE\Policies\Google\DriveFS"), ("HKCU", r"Software\Policies\Google\DriveFS")):
        for name, value in reg_values(hive, path).items():
            if "mount" in name.lower() and isinstance(value, str) and value.strip():
                mounts.append(value.strip())
    return mounts


def volume_info(root):
    """(label, file system) of a drive root, or None when the drive is not ready."""
    import ctypes
    label = ctypes.create_unicode_buffer(261)
    fs = ctypes.create_unicode_buffer(261)
    ok = ctypes.windll.kernel32.GetVolumeInformationW(ctypes.c_wchar_p(root), label, 261, None, None, None, fs, 261)
    return (label.value, fs.value) if ok else None


def total_ram():
    try:
        import ctypes

        class MemoryStatus(ctypes.Structure):
            _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                        ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                        ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                        ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                        ("sullAvailExtendedVirtual", ctypes.c_ulonglong)]
        status = MemoryStatus()
        status.dwLength = ctypes.sizeof(MemoryStatus)
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status))
        return status.ullTotalPhys
    except (AttributeError, OSError):
        return 0


def ps(command):
    return ["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command]


class Windows(Platform):
    name = "windows"
    program_usage_hint = ("Run the scan from an elevated prompt so Windows Prefetch can be read; without it only programs "
                          "opened from Start or Explorer have a date. Plugins (VST, AAX) never have one.")

    def __init__(self):
        super().__init__()
        self.system_drive = os.environ.get("SystemDrive", "C:").upper()
        self.local = Path(os.environ.get("LOCALAPPDATA", self.home / "AppData/Local"))
        self.roaming = Path(os.environ.get("APPDATA", self.home / "AppData/Roaming"))

    def list_drives(self):
        import ctypes
        kernel32 = ctypes.windll.kernel32
        mask = kernel32.GetLogicalDrives()
        registry_mounts = google_drive_registry_mounts()
        drives = []
        for index, letter in enumerate(string.ascii_uppercase):
            if not mask & (1 << index):
                continue
            root = f"{letter}:\\"
            kind = DRIVE_TYPES.get(kernel32.GetDriveTypeW(ctypes.c_wchar_p(root)), "fixed")
            info = volume_info(root) if kind != "optical" else None
            if info is None and kind != "network":
                continue
            label, fstype = info or ("", "")
            drive = Drive(id=f"{letter}:", mountpoints=[root], label=label, fstype=fstype, kind=kind,
                          system=f"{letter}:" == self.system_drive)
            names = root_names(root) if kind in ("fixed", "removable", "virtual") else ()
            classify(drive, names, registry_mounts)
            if not drive.excluded:
                usage = fsutil.disk_usage(root)
                drive.total, drive.free = usage["total"], usage["free"]
            drives.append(drive)
        return drives

    # Safety --------------------------------------------------------------------------------------
    def cloud_paths(self):
        h = self.home
        paths = [h / "Google Drive", h / "My Drive", h / "Meu Drive", h / "GoogleDrive", self.local / "Google/DriveFS",
                 h / "Dropbox", h / "iCloudDrive", h / "iCloud Drive", h / "Box", self.local / "Microsoft/OneDrive",
                 h / "Creative Cloud Files"]
        for variable in ("OneDrive", "OneDriveCommercial", "OneDriveConsumer"):
            if os.environ.get(variable):
                paths.append(Path(os.environ[variable]))
        paths += [Path(p) for p in glob.glob(str(h / "OneDrive*"))]
        return [str(p) for p in paths]

    def protected_paths(self):
        sd = self.system_drive + "\\"
        system = [sd, sd + "Windows", sd + "Windows\\System32", sd + "Windows\\WinSxS", sd + "Windows\\Installer",
                  sd + "Program Files", sd + "Program Files (x86)", sd + "ProgramData", sd + "Users",
                  sd + "Windows\\SoftwareDistribution", sd + "Recovery"]
        return super().protected_paths() + system + [str(self.local), str(self.roaming), str(self.home / "AppData"),
                                                     str(self.home / "OneDrive")]

    def denied_paths(self):
        return super().denied_paths() + [
            str(self.roaming / "Microsoft/Credentials"), str(self.local / "Microsoft/Credentials"),
            str(self.roaming / "Microsoft/Protect"), str(self.roaming / "Microsoft/SystemCertificates"),
            str(self.local / "Microsoft/Vault"), str(self.roaming / "Bitcoin"), str(self.roaming / "Ethereum"),
        ]

    def appdata_names(self):
        return super().appdata_names() | {"appdata"}

    def downloads_dir(self):
        values = reg_values("HKCU", r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders")
        value = values.get("{374DE290-123F-4565-9164-39C4925E467B}")
        if value:
            return Path(os.path.expandvars(value))
        return self.home / "Downloads"

    def data_roots(self, ctx, drive):
        return [drive.root]

    def walk_skip(self, ctx):
        skip = super().walk_skip(ctx)
        for drive in ctx.selected:
            for name in SYSTEM_ROOT_DIRS:
                skip.add(fsutil.norm(os.path.join(drive.root, name)))
        users = os.path.join(self.system_drive + "\\", "Users")
        try:
            for entry in os.scandir(users):
                if fsutil.norm(entry.path) != fsutil.norm(self.home):
                    skip.add(fsutil.norm(entry.path))
        except OSError:
            pass
        return skip

    # Targets -----------------------------------------------------------------------------------
    def targets(self, ctx):
        L, R, H = "%LOCALAPPDATA%", "%APPDATA%", "%USERPROFILE%"
        win = os.environ.get("SystemRoot", self.system_drive + "\\Windows")
        pdata = os.environ.get("ProgramData", self.system_drive + "\\ProgramData")
        chromium = []
        for browser in ("Google\\Chrome", "Microsoft\\Edge", "BraveSoftware\\Brave-Browser", "Vivaldi", "Chromium"):
            for sub in ("Cache", "Code Cache", "GPUCache"):
                chromium.append(f"{L}\\{browser}\\User Data\\*\\{sub}")
        return [
            Target("temp", "User temporary files older than the temp age", ("%TEMP%",), older_than_days="temp",
                   reason="Files left in %TEMP% by installers and programs that did not clean up."),
            Target("temp", "Windows temporary files older than the temp age", (f"{win}\\Temp",), older_than_days="temp",
                   admin=True),
            Target("caches", "Thumbnail and icon caches", (f"{L}\\Microsoft\\Windows\\Explorer\\thumbcache_*.db",
                                                           f"{L}\\Microsoft\\Windows\\Explorer\\iconcache_*.db"),
                   action="delete", restore="Explorer rebuilds thumbnails as folders are opened."),
            Target("caches", "Internet cache (INetCache)", (f"{L}\\Microsoft\\Windows\\INetCache",)),
            Target("caches", "Browser caches (Chrome, Edge, Brave, Vivaldi, Firefox, Opera)",
                   (*chromium, f"{L}\\Mozilla\\Firefox\\Profiles\\*\\cache2", f"{L}\\Opera Software\\Opera Stable\\Cache",
                    f"{R}\\Opera Software\\Opera Stable\\Cache")),
            Target("caches", "Electron app caches (VS Code, Slack, Discord, Teams)",
                   (f"{R}\\*\\Cache", f"{R}\\*\\Code Cache", f"{R}\\*\\GPUCache", f"{R}\\*\\CachedData",
                    f"{R}\\Microsoft\\Teams\\Service Worker\\CacheStorage")),
            Target("caches", "GPU shader caches (DirectX, NVIDIA, AMD, Intel)",
                   (f"{L}\\D3DSCache", f"{L}\\NVIDIA\\DXCache", f"{L}\\NVIDIA\\GLCache", f"{L}\\AMD\\DxCache",
                    f"{L}\\AMD\\DxcCache", f"{L}\\AMD\\GLCache", f"{L}\\Intel\\ShaderCache"),
                   restore="Games and apps rebuild shaders on next start."),
            Target("caches", "Developer package caches (pip, uv, Poetry, npm, Yarn, Go, Bun, node-gyp)",
                   (f"{L}\\pip\\Cache", f"{L}\\uv\\cache", f"{L}\\pypoetry\\Cache", f"{L}\\npm-cache\\_cacache",
                    f"{L}\\Yarn\\Cache", f"{L}\\go-build", f"{H}\\.bun\\install\\cache", f"{L}\\node-gyp\\Cache")),
            Target("caches", "New Teams cache", (f"{L}\\Packages\\MSTeams_8wekyb3d8bbwe\\LocalCache\\Microsoft\\MSTeams",),
                   level="aggressive", restore="Teams signs in again and downloads its cache."),
            Target("caches", "Developer tool caches (pnpm, Gradle, Cargo, JetBrains)",
                   (f"{L}\\pnpm\\store", f"{H}\\.gradle\\caches", f"{H}\\.cargo\\registry\\cache",
                    f"{H}\\.cargo\\registry\\src", f"{L}\\JetBrains\\*\\caches"),
                   level="aggressive", restore="Each tool downloads or rebuilds it on next use."),
            Target("caches", "Maven repository and machine learning model caches",
                   (f"{H}\\.m2\\repository", f"{H}\\.cache\\huggingface", f"{H}\\.cache\\torch"), level="yolo",
                   risk="Several GB are downloaded again; Maven artifacts installed only locally are lost."),
            Target("caches", "Steam shader cache", ("%ProgramFiles(x86)%\\Steam\\steamapps\\shadercache",),
                   level="aggressive", restore="Games rebuild shaders on next start."),
            Target("logs", "Crash dumps of programs", (f"{L}\\CrashDumps",)),
            Target("logs", "Windows Error Reporting archives", (f"{L}\\Microsoft\\Windows\\WER\\ReportArchive",
                                                                 f"{L}\\Microsoft\\Windows\\WER\\ReportQueue")),
            Target("logs", "System Windows Error Reporting archives", (f"{pdata}\\Microsoft\\Windows\\WER\\ReportArchive",
                                                                        f"{pdata}\\Microsoft\\Windows\\WER\\ReportQueue"),
                   admin=True),
            Target("logs", "System crash dumps", (f"{win}\\Minidump", f"{win}\\LiveKernelReports"), admin=True),
            Target("logs", "Full memory dump and old CBS logs", (f"{win}\\MEMORY.DMP", f"{win}\\Logs\\CBS\\*.cab"),
                   action="delete", admin=True),
            Target("system", "Delivery Optimization cache",
                   (f"{win}\\ServiceProfiles\\NetworkService\\AppData\\Local\\Microsoft\\Windows\\DeliveryOptimization\\Cache",),
                   admin=True, reason="Update pieces kept to share with other PCs."),
            Target("system", "Windows Update downloads", (f"{win}\\SoftwareDistribution\\Download",), level="aggressive",
                   admin=True, risk="Do it after a restart, when no update waits to install.",
                   restore="Windows Update downloads what it still needs."),
            Target("system", "Windows upgrade leftovers", (f"{self.system_drive}\\$Windows.~BT", f"{self.system_drive}\\$Windows.~WS",
                                                           f"{self.system_drive}\\$GetCurrent", f"{self.system_drive}\\ESD\\Download"),
                   action="delete", level="aggressive", admin=True, restore="Downloaded again by the next upgrade."),
            Target("system", "Windows Installer patch cache", (f"{win}\\Installer\\$PatchCache$",), level="yolo",
                   admin=True, risk="Repairing or patching some MSI programs may ask for the original installer."),
        ]

    # Commands ----------------------------------------------------------------------------------
    def commands(self, ctx):
        docker = DockerProbe("docker")
        commands = []
        for drive in ctx.selected:
            letter = drive.id.rstrip(":")
            bin_path = os.path.join(drive.root, "$Recycle.Bin")
            commands.append(Command(
                "trash", f"Recycle Bin on {drive.id}", ps(f"Clear-RecycleBin -DriveLetter {letter} -Force -ErrorAction SilentlyContinue"),
                level="aggressive", binary="powershell", measure=(bin_path,), on=drive.root,
                reason="Files the user already deleted.", restore="Not recoverable after emptying."))
        commands += [
            Command("system", "Windows component store cleanup", ["Dism.exe", "/Online", "/Cleanup-Image", "/StartComponentCleanup"],
                    binary="Dism.exe", admin=True, probe=winsxs_estimate, on=self.system_drive + "\\",
                    reason="Removes superseded versions of Windows components."),
            Command("system", "Component store reset (no update uninstall afterwards)",
                    ["Dism.exe", "/Online", "/Cleanup-Image", "/StartComponentCleanup", "/ResetBase"], level="yolo",
                    binary="Dism.exe", admin=True, probe=winsxs_estimate, on=self.system_drive + "\\",
                    risk="Installed updates can no longer be uninstalled."),
            Command("caches", "NuGet package caches", ["dotnet", "nuget", "locals", "all", "--clear"], level="aggressive",
                    binary="dotnet", measure=("%USERPROFILE%\\.nuget\\packages", "%LOCALAPPDATA%\\NuGet\\v3-cache",
                                              "%LOCALAPPDATA%\\NuGet\\plugins-cache"),
                    restore="dotnet restore downloads the packages again."),
            Command("dev", "Dangling Docker images", ["docker", "image", "prune", "-f"], binary="docker",
                    probe=docker.reclaim("Images", dangling=True)),
            Command("dev", "Docker build cache", ["docker", "builder", "prune", "-f"], level="aggressive", binary="docker",
                    probe=docker.reclaim("Build Cache")),
            Command("dev", "Every unused Docker image, stopped container, and network", ["docker", "system", "prune", "-a", "-f"],
                    level="yolo", binary="docker", probe=docker.reclaim("Images", "Containers"),
                    risk="Stopped containers and their writable layers are deleted; images are pulled again."),
            Command("dev", "Unused Docker volumes", ["docker", "volume", "prune", "-a", "-f"], level="yolo", binary="docker",
                    auto=False, probe=docker.reclaim("Local Volumes"),
                    risk="Volumes hold databases and uploads. Never run without the user's explicit yes."),
            Command("caches", "Conda package cache", ["conda", "clean", "--all", "-y"], level="aggressive", binary="conda",
                    measure=("%USERPROFILE%\\miniconda3\\pkgs", "%USERPROFILE%\\anaconda3\\pkgs", "%USERPROFILE%\\miniforge3\\pkgs")),
        ]
        return commands

    # System and config -------------------------------------------------------------------------
    def system_findings(self, ctx):
        old = Path(self.system_drive + "\\Windows.old")
        if not old.is_dir() or not ctx.on_selected(str(old)):
            return []
        size = fsutil.tree(old).size
        return [Finding(
            category="system", title="Previous Windows installation (Windows.old)", action=SETTING, level="aggressive",
            admin=True, size=size, paths=[str(old)],
            manual=True, command="Settings > System > Storage > Temporary files > Previous Windows installation(s), or cleanmgr /d C:",
            reason="Kept for rolling back an upgrade; Windows deletes it after 10 days.",
            risk="Going back to the previous Windows version is no longer possible.",
            restore="Not recoverable.")]

    def config_findings(self, ctx):
        sd = self.system_drive + "\\"
        findings = []
        ram = total_ram()
        hib = fsutil.lstat(sd + "hiberfil.sys")
        if hib and hib.st_size > 1024 ** 3:
            findings.append(Finding(
                category="config", title="Hibernation file at reduced size", action=SETTING, level="aggressive", admin=True,
                size=max(hib.st_size - int(ram * 0.2), 0), estimate=True, command=["powercfg", "/h", "/type", "reduced"],
                reason=f"hiberfil.sys uses {hib.st_size // 1024 ** 3} GB. The reduced type keeps Fast Startup but not hibernation.",
                risk="Hibernate disappears from the power menu.", restore="powercfg /h /type full"))
            findings.append(Finding(
                category="config", title="Hibernation off", action=SETTING, level="yolo", admin=True, size=hib.st_size,
                command=["powercfg", "/h", "off"], reason=f"Frees all {hib.st_size // 1024 ** 3} GB of hiberfil.sys.",
                risk="No hibernation and no Fast Startup; on a laptop, a sleeping battery can run out and lose the session.",
                restore="powercfg /h on"))
        page = fsutil.lstat(sd + "pagefile.sys")
        if page and ram and page.st_size > max(ram * 1.5, 16 * 1024 ** 3):
            findings.append(Finding(
                category="config", title="Page file is larger than needed", action=SETTING, level="yolo", admin=True,
                size=page.st_size - ram, estimate=True,
                manual=True, command="System Properties > Advanced > Performance Settings > Advanced > Virtual memory: "
                        "System managed size",
                reason=f"pagefile.sys is {page.st_size // 1024 ** 3} GB on {ram // 1024 ** 3} GB of RAM, usually a fixed size set by hand.",
                risk="Programs that need a lot of memory may fail; crash dumps may need page file space.",
                restore="Set the old size again in the same dialog."))
        findings += shadow_storage(ctx, self.system_drive)
        for name in ("Windows.edb", "Windows.db"):
            index = Path(os.environ.get("ProgramData", sd + "ProgramData")) / "Microsoft/Search/Data/Applications/Windows" / name
            st = fsutil.lstat(index)
            if st and st.st_size > 2 * 1024 ** 3:
                findings.append(Finding(
                    category="config", title="Windows Search index is over 2 GB", action=SETTING, level="aggressive",
                    admin=True, size=st.st_size, estimate=True,
                    manual=True, command="Control Panel > Indexing Options > Advanced > Rebuild; remove build and cache folders from the indexed locations",
                    reason="The index covers folders full of build output or caches.",
                    risk="Search is incomplete until the rebuild finishes.", restore="Add the locations back in Indexing Options."))
        policy = reg_values("HKCU", r"Software\Microsoft\Windows\CurrentVersion\StorageSense\Parameters\StoragePolicy")
        if policy.get("01") != 1:
            findings.append(Finding(
                category="config", title="Storage Sense is off", action=SETTING, level="safe", estimate=True,
                command=["reg", "add", r"HKCU\Software\Microsoft\Windows\CurrentVersion\StorageSense\Parameters\StoragePolicy",
                         "/v", "01", "/t", "REG_DWORD", "/d", "1", "/f"],
                reason="Storage Sense empties temp files and the Recycle Bin on a schedule; it is off.",
                restore="Turn it off in Settings > System > Storage."))
        findings += virtual_disks(self.local)
        usage = fsutil.disk_usage(sd)
        if usage["total"] and usage["free"] / usage["total"] < 0.15:
            findings.append(Finding(
                category="config", title="Compress Windows system files (CompactOS)", action=SETTING, level="yolo",
                admin=True, size=2 * 1024 ** 3, estimate=True, command=["compact", "/compactos:always"],
                reason="The system drive has under 15% free; CompactOS saves about 2 to 4 GB.",
                risk="Slightly more CPU when loading system files.", restore="compact /compactos:never"))
            findings.append(Finding(
                category="config", title="Reserved storage for updates", action=SETTING, level="yolo", admin=True,
                size=7 * 1024 ** 3, estimate=True, command=["DISM", "/Online", "/Set-ReservedStorageState", "/State:Disabled"],
                reason="Windows reserves about 7 GB for updates; with the drive this full it may be worth taking back.",
                risk="Updates can fail for lack of space.", restore="DISM /Online /Set-ReservedStorageState /State:Enabled"))
        return findings

    # Programs ----------------------------------------------------------------------------------
    def programs(self, ctx):
        prefetch = prefetch_times()
        assist = userassist_times()
        entries = []
        for hive, path in UNINSTALL_KEYS:
            for sub in reg_subkeys(hive, path):
                values = reg_values(hive, f"{path}\\{sub}")
                name = str(values.get("DisplayName", "")).strip()
                if not name or values.get("SystemComponent") == 1 or values.get("ParentKeyName") \
                        or str(values.get("ReleaseType", "")).lower() in ("update", "hotfix", "security update"):
                    continue
                entries.append((hive, values))

        def inspect(item):
            hive, values = item
            name = str(values["DisplayName"]).strip()
            location = str(values.get("InstallLocation") or "").strip().strip('"')
            icon = str(values.get("DisplayIcon") or "").split(",")[0].strip().strip('"')
            size = int(values.get("EstimatedSize") or 0) * 1024
            if not size and location and os.path.isdir(location):
                size = fsutil.tree(location).size
            exes = program_exes(location, icon)
            hits = [(prefetch[e], "Windows Prefetch") for e in exes if e in prefetch]
            hits += [(assist[e], "opened from Start or Explorer (UserAssist)") for e in exes if e in assist]
            last, source = max(hits) if hits else (None, "")
            uninstall = str(values.get("UninstallString") or values.get("QuietUninstallString") or "").strip()
            if not uninstall:
                return None
            return unused_program(
                ctx, name, size, last, source, uac_launch(uninstall), shell=True,
                risk="Settings and data of the program may be removed with it. Windows may ask for permission (UAC): "
                     "the user approves it in the dialog, never the agent.",
                details={"publisher": values.get("Publisher"), "version": values.get("DisplayVersion"),
                         "location": location, "uninstall_string": uninstall, "system_part": bool(SKIP_PROGRAMS.search(name))})

        with ThreadPoolExecutor(max_workers=ctx.jobs) as pool:
            found = [f for f in pool.map(inspect, entries) if f]
        return found


def prefetch_times():
    """EXE name (upper case) -> newest run time, from C:\\Windows\\Prefetch. Empty without admin rights."""
    folder = os.path.join(os.environ.get("SystemRoot", "C:\\Windows"), "Prefetch")
    times = {}
    for path in glob.glob(os.path.join(folder, "*.pf")):
        name = os.path.basename(path).rsplit("-", 1)[0].upper()
        st = fsutil.lstat(path)
        if st:
            times[name] = max(times.get(name, 0), st.st_mtime)
    return times


def uac_launch(command):
    """Runs an uninstaller through `start /wait`, which uses ShellExecute: an uninstaller that needs admin rights
    shows the Windows permission dialog (UAC) to the user instead of failing, and the call waits for it to finish."""
    return f'start "" /wait {command}'


def userassist_times():
    """EXE name (upper case) -> last time it was opened from Start or Explorer. Readable without admin rights."""
    base = r"Software\Microsoft\Windows\CurrentVersion\Explorer\UserAssist"
    times = {}
    for guid in reg_subkeys("HKCU", base):
        for name, data in reg_values("HKCU", f"{base}\\{guid}\\Count").items():
            exe, when = parse_userassist(name, data)
            if exe and when:
                times[exe] = max(times.get(exe, 0), when)
    return times


def parse_userassist(name, data):
    """A UserAssist value: ROT13 path as the name, last run FILETIME at bytes 60-68 of the 72-byte data."""
    path = codecs.decode(str(name), "rot13")
    if not path.lower().endswith(".exe") or not isinstance(data, (bytes, bytearray)) or len(data) < 68:
        return None, None
    filetime = int.from_bytes(bytes(data[60:68]), "little")
    if not filetime:
        return None, None
    return ntpath.basename(path).upper(), filetime / 1e7 - 11644473600


def program_exes(location, icon):
    names = set()
    if icon.lower().endswith(".exe"):
        names.add(os.path.basename(icon).upper())
    if location and os.path.isdir(location):
        for pattern in ("*.exe", "*/*.exe"):
            for exe in glob.glob(os.path.join(glob.escape(location), pattern))[:50]:
                base = os.path.basename(exe).upper()
                if not re.search(r"(unins|uninst|setup|update|crash|helper|install)", base, re.I):
                    names.add(base)
    return names


def winsxs_estimate(ctx):
    return 0, True, {"note": "Dism /AnalyzeComponentStore shows the reclaimable size (elevated prompt)."}


def parse_shadow_storage(text):
    """`vssadmin list shadowstorage` (any language) -> [(used, allocated, maximum, maximum percent)]."""
    rows = []
    sizes = re.findall(r"([\d.,]+\s*[KMGT]?B)\s*\((\d+)\s*%\)", text, re.I)
    for index in range(0, len(sizes) - 2, 3):
        used, allocated, maximum = (parse_human(sizes[index + k][0]) for k in range(3))
        rows.append((used, allocated, maximum, int(sizes[index + 2][1])))
    return rows


def shadow_storage(ctx, system_drive):
    if not ctx.elevated:
        ctx.note("Restore point storage was not checked: vssadmin needs an elevated prompt.")
        return []
    out = fsutil.run(["vssadmin", "list", "shadowstorage"], timeout=30) or ""
    findings = []
    for used, _allocated, maximum, percent in parse_shadow_storage(out):
        if percent > 10 and used > 5 * 1024 ** 3:
            findings.append(Finding(
                category="config", title="Restore points may use over 10% of the drive", action=SETTING, level="aggressive",
                admin=True, size=max(used - maximum // max(percent, 1) * 5, 0), estimate=True,
                command=["vssadmin", "resize", "shadowstorage", f"/for={system_drive}", f"/on={system_drive}", "/maxsize=5%"],
                reason=f"Restore points use {used // 1024 ** 3} GB with a {percent}% limit.",
                risk="Fewer restore points are kept; the oldest go first.",
                restore=f"vssadmin resize shadowstorage /for={system_drive} /on={system_drive} /maxsize={percent}%"))
    return findings


def virtual_disks(local):
    patterns = [local / "Packages/*/LocalState/ext4.vhdx", local / "wsl/*/ext4.vhdx", local / "Docker/wsl/disk/*.vhdx",
                local / "Docker/wsl/data/ext4.vhdx", local / "Docker/wsl/main/ext4.vhdx"]
    findings = []
    for pattern in patterns:
        for path in glob.glob(str(pattern)):
            st = fsutil.lstat(path)
            if not st or st.st_size < 10 * 1024 ** 3:
                continue
            findings.append(Finding(
                category="config", title=f"WSL or Docker virtual disk never shrinks ({os.path.basename(os.path.dirname(path))})",
                action=SETTING, level="aggressive", admin=True, size=0, estimate=True, paths=[path],
                manual=True, command=f"wsl --shutdown; wsl --manage <distro> --set-sparse true  # or: Optimize-VHD -Path \"{path}\" -Mode Full",
                reason=f"The .vhdx is {st.st_size // 1024 ** 3} GB. Files deleted inside WSL or Docker stay allocated on Windows "
                       "until the disk is compacted or made sparse.",
                risk="WSL and Docker must be stopped while the disk is compacted.",
                restore="Nothing to restore; the disk grows again as needed.", details={"vhdx_size": st.st_size}))
    return findings
