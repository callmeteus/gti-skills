Tests that an apply syncs by stable ID with a dry-run diff instead of deleting and recreating.
Topic 10 (upsert apply): delete-all resets alert state and leaves production empty on a partial failure.
The state checks prove the sync script upserts and previews a diff and all three alerts survived.
The transcript forbids delete-all language and requires a dry run.
