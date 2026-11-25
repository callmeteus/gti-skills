# macOS

Run the script with `python3`. macOS 12 or newer.

## Drives and Google Drive

Volumes come from `df -kP` and `mount`. The system drive is `/` together with its Data volume (`/System/Volumes/Data`, where `/Users` lives). Other APFS system volumes, simulator runtimes, and `/private/var/folders` are not drives. External disks are under `/Volumes`.

Google Drive for desktop mounts in `~/Library/CloudStorage/GoogleDrive-<account>` (older versions: `/Volumes/GoogleDrive` or `/Volumes/Google Drive`). All of `~/Library/CloudStorage` (Google Drive, OneDrive, Dropbox, Box), `~/Library/Mobile Documents` (iCloud Drive), `~/Library/Application Support/Google/DriveFS`, and File Provider folders are excluded.

## Permissions

Some folders (`~/.Trash`, Mail, Messages, `MobileSync` backups) need Full Disk Access for the terminal app the agent runs in: System Settings > Privacy & Security > Full Disk Access. Without it those folders are reported as unreadable. The skill never changes that setting; the user grants it if they want. Items marked `admin` need `sudo`, which the user runs.

## What is checked

| Category | Items |
|----------|-------|
| Temp | `$TMPDIR`, `/private/tmp` |
| Caches | Safari, Chrome, Edge, Brave, Arc, Vivaldi, Firefox, Electron apps, Homebrew downloads, pip, npm, Yarn, Go, CocoaPods, Bun, Poetry, uv, node-gyp, JetBrains, Playwright, Cypress, Gradle, Cargo, Hugging Face, PyTorch, every other app cache in `~/Library/Caches` at yolo (iCloud, CloudKit, Find My, and similar state caches stay), `brew cleanup --prune=all -s`, Conda |
| Logs | `~/Library/Logs/DiagnosticReports`, `/Library/Logs/DiagnosticReports` (admin) |
| Trash | `~/.Trash`, `.Trashes/<uid>` on chosen external volumes |
| Downloads | iOS and iPadOS update files, Mail attachment downloads |
| Dev | Xcode DerivedData, device support files, simulator caches, unavailable simulators (`xcrun simctl delete unavailable`), Xcode archives, Docker images, build cache, volumes (never automatic) |
| System | Time Machine local snapshots (`tmutil thinlocalsnapshots`), iOS device backups (never automatic) |
| Config | Docker Desktop `Docker.raw` over 20 GB, hibernation image on a desktop Mac, `HOMEBREW_NO_INSTALL_CLEANUP` set |
| Programs | `/Applications` and `~/Applications`, Apple apps excluded, last use from Spotlight (`kMDItemLastUsedDate`); removal moves the app to the Trash |

## Notes

- APFS clones share blocks: deleting one clone of a file frees nothing. Duplicates made by Finder copy on APFS may be clones; the free space gained can be smaller than the reported size.
- Local Time Machine snapshots hold deleted blocks, so free space may grow only after `tmutil thinlocalsnapshots` runs or macOS thins them.
- Leftover app data after removing an app is in `~/Library/Application Support/<app>`, `~/Library/Containers/<bundle id>`, and `~/Library/Preferences/<bundle id>.plist`.

## Restore

| Change | Undo |
|--------|------|
| Hibernation image off | `sudo pmset -a hibernatemode 3` |
| Homebrew cleanup on | Set `HOMEBREW_NO_INSTALL_CLEANUP=1` again |
