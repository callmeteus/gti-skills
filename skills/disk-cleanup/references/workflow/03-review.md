# Step 5: Review and choose

Goal: the user decides what goes, with sizes and risks in front of them. Nothing is deleted at this step.

## Present

From `report.md`, show:

1. The drives scanned and the ones ignored, with the reason (Google Drive, network).
2. The table of reclaimable space per category and level.
3. The biggest findings at the chosen level, with id, size, and risk.
4. Settings that waste space, each with what it frees and what the user gives up.
5. Programs not used, with size and last use.
6. The largest files and the space per folder, for the user to judge (never deleted by the skill).

Keep it short. One table per group, biggest first, ids in code format so the user can name them.

## Ask

Ask one multi-select question per group, recommended options first:

- **Files:** every category with findings at the chosen level, each with its size. The default for `safe` is all of them.
- **Duplicates:** show the kept copy and the deleted copies of the 10 biggest sets. Sets inside backup folders are separate and stay unless the user picks them.
- **Build output:** stale projects (aggressive) and active ones (yolo) as two options.
- **Settings:** one option per setting, with the risk in the description. Never preselected.
- **Programs:** one option per program, never preselected. An uninstall is the user's call.

Items marked `auto: no` (Docker volumes, phone backups, duplicates in backup folders) need the user to name them; say why.

When the user picks a level higher than the scan's level, there is no need to scan again: the scan already has every level.

## Automatic mode

Skip this step. Everything marked `auto` at the level is chosen; everything else is pending.
