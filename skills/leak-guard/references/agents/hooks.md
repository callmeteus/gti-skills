# Per-agent hook and plugin table

Leakguard writes a command hook for six agents and an in-process plugin shim for two more. Cline has an SDK plugin that must be registered in the session config. Muse has no documented pre-tool hook. The table is trimmed from the hook research; `stdin` means the hook receives JSON on stdin, plugin-only agents have no such contract.

| Agent | Kind | Event | Config path (project / user) | Block contract | Doc URL |
|-------|------|-------|------------------------------|----------------|---------|
| cursor | Command hook | `preToolUse` | `<project>/.cursor/hooks.json` / `~/.cursor/hooks.json` | `stdin`; exit code `2` blocks, or exit `0` with stdout JSON `{"permission":"deny","user_message":"..."}`. Exit `2` wins over JSON allow | https://cursor.com/docs/hooks |
| claude | Command hook | `PreToolUse` | `<project>/.claude/settings.json` / `~/.claude/settings.json` | `stdin`; exit `2` with a reason on stderr, or exit `0` with `hookSpecificOutput.permissionDecision: "deny"`. Exit `2` wins | https://code.claude.com/docs/en/hooks |
| codex | Command hook | `PreToolUse` | `<project>/.codex/hooks.json` / `~/.codex/hooks.json` | `stdin`; exit `2` with a reason on stderr, or stdout JSON with `hookSpecificOutput.permissionDecision: "deny"`. Hooks must be reviewed and trusted in `/hooks` | https://developers.openai.com/codex/hooks |
| antigravity | Command hook | `PreToolUse` | `<project>/.agents/hooks.json` / `~/.gemini/config/hooks.json` | `stdin` with camelCase fields; stdout JSON `{"decision":"deny","reason":"..."}`. Exit-code blocking is not documented on this page | https://antigravity.google/docs/hooks/ |
| copilot | Command hook | `preToolUse` | `<project>/.github/hooks/leakguard.json` / `~/.copilot/hooks/leakguard.json` | `stdin`; exit `2` denies even when stdout says allow; other non-zero exits also deny, timeouts fail open. `ask` becomes `deny` in the cloud agent | https://docs.github.com/en/copilot/reference/hooks-reference |
| kiro | Command hook | `preToolUse` | `<project>/.kiro/hooks/leakguard.json` / `~/.kiro/hooks/leakguard.json` | `stdin`; a reason on stderr with exit code `2` blocks. The agent hooks page says any non-zero exit blocks | https://kiro.dev/docs/hooks/types/ |
| opencode | Plugin shim, not a command hook | `tool.execute.before` and `permission.evaluate` in V1, `ctx.tool.hook` and `ctx.permission.hook` in V2 | `<project>/.opencode/plugins/leakguard.mjs` / `~/.config/opencode/plugins/leakguard.mjs` | No `stdin`. Set `event.effect = "deny"` and a message in a permission evaluate hook. OpenCode 2.x discovers `.js` and `.ts` plugins, so the installer writes a `.js` companion beside the `.mjs` file | https://opencode.ai/docs/build/plugins/server/ |
| kilo | Plugin shim, not a command hook | `tool.execute.before`, `permission.ask` | `<project>/.kilo/plugin/leakguard.mjs` / `~/.config/kilo/plugin/leakguard.mjs` | No `stdin`. `permission.ask` auto-allow or auto-deny is the documented deny path. Plugin hooks run outside the sandboxed tool execution, so enable only trusted plugins | https://kilo.ai/docs/automate/extending/plugins |
| cline | SDK plugin, not a command hook | `beforeTool` | Register `plugins/cline/leakguard.mjs` in the session config (`extensions` or `pluginPaths`); no JSON command-hook file | No `stdin`. Return `{"skip":true,"reason":"..."}` to block. Hook failures are fail-open by default unless `hookErrorMode` is `"throw"` | https://docs.cline.bot/sdk/plugins |
| muse | Unsupported | None found | None found | No pre-tool hook could be confirmed. Approval and sandboxing are on by default; plugins are undocumented. Do not install a guard here | https://www.withone.ai/blog/muse-code-skills-not-mcp |

Notes:

- Install paths are verified against `src/install.mjs` in the Leakguard package. Hook contracts and event names come from each agent's official documentation where available.
- Codex and Kilo plugin or hook surfaces run outside the normal tool sandbox. Trust is part of the design.
- Copilot also reads `.claude/settings.json`; the installer uses a dedicated hook file so it does not overwrite another agent's config.
- Cursor, OpenCode, and Copilot also read `.claude/skills` and `.agents/skills`, so one skill install can be found by more than one agent.
