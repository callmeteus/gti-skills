# Install Skills Only

You are an AI coding agent. Install all skills from the `callmeteus/gti-skills` repository into the current project.

## Steps

1. Clone the repository into a temporary directory:
   ```bash
   git clone https://github.com/callmeteus/gti-skills.git /tmp/gti-skills
   cd /tmp/gti-skills
   ```

2. Install all skills using the CLI:
   ```bash
   node packages/cli install --harness all --skill all --scope project --dest .
   ```

3. Clean up:
   ```bash
   rm -rf /tmp/gti-skills
   ```

4. Restart your agent session so it picks up the new skills.

## Notes

- This installs only skills, not MCP servers.
- For a specific agent, replace `all` with the agent id (e.g., `claude`, `cursor`, `opencode`).
- For a specific skill, use `--skill <id>` instead of `--skill all`.
- For a specific pack, use `--pack <id>` instead of `--skill all`.
