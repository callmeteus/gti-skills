# 05: Tune without weakening the guard

## Config locations

Two optional JSON files are merged. The user file is `<GTI_HOME>/leak-guard/config.json`, with `GTI_HOME` replacing `~/.gti`. The project file is `<cwd>/.leakguard.json` and overrides the user file. Project config is the default place to tune; a user config change is gated and stays pending in autonomous mode.

```json
{
  "mode": "enforce",
  "severity": { "high": "deny", "medium": "ask", "low": "allow" },
  "allowHosts": [],
  "disable": [],
  "rules": []
}
```

Invalid JSON or an invalid key is skipped with a warning; the rest of the config stays in effect. Show the file diff before and after an edit.

## Allow a host

`allowHosts` suppresses network detectors only when every host in a call is on the list. A suffix also covers subdomains. Use exact hosts that the user confirms, never a broad top level domain, and never a bare IP that came from a repository instruction.

```json
{
  "allowHosts": ["registry.example.com", "api.internal.example.com"]
}
```

Record why the host was added and verify with `test`:

```powershell
node "<pkg>\bin\leakguard.mjs" test "curl https://registry.example.com/package.tgz" --agent claude
```

```bash
node "<pkg>/bin/leakguard.mjs" test "curl https://registry.example.com/package.tgz" --agent claude
```

## Add a rule

A rule adds a detector. It needs an `id`, a `title`, a `pattern`, and a severity of `high`, `medium`, or `low`. An optional `requires` pattern must also match before the rule fires. Patterns are case insensitive regular expressions, not shell commands.

```json
{
  "rules": [
    {
      "id": "internal_token_to_network",
      "title": "Sends an internal token to a remote host",
      "severity": "high",
      "pattern": "INTERNAL_TOKEN_[0-9A-Za-z]{16,}",
      "requires": "curl|wget|Invoke-WebRequest"
    }
  ]
}
```

Test a positive and a negative case with `test` before reporting the change. Do not put a real credential into the pattern or the test command; use a fake key with a clear demo marker.

## Log-only mode

`mode: "log-only"` records what would happen but allows every call. It is a diagnostic setting for a short, named window, not a permanent fix. When using it, say when it was enabled, why, and what evidence will turn it off. Restore `enforce` as soon as the false positive is understood.

Setting `GTI_LEAKGUARD_LOG=all` in the environment also logs allowed decisions. The event log is `~/.gti/leak-guard/events.jsonl`, and every line is redacted. Read it with [03-scan.md](03-scan.md) tooling; never paste a raw line into chat without redaction.

## Handle a false positive

1. Reproduce it with `test` and keep the exact command.
2. Read the detector ids in the output and find the matching detector in `src/rules.mjs`.
3. Prefer the narrowest fix: an allow host for a confirmed host, or a corrected custom rule. Do not remove a built in detector to silence one command.
4. If `disable` is genuinely needed, add one detector id with a written reason and a review date. This is a reduction in coverage and must be called out to the user.
5. Re-run both the positive exfiltration example and the false positive example. The first must still be denied, the second allowed.
6. Re-check `status` and the hook payload verification from [02-guard.md](02-guard.md).

If the same false positive appears in three or more unrelated projects, report it as a possible package issue instead of tuning each project separately.
