# Records

- Hosts, versions and listeners: `infra/Inventory.md`. Update it in the same work as any change to what is listening.
- Change notes: one short entry in the run folder under `.gti/tmp/<run>/`, with the checked-on date and what was verified.
- Backups: record the exact path of a backup when one is kept. Delete non-database backups only after the change is verified; leave database backups for the user to confirm.
- Secret values: never recorded. Store a path and a key name only.

A record with no checked-on date is not evidence that anything was verified.
