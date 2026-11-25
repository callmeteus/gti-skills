# Step 7: Report

Goal: the user knows what was freed, what is left, and what to do next.

Write the report from [../../assets/templates/cleanup-report.md](../../assets/templates/cleanup-report.md) to `~/.gti/disk-cleanup/<machine>/cleanups/<stamp>/summary.md`, next to the `report.md` the cleaner wrote, and give the user the summary in chat.

Include:

- **Free space** per drive, before and after, from the cleaner's report, not from the scan's estimate.
- **Freed per category**, biggest first.
- **Skipped paths:** files in use or changed since the scan, and why.
- **Pending:** every chosen item that did not run (admin, settings, uninstalls, manual steps, `auto: no` items), each with its id and exact command.
- **Next level:** what the next level up would free, from the scan, so the user can decide later.
- **Not verified:** the scan's notes (tools missing, folders unreadable, Prefetch unreadable), and estimates that stayed estimates.
- **Settings to prevent regrowth:** journald limits, Docker log limits, Storage Sense, when the scan found them.

Never present an estimate as a measurement. When the free space grew less than the freed total (files in use, hardlinks, snapshots holding blocks), say so and name the likely reason.
