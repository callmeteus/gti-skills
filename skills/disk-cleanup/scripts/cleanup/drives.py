"""Drives and mounts: which ones exist, which one holds the system, and which ones are never touched."""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass, field

from cleanup.model import normalize

# Folder names Google Drive for desktop shows at the root of its virtual drive, in several languages.
GOOGLE_DRIVE_ROOT_NAMES = {
    "my drive", "meu drive", "mi unidad", "mon drive", "meine ablage", "il mio drive", "mijn drive",
    "shared drives", "drives compartilhados", "unidades compartidas", "drives partages", "geteilte ablagen",
    "other computers", "outros computadores", "otros ordenadores", ".shortcut-targets-by-id",
}

CLOUD_FSTYPES = (
    "fuse.rclone", "rclone", "fuse.google-drive-ocamlfuse", "google-drive-ocamlfuse", "fuse.gdfs",
    "fuse.gcsfuse", "fuse.s3fs", "fuse.onedriver", "fuse.dropbox", "googledrivefs", "drivefs",
)

NETWORK_FSTYPES = (
    "nfs", "nfs4", "cifs", "smb", "smb3", "smbfs", "afpfs", "webdav", "davfs", "fuse.sshfs", "sshfs",
    "9p", "ceph", "glusterfs", "fuse.gvfsd-fuse", "fuse.portal", "fuse.kio-fuse",
)


@dataclass
class Drive:
    id: str                               # "C:", "/", "/dev/sdb1", "/Volumes/Data"
    mountpoints: list = field(default_factory=list)
    label: str = ""
    fstype: str = ""
    kind: str = "fixed"                  # fixed, removable, network, cloud, optical, virtual
    total: int = 0
    free: int = 0
    system: bool = False
    excluded: bool = False
    exclude_reason: str = ""

    @property
    def root(self):
        return self.mountpoints[0] if self.mountpoints else self.id

    def to_dict(self):
        data = asdict(self)
        data["root"] = self.root
        return data


def google_drive_reason(label="", fstype="", mountpoint="", root_names=(), registry_mounts=()):
    """Returns why a drive is a Google Drive mount, or an empty string. Google Drive may use any letter."""
    label_n, fstype_n, mount_n = normalize(label), normalize(fstype), normalize(mountpoint)
    if "google drive" in label_n or label_n in {"googledrive", "gdrive"}:
        return f"volume label is {label!r}"
    if "google" in fstype_n or "drivefs" in fstype_n.replace(" ", ""):
        return f"file system is {fstype!r}"
    if any(normalize(fs) == fstype_n for fs in CLOUD_FSTYPES if "google" in fs or "gdfs" in fs):
        return f"file system is {fstype!r}"
    for mount in registry_mounts:
        if mount and normalize(mount).rstrip("\\/:") == mount_n.rstrip("\\/:"):
            return "Google Drive for desktop registry names this mount point"
    tail = mount_n.replace("\\", "/").rstrip("/").rsplit("/", 1)[-1]
    if tail.startswith(("googledrive", "google drive", "gdrive", "google-drive")) or "google-drive:" in mount_n:
        return f"mount point is {mountpoint!r}"
    names = {normalize(name) for name in root_names}
    hits = names & GOOGLE_DRIVE_ROOT_NAMES
    if hits:
        return f"root holds {', '.join(sorted(hits))}, the Google Drive layout"
    return ""


def cloud_or_network_reason(fstype="", mountpoint=""):
    fstype_n = normalize(fstype)
    if fstype_n in {normalize(fs) for fs in CLOUD_FSTYPES}:
        return f"cloud mount ({fstype}): deleting here deletes in the cloud"
    if fstype_n in {normalize(fs) for fs in NETWORK_FSTYPES} or "/gvfs" in mountpoint:
        return f"network or remote mount ({fstype or 'gvfs'})"
    return ""


def classify(drive, root_names=(), registry_mounts=()):
    """Marks Google Drive, other cloud mounts, network shares, and optical media as excluded."""
    reason = google_drive_reason(drive.label, drive.fstype, drive.root, root_names, registry_mounts)
    if reason:
        drive.kind, drive.excluded, drive.exclude_reason = "cloud", True, f"Google Drive: {reason}"
        return drive
    reason = cloud_or_network_reason(drive.fstype, drive.root)
    if reason:
        drive.kind = "cloud" if "cloud" in reason else "network"
        drive.excluded, drive.exclude_reason = True, reason
        return drive
    if drive.fstype.startswith("fuse.") and drive.fstype not in ("fuse.ntfs-3g", "fuseblk"):
        drive.kind, drive.excluded, drive.exclude_reason = "virtual", True, f"FUSE mount ({drive.fstype}), not a local disk"
        return drive
    if drive.kind in ("network", "optical"):
        drive.excluded, drive.exclude_reason = True, f"{drive.kind} drive"
    return drive


def root_names(path, limit=200):
    try:
        with os.scandir(path) as entries:
            return [entry.name for _, entry in zip(range(limit), entries)]
    except OSError:
        return []


def select(drives, requested=(), auto=False):
    """Auto mode takes only the system drive. Otherwise the drives the user named, matched by id, root, or label.

    Excluded drives (Google Drive, cloud, network) are never selected, even when named.
    Returns (selected, refused) where refused lists (name, reason).
    """
    usable = [d for d in drives if not d.excluded]
    if auto or not requested:
        return [d for d in usable if d.system][:1], []
    selected, refused = [], []
    for name in requested:
        key = normalize(name).rstrip("\\/") or "/"
        match = None
        for drive in drives:
            names = {normalize(drive.id).rstrip("\\/") or "/", normalize(drive.label)}
            names |= {normalize(m).rstrip("\\/") or "/" for m in drive.mountpoints}
            if key in names or key + ":" in names:
                match = drive
                break
        if match is None:
            refused.append((name, "no such drive"))
        elif match.excluded:
            refused.append((name, match.exclude_reason))
        elif match not in selected:
            selected.append(match)
    return selected, refused
