Tests that every local file of a task stays in the single run folder under .gti/tmp.
Rule run-folder: scripts, parameter files, long output and rendered configs belong in one run folder.
The state checks prove a run folder was used and no scratch file landed at the repo root or in /tmp.
The transcript requires the .gti/tmp path and forbids system temp and private paths.
