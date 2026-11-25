# Step 6: Clean

Goal: delete exactly what was chosen, check every path again first, and log every deletion.

## Run

Always a dry run first; show it to the user when they are present. Then the same command with `--apply`:

```bash
python3 <skill-dir>/scripts/disk_cleanup.py clean --ids 0ce67e0a8d 64e3cfc743 --level aggressive
python3 <skill-dir>/scripts/disk_cleanup.py clean --ids 0ce67e0a8d 64e3cfc743 --level aggressive --apply
python3 <skill-dir>/scripts/disk_cleanup.py clean --categories temp caches logs --level safe --run-commands --apply
python3 <skill-dir>/scripts/disk_cleanup.py clean --ids c58c079f77 --allow-system-changes --level safe --apply
python3 <skill-dir>/scripts/disk_cleanup.py clean --auto --level safe --run-commands --apply
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--scan` | `latest` | A `scan.json`, or the newest scan of this machine |
| `--level` | saved, else `safe` | Highest level acted on |
| `--ids` | none | Findings the user approved |
| `--categories` | none | Every finding of these categories within the level |
| `--exclude-ids`, `--exclude-paths` | none | Keep these in this run |
| `--auto` | off | Every finding marked `auto` within the level; needs a scan made with `--auto` |
| `--run-commands` | off | Also run cleanup commands (apt-get clean, docker image prune, Dism) |
| `--allow-system-changes` | off | Run settings and uninstalls named in `--ids`; refused with `--auto` |
| `--allow-old-scan` | off | Use a scan older than 24 hours |
| `--apply` | off | Without it, nothing is deleted |

## What the cleaner checks before each deletion

- The path is absolute, still exists, and is not a link, junction, or cloud placeholder.
- It is not inside a denied folder: keys (`.ssh`, `.gnupg`), credentials, wallets, password stores, or any cloud-synced folder.
- It is not a protected folder or a parent of one: drive roots, the home folder, Documents, Desktop, Downloads, Pictures, system folders.
- It is not inside a path the user excluded.
- Its drive is known, not excluded, and was chosen for this scan.
- For duplicates: the kept copy still exists, and both copies still hash to the scanned digest.
- For temp folders: entries changed or read within `temp_age_days` stay, and so do sockets, locks, and session folders.

A path that fails a check is skipped and logged with the reason. A file in use is skipped and reported; nothing is forced.

## Commands, settings, and uninstalls

- **Commands** run one at a time, after the file deletions, and the freed space is measured as the change in free space on their drive.
- **Settings and uninstalls** run only with their id, `--allow-system-changes`, and the user's yes for that item. Items marked `manual` are instructions (a Settings page): walk the user through them instead.
- **Admin items** are skipped when the agent is not elevated; give the user the exact command for an elevated prompt.

## After a mistake

Deletions are permanent; the manifest says exactly what went where. Caches and build output regenerate. For a deleted duplicate, the kept copy in the manifest (`kept`) has the same content: copy it back.
