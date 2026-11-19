# Operate checklist

One row per recurring failure pattern. Read the reference file before acting on that pattern. For the full rules, see `../operate/01-orient.md` through `../operate/06-learn.md`.

| # | Pattern | Do instead | Reference file |
|---|---------|------------|----------------|
| 1 | Defending a hypothesis against a stated fact | Treat the user's fact as ground truth, drop the contradicting hypothesis by name, and measure the symptom again before "fixed" | `../operate/03-diagnose.md` |
| 2 | Reinventing access in every session | Follow the documented path, never hand-roll boilerplate, and report the exact error when it fails | `../operate/01-orient.md`, `../operate/02-access.md` |
| 3 | Guessing identifiers | List real IDs, slugs, environments, and variable names from APIs, state, or the repo, then copy one | `../operate/03-diagnose.md` |
| 4 | Fighting a reconciler | Change only the source, never the live target, and pin applies to a fixed commit | `../operate/04-change.md` |
| 5 | Finding prerequisites host by host | Run one combined read-only preflight per target and pass the result to every subagent | `../operate/01-orient.md` |
| 6 | Fixed sleeps and blind retries | Wait on a condition with a timeout, keep one autoreload server, and read the full error after two identical failures | `../operate/03-diagnose.md` |
| 7 | Hiding stderr and the exit code | Keep stderr, use `pipefail`, print `exit=$?`, and send long output to a file before reading a slice | `../operate/03-diagnose.md` |
| 8 | Nested heredocs in remote shells | Put scripts longer than three lines in a file and start them with a hostname guard | `../operate/02-access.md` |
| 9 | One call per item | Loop over the fleet in one script that returns JSON and read the result once | `../operate/02-access.md` |
| 10 | Delete-all-then-recreate apply | Upsert by stable ID, show a dry-run diff, create before delete, and rename backups only on success | `../operate/04-change.md` |
| 11 | Stopping at diagnosis | Apply the reversible fix inside the request and verify it; a diagnosis is not done | `../operate/04-change.md` |
| 12 | Ignoring a settled name or structure | Search the repo for the old name and for existing files before creating or before saying done | `../operate/04-change.md` |
| 13 | Many addresses and keys for one target | Use the single documented address and credential from `hosts.md` and `access.md` | `../operate/01-orient.md` |
| 14 | Acting on the wrong machine | Name the target first, resolve nicknames, guard remote scripts, and announce only confirmed results | `../operate/01-orient.md`, `../operate/02-access.md`, `../operate/04-change.md` |
| 15 | Silent fallback or mock | Surface the real backend error and reproduce the exact failing request | `../operate/03-diagnose.md` |
| 16 | Installing before checking feasibility | Do the memory arithmetic first and never drop a stated requirement to pass a test | `../operate/01-orient.md`, `../operate/04-change.md` |
| 17 | Editing live config outside its generator | Change only the source and restate an order or priority as a list before applying it | `../operate/04-change.md` |
| 18 | Testing on a hand-written imitation | Run the same image or artifact as production with different variables | `../operate/04-change.md` |
| 19 | Fleet machines drifting apart | Fix the bootstrap or module first, then every existing machine, then compare them | `../operate/04-change.md` |
| 20 | Passwords in scripts and SSH-bound processes | Install an SSH key on first access and run services as units or containers with a restart policy | `../operate/02-access.md` |
| 21 | Secrets pasted in chat | Store by variable name or path, warn about the transcript once, and never echo a value or put one in a URL | `../operate/06-learn.md` |
| 22 | Investigation narrated as a record | Use a field table with one date, grouped tables, no narration, and a Not checked section | `../operate/05-records.md` |
| 23 | Session reused only on reads | Prefer read-only tools and their filter parameters and log every drop to a lower rung as an MCP gap | `../operate/01-orient.md`, `../operate/02-access.md`, `../operate/06-learn.md` |
| 24 | Named method replaced by a manual deploy | Treat the method as a requirement, stop when its path is missing, propose creating it, and list manual work as pending | `../operate/04-change.md` |
| 25 | Patching deploy output on the host | Change the script or its source and rerun it instead of editing host files by hand | `../operate/04-change.md` |
| 26 | Re-encoding and resending a failed script | Fix the local file and resend it by stdin or `scp`; never base64 the script into each command | `../operate/02-access.md` |
| 27 | Reading whole env or secret files | Read only key names with `grep -oE '^[A-Z0-9_]+='` and put generated secrets in the store named in `access.md` | `../operate/06-learn.md` |
| 28 | Change causes downtime | Plan rolling or zero-downtime first; if none exists, stop, say what goes down and the options, and ask | `../operate/04-change.md` |
| 29 | Change without a backup, or backups left behind | Back up state the source cannot rebuild, check the backup, delete non-database backups after verification, and keep database backups until the user confirms | `../operate/04-change.md` |
| 30 | Had to be told the method, naming, or tags | Discover the provisioning path, closest example, naming, and full tag set into `conventions.md`; use the project's path by default and ask only what the repository cannot answer | `../operate/01-orient.md`, `../operate/04-change.md`, `../operate/06-learn.md` |
