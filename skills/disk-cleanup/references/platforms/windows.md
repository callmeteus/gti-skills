# Windows

Run the script with `python` or `py -3`. Windows 10 and 11.

## Drives and Google Drive

Drive letters come from the Win32 API (`GetLogicalDrives`, `GetDriveTypeW`, `GetVolumeInformationW`). The system drive is `%SystemDrive%`, usually `C:`.

Google Drive for desktop mounts a virtual drive, `G:` by default but any free letter when `G:` is taken or the user changed it. It is excluded when any of these is true:

- The volume label contains "Google Drive".
- The root holds the Google Drive layout: My Drive or Meu Drive, Shared drives or Drives compartilhados, Other computers, `.shortcut-targets-by-id`.
- A `DefaultMountPoint` or other mount value under `HKCU` or `HKLM` `Software\Google\DriveFS`, or the `Policies` key, names the letter.

`%LOCALAPPDATA%\Google\DriveFS` (its cache, which can hold files not uploaded yet), OneDrive folders (`%OneDrive%`, `%OneDriveCommercial%`), Dropbox, iCloudDrive, and Box are never touched. OneDrive files that are online-only are reparse points and are skipped.

## Speed

- The scan sizes whole folders with Sysinternals `du64.exe` or `du.exe` when it is on `PATH` and its EULA was already accepted by the user (registry `HKCU\Software\Sysinternals\Du`, `EulaAccepted` = 1). The skill never passes `-accepteula`. Without it, the Python walk is used.
- Never size folders with PowerShell `Get-ChildItem -Recurse | Measure-Object` or Explorer properties: they are many times slower.
- The data walk covers the whole chosen drive, skipping `Windows`, `Program Files`, `ProgramData`, `$Recycle.Bin`, `System Volume Information`, `Recovery`, `Windows.old`, other users' profiles, and cloud folders.

## Admin

Items marked `admin` need an elevated prompt (Run as administrator). The skill never elevates; when the user wants them, they open an elevated terminal and run the agent there, or run the commands shown in the report. Without elevation, Prefetch is unreadable, so only programs opened from Start or Explorer have a last-use date; the others are left out of the unused list, not put in it.

## What is checked

| Category | Items |
|----------|-------|
| Temp | `%TEMP%`, `C:\Windows\Temp` (admin) |
| Caches | Thumbnail and icon caches, INetCache, Chrome, Edge, Brave, Vivaldi, Firefox, Opera, Electron apps in `%APPDATA%`, DirectX, NVIDIA, AMD, and Intel shader caches, pip, uv, Poetry, npm, Yarn, Go, Bun, node-gyp, pnpm, Gradle, Cargo, JetBrains, Playwright, Cypress, new Teams, NuGet (`dotnet nuget locals all --clear`), Conda, Maven, Hugging Face, PyTorch, Steam shader cache |
| Logs | `%LOCALAPPDATA%\CrashDumps`, WER archives (user and system), Minidump, LiveKernelReports, `MEMORY.DMP`, old CBS `.cab` files |
| Trash | `Clear-RecycleBin -DriveLetter <X> -Force` for each chosen drive |
| System | Delivery Optimization cache, `SoftwareDistribution\Download`, `$Windows.~BT`, `$Windows.~WS`, `$GetCurrent`, `ESD\Download`, `Dism /StartComponentCleanup` (and `/ResetBase` at yolo), `Installer\$PatchCache$` at yolo, Windows.old (manual) |
| Config | `hiberfil.sys` (`powercfg /h /type reduced` or `/h off`), page file far above RAM, restore point storage over 10% (`vssadmin resize shadowstorage`), Windows Search index over 2 GB, Storage Sense off, WSL and Docker `.vhdx` over 10 GB, CompactOS and reserved storage when under 15% free |
| Programs | Uninstall registry keys (HKLM, WOW6432Node, HKCU); last use from Prefetch (elevated) and UserAssist (programs opened from Start or Explorer, no admin needed); size from `EstimatedSize`. Listed only with a real last-use date; runtimes, updates, drivers, anti-cheat, sync clients, and plugins without a date are never listed |

## Manual steps

- **Windows.old:** Settings > System > Storage > Temporary files > Previous Windows installation(s). Removing it by hand needs ownership changes; use Settings or `cleanmgr /d C:`.
- **WSL disks:** `wsl --shutdown`, then `wsl --manage <distro> --set-sparse true` (WSL 2.0 or newer), or compact with `Optimize-VHD -Path <file> -Mode Full` (Hyper-V module, elevated). For Docker Desktop, prune first, then lower the disk limit in Settings > Resources > Advanced.
- **Page file:** System Properties > Advanced > Performance > Settings > Advanced > Virtual memory > System managed size.
- **Store apps:** not listed by the scan; Settings > Apps > Installed apps sorted by size.

## Restore

| Change | Undo |
|--------|------|
| Hibernation reduced or off | `powercfg /h /type full` or `powercfg /h on` |
| Restore point limit | `vssadmin resize shadowstorage /for=C: /on=C: /maxsize=<old>%` |
| Storage Sense on | Settings > System > Storage > Storage Sense |
| CompactOS | `compact /compactos:never` |
| Reserved storage | `DISM /Online /Set-ReservedStorageState /State:Enabled` |
