# Disk cleanup: <machine>

- **When:** <date and time>
- **System:** <Windows 11 / Ubuntu 24.04 / macOS 15>
- **Level:** <safe | aggressive | yolo>
- **Automatic mode:** <on | off>
- **Drives cleaned:** <C:, D:>
- **Drives ignored:** <G: Google Drive (volume label), \\nas\share (network)>

## Result

| Drive | Free before | Free after | Gained |
|-------|-------------|------------|--------|
| <C:> | <9.6 GB> | <61.2 GB> | <51.6 GB> |

## Freed by category

| Category | Freed | Items |
|----------|-------|-------|
| <Caches> | <29.9 GB> | <8> |

## Skipped

| Path | Reason |
|------|--------|
| <path> | <in use / changed since the scan / protected> |

## Pending

| Id | Item | Size | Why | Command |
|----|------|------|-----|---------|
| <c58c079f77> | <journald has no size limit> | <stops regrowth> | <needs root> | `<command>` |

## Next level

<What aggressive or yolo would free, from the scan, and what the user gives up.>

## Not verified

- <Tools missing, folders unreadable, estimates that stayed estimates.>

## Files

- Scan: `~/.gti/disk-cleanup/<machine>/scans/<stamp>/report.md`
- Cleanup: `~/.gti/disk-cleanup/<machine>/cleanups/<stamp>/report.md`
- Manifest: `~/.gti/disk-cleanup/<machine>/cleanups/<stamp>/manifest.jsonl`
