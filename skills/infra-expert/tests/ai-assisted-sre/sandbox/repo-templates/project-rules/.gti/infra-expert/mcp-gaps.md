# MCP gaps

Fallbacks used because the project MCP has no tool for them yet. Add a line with the date and the command that was used.

| Date | Gap | Fallback |
|---|---|---|
| 2026-11-19 | No bulk config render | One `prod_ssh_exec` call per host with a reviewed script |
| 2026-11-19 | No backup listing | `prod_exec` with `ls` on the backup glob, then report the paths |
