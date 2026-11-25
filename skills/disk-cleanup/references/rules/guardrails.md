# Guardrails

These hold at every level, in every mode. The cleaner enforces them again right before each deletion, whatever the scan said.

## Never deleted

- **Google Drive, on any letter or mount point,** and every other cloud-synced folder: OneDrive, Dropbox, iCloud Drive, Box, `~/Library/CloudStorage`, rclone mounts, the Google Drive for desktop cache (`DriveFS`). Deleting there deletes in the cloud, and the local cache can hold files not uploaded yet.
- **Network shares** and other people's drives.
- **Keys, credentials, and wallets:** `.ssh`, `.gnupg`, `.aws`, `.kube`, `.azure`, gcloud config, keyrings, Keychains, Windows Credentials and Protect folders, password stores, Bitcoin and Ethereum folders.
- **Protected folders as a whole:** drive roots, the home folder, Desktop, Documents, Downloads, Pictures, Music, Videos, system folders (`C:\Windows`, Program Files, `/usr`, `/etc`, `/System`, `/Applications`), and the cache and config parents (`~/.cache`, `~/Library/Caches`, `AppData`). Their contents may be cleaned by a specific finding; the folder itself never.
- **User content,** except duplicate copies whose original is kept and verified. Large files are reported, never deleted by the skill.
- **The only copy of anything.** A duplicate set always keeps one file, and the kept copy is hashed again before its twin goes.
- **Anything behind a link or junction.** Links are never followed during the scan and never deleted.
- **Files inside git repositories** as duplicates, and build folders that git tracks.
- **Program files, libraries, and SDKs** as duplicates: only user content (documents, images, video, audio, archives, installers, 3D and project files) is checked.
- **Paths in the `exclude` preference.**

## Never done

- Never elevate, never ask for or type a password, never accept an EULA or license for the user. Admin items become pending commands.
- Never run a setting change or an uninstall in automatic mode, and never without the user's yes for that item.
- Never prune Docker volumes, delete phone backups, or delete a duplicate whose twin is in a backup folder without the user naming it.
- Never delete files by hand from `WinSxS`, `C:\Windows\Installer` (except the patch cache at yolo), `/var/lib/docker`, snap or flatpak folders, Time Machine or Timeshift snapshots, or APFS snapshots: their own tools do it (Dism, docker, snap, flatpak, tmutil, Timeshift).
- Never clean a drive the user did not choose, and in automatic mode never anything but the system drive.
- Never use a scan older than 24 hours without the user saying so.

## Why the order is scan, choose, clean

Files change between the scan and the deletion. The cleaner checks each path again, refuses anything that changed category (a link where a folder was, a duplicate whose content changed), and writes every deletion and every refusal to `manifest.jsonl`, so the user can see exactly what happened.
