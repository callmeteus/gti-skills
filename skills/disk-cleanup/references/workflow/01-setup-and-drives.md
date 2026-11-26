# Step 1 and 2: Setup and drives

Goal: know the user's saved choices, which drives exist, and which ones this run may touch.

## Preferences

```bash
python3 <skill-dir>/scripts/disk_cleanup.py prefs show
python3 <skill-dir>/scripts/disk_cleanup.py prefs set level agressivo
python3 <skill-dir>/scripts/disk_cleanup.py prefs set exclude "~/Videos/Raw,D:\Projects"
python3 <skill-dir>/scripts/disk_cleanup.py prefs unset level
python3 <skill-dir>/scripts/disk_cleanup.py prefs reset
```

| Key | Default | Meaning |
|-----|---------|---------|
| `level` | `safe` | Level used when the request names none |
| `auto` | `false` | Automatic mode. Set it only when the user asks for it to be saved |
| `exclude` | `[]` | Paths never deleted, added with commas; `unset exclude` clears them |
| `temp_age_days` | `2` | Temp entries newer than this (changed or read) stay |
| `download_age_days` | `30` | Installers and archives in Downloads older than this are candidates |
| `stale_project_days` | `90` | Build output of a project untouched this long is `aggressive`; newer is `yolo` |
| `stale_worktree_days` | `30` | Git worktrees with no change for this long are removal candidates |
| `unused_program_days` | `180` | Programs not used this long are listed |
| `min_duplicate_mb` | `1` | Smaller files are not checked for duplicates |
| `large_file_mb` | `500` | Files at least this large appear in the largest files list |
| `min_finding_mb` | `1` | Smaller targets are not reported |

Every `set` prints the old and the new value: repeat both to the user. Never store anything secret there.

At the start of every run, say: the level, whether automatic mode is on, and which drives will be scanned.

## Drives

```bash
python3 <skill-dir>/scripts/disk_cleanup.py drives
python3 <skill-dir>/scripts/disk_cleanup.py drives --json
```

The system drive is the one the operating system runs from: `%SystemDrive%` on Windows (usually `C:`), the device mounted at `/` on Linux (with `/home` when it is a subvolume or folder of the same device), and the Macintosh HD volume with its Data volume on macOS.

Marked `EXCLUDED` and never scanned or cleaned, even when the user names them:

- **Google Drive on any letter or path:** volume label "Google Drive", the Google Drive folder layout at the root (My Drive, Meu Drive, Shared drives, Drives compartilhados, Other computers, `.shortcut-targets-by-id`), a mount point Google Drive for desktop declares in the registry, a Google file system type, or an rclone, google-drive-ocamlfuse, or gvfs Google mount.
- **Other cloud mounts:** rclone, s3fs, gcsfuse, onedriver, Dropbox FUSE. Deleting there deletes in the cloud.
- **Network shares:** SMB, NFS, SSHFS, WebDAV, gvfs.
- **Optical drives and virtual FUSE mounts.**

When a drive the user expected is not listed or is excluded, show the reason from the table. When the user insists on a Google Drive mount, explain that deleting there deletes the file in Google Drive for every device, and that cleaning Google Drive belongs in Google Drive itself.

## Asking

Unless automatic mode is on or the request already says, ask one question with every usable drive as an option (label, free space, total), the system drive selected first. Multiple drives may be chosen. Automatic mode always uses only the system drive and says so.
