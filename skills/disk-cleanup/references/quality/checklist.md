# Checklist before the report

Mark each item done, failing, not applicable, or not checked.

- [ ] Automatic mode on or off, the level, and the drives were stated at the start.
- [ ] Google Drive and other cloud or network mounts were excluded, and the report names them.
- [ ] Without automatic mode, the user chose the drives and the level, or the request named them.
- [ ] In automatic mode, only the system drive was scanned and cleaned.
- [ ] Every deletion came from a scan under 24 hours old, after a dry run.
- [ ] Nothing above the chosen level was cleaned.
- [ ] Settings and uninstalls ran only with the user's yes for each item, never in automatic mode.
- [ ] Docker volumes, phone backups, and duplicates in backup folders were cleaned only when the user named them.
- [ ] No password was asked for, no prompt was elevated by the agent, and no EULA was accepted for the user.
- [ ] Free space before and after per drive comes from the cleaner, not from estimates.
- [ ] Every skipped path and every pending item has its reason, and pending items have exact commands.
- [ ] Estimates are marked as estimates; the "Not verified" notes are in the report.
- [ ] Settings that prevent regrowth (journald, Docker logs, Storage Sense) were offered when found.
- [ ] Reports and manifests are under `~/.gti/disk-cleanup/<machine>/`, and nothing was written into the scanned folders.
