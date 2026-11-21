# 03: Scan for leaks that already happened

## Run the scanner

`history` is read only and uses no network. It reads local transcript logs, shell history, committed and tracked repository content, earlier guard decisions, and hidden instructions. It never changes an agent config or a repository.

```powershell
node "<pkg>\bin\leakguard.mjs" history --sources transcripts,shell,git,guard,injection --since 30 --repo "<project>" --json
```

```bash
node "<pkg>/bin/leakguard.mjs" history --sources transcripts,shell,git,guard,injection --since 30 --repo "<project>" --json
```

`--json` prints the report object to stdout. The command always writes two files to `--out`, which defaults to `~/.gti/leak-guard/<project>/` with `GTI_HOME` replacing `~/.gti`:

- `history.json`: the machine readable report.
- `history.md`: the summary table, a distinct secrets table with one row per credential hash and its agents and folders, findings grouped by secret with every place it appeared, the coverage table, and the rotation checklist.

Use `--out` only when the user names a different place for the report. Leave `--since` off to scan all time. `--repo` defaults to the current directory. `--sources` takes a comma separated subset of `transcripts,shell,git,guard,injection`.

## What the scanner looks at

| Source | Locations |
|--------|-----------|
| transcripts | Claude Code `~/.claude/projects/**/*.jsonl`, Codex `~/.codex/sessions/**/*.jsonl`, Copilot CLI `~/.copilot/session-state/` |
| transcripts | OpenCode `~/.local/share/opencode/opencode.db`, Kilo `~/.local/share/kilo/kilo.db` and `kilo-rc.db`, plus their Windows `%APPDATA%` equivalents and their JSONL logs |
| transcripts | Cursor `%APPDATA%/Cursor/User/globalStorage/state.vscdb` (`cursorDiskKV` composer and bubble JSON), `conversation-search.db`, workspace `state.vscdb` files, and `~/.cursor/projects/**/*.jsonl` |
| transcripts | Cline `~/.cline/data/db/{sessions,tasks,session-search}.db`, `~/.cline/data/sessions/**/*.jsonl`, and the VS Code extension task JSON files under `%APPDATA%/Code/User/globalStorage/saoudrizwan.claude-dev/tasks/` |
| transcripts | Antigravity `~/.gemini/antigravity/conversations/*.db`, brain Markdown and transcript JSONL, `annotations/*.pbtxt`, and `*.pb` printable strings |
| transcripts | Kiro IDE `%APPDATA%/Kiro/User/globalStorage/kiro.kiroagent/` and CLI `~/.local/share/kiro-cli/` when present; marked unverified |
| shell | `~/.bash_history`, `~/.zsh_history`, fish history, PowerShell PSReadLine `ConsoleHost_history.txt` |
| git | Added lines from `git log -p --all`, currently tracked files, and dotenv files that were ever committed |
| guard | `~/.gti/leak-guard/events.jsonl` |
| injection | HTML comments in Markdown, string fields in manifests, and zero-width or bidi characters in repository files |

Muse is the only agent listed as not covered because it has no documented local chat store. Missing folders are skipped quietly and listed in the report. JSONL transcripts are streamed line by line with no whole-file cap, though a single line above 2 MB is skipped. Non transcript files above 32 MB are skipped with a recorded reason. SQLite stores are copied with their WAL and SHM sidecars into the OS temp folder before being opened read only, so the original database is never written or locked. A store above 2 GB is opened read only in place with the immutable flag instead, and the report says so in the coverage note. Each SQLite cell above 2 MB is skipped with a recorded reason.

## Read `history.md`

Report the counts first: findings by kind, files scanned by source, and skipped paths. Then report the transcript coverage table, which lists per agent the stores found, rows and sessions read, skips with their reasons, and the note for an absent store. Do not paste a raw credential into chat. The report already redacts every secret to its first four characters, three asterisks, and a short SHA-256 prefix; even that detail is optional for a summary.

| Kind | Severity | Meaning |
|------|----------|---------|
| `exfil_executed` | critical | A transcript tool result or a shell history line shows a denied call actually ran |
| `exfil_executed` | high | A denied call was requested but no matching execution was found |
| `secret_exposed` | high | A credential literal reached a transcript, shell history, or git history |
| `injection_found` | medium | A hidden instruction or invisible character was found in repository content |
| `guard_event` | info | An earlier guard decision; a deny here means the guard worked |

A finding is a triage lead, not proof of use. The engine matches patterns; it cannot tell whether a key was revoked, whether a host was attacker controlled, or whether a `tool_result` truly corresponds to the exfiltrating call when a transcript is truncated.

## Triage

- Start with critical `exfil_executed` findings. Note the source, location, time, detector ids, and the redacted evidence.
- Cross reference those locations with `secret_exposed` findings grouped by hash. One hash with several occurrences is one credential in several places, not several credentials.
- Treat an `injection_found` as the likely cause when it appears near a denied call in the same repository. Remove the hidden instruction from the working tree only when the user asks; in autonomous mode list it as pending.
- A guard event with decision `deny` is evidence that the guard blocked that call. It does not tell you whether a different, earlier call leaked.
- If the report has no findings, say so plainly. Do not claim that no leak happened, only that these sources contain no pattern match.
- If the scan skipped large cells, non transcript files, or an uncovered agent, say which ones. A clean scan with skipped sources is not a clean bill of health.
- Treat a Kiro coverage note that says unverified as a limit on that reader, not as proof that Kiro chats are clean.

Continue to [04-respond.md](04-respond.md) when a credential was exposed.
