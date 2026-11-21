# 01: Detect the package and the agents

## Locate the package

The `install` command writes the absolute path of the installed package into `scripts/leakguard.root` inside this skill folder. Read that file first. It is a plain path with no surrounding quotes.

```powershell
Get-Content -LiteralPath "<skill-dir>\scripts\leakguard.root"
```

```bash
cat "<skill-dir>/scripts/leakguard.root"
```

Let `<pkg>` be that path. Verify that it contains `bin/leakguard.mjs` before using it. If the pointer is missing because the skill was copied by hand, find `packages/leakguard` in the gti-skills repository and use that folder. Do not search npm or the network for a leakguard binary; this package is local and has no published binary.

Confirm the CLI works and note the Node version:

```powershell
node --version
node "<pkg>\bin\leakguard.mjs" --help
```

```bash
node --version
node "<pkg>/bin/leakguard.mjs" --help
```

## Detect installed agents

Check which agent folders exist in the project and in the user home. An absent folder means that agent is not in use here; skip it and record the reason.

| Agent | Project marker | User marker |
|-------|----------------|-------------|
| claude | `.claude/` | `~/.claude/` |
| codex | `.codex/` | `~/.codex/` |
| cursor | `.cursor/` | `~/.cursor/` |
| antigravity | `.agents/` | `~/.gemini/` |
| copilot | `.github/` | `~/.copilot/` |
| kiro | `.kiro/` | `~/.kiro/` |
| opencode | `.opencode/` | `~/.config/opencode/` |
| kilo | `.kilocode/` | `~/.config/kilo/` |
| cline | `.cline/` | `~/.cline/` |
| muse | `.agents/` | `~/.agents/` |

PowerShell:

```powershell
$markers = @(".claude", ".codex", ".cursor", ".agents", ".github", ".kiro", ".opencode", ".kilocode", ".cline")
foreach ($m in $markers) { "{0} {1}" -f (Test-Path -LiteralPath (Join-Path (Get-Location) $m)), $m }
```

bash:

```bash
for m in .claude .codex .cursor .agents .github .kiro .opencode .kilocode .cline; do
  if [ -d "$m" ]; then echo "present $m"; else echo "absent  $m"; fi
done
```

Cross check the result with the hook table in [../agents/hooks.md](../agents/hooks.md). OpenCode, Kilo, Cline and Muse use plugins or in-process hooks rather than a script that receives JSON on stdin.

## Record current guard state

`status` is read only and prints one row per agent and scope. It does not write config files.

```powershell
node "<pkg>\bin\leakguard.mjs" status --agent all --dest "<project>"
```

```bash
node "<pkg>/bin/leakguard.mjs" status --agent all --dest "<project>"
```

The output marks each row as `installed` or `not installed` and shows the exact config path. Plugin agents show their shim path. Cline and Muse appear as instruction-only or unsupported notes. Keep this output as the baseline: a later install or uninstall should change only the rows you intended.

If `status` reports a path you do not recognise, read the file before touching it. The installer merges entries and keeps timestamped backups, but an unrelated entry in the same file is the user's work.
