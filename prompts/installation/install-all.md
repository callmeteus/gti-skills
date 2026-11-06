# Install Everything (Skills + MCPs)

You are an AI coding agent. Install all skills and MCP servers from the `callmeteus/gti-skills` repository into the current project.

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

3. Install all MCP servers (copy each one and register):
   - `mcps/kabum-mcp/` - KaBuM! product search
   - `mcps/mercadolivre-mcp/` - Mercado Livre product search
   - `mcps/zoom-mcp/` - Zoom price comparator (aggregates KaBuM!, Mercado Livre, Amazon, Magazine Luiza)
   - `packages/python/twitter-mcp/` - Twitter/X research (requires login)

   For each MCP, copy the folder to a local directory and register with your agent. Example for OpenCode:
   ```bash
   mkdir -p ~/.config/opencode/mcp-servers
   cp -r /tmp/gti-skills/mcps/kabum-mcp ~/.config/opencode/mcp-servers/kabum-mcp
   cp -r /tmp/gti-skills/mcps/mercadolivre-mcp ~/.config/opencode/mcp-servers/mercadolivre-mcp
   cp -r /tmp/gti-skills/mcps/zoom-mcp ~/.config/opencode/mcp-servers/zoom-mcp
   cp -r /tmp/gti-skills/packages/python/twitter-mcp ~/.config/opencode/mcp-servers/twitter-mcp
   ```

   Then install Python dependencies for each:
   ```bash
   cd ~/.config/opencode/mcp-servers/kabum-mcp && python -m pip install -r requirements.txt
   cd ~/.config/opencode/mcp-servers/mercadolivre-mcp && python -m pip install -r requirements.txt
   cd ~/.config/opencode/mcp-servers/zoom-mcp && python -m pip install -r requirements.txt
   cd ~/.config/opencode/mcp-servers/twitter-mcp && python -m pip install -r requirements.txt && python -m playwright install chromium
   ```

   Register each MCP with your agent (example for OpenCode):
   ```bash
   opencode mcp add kabum --global -- python ~/.config/opencode/mcp-servers/kabum-mcp/server.py
   opencode mcp add mercadolivre --global -- python ~/.config/opencode/mcp-servers/mercadolivre-mcp/server.py
   opencode mcp add zoom --global -- python ~/.config/opencode/mcp-servers/zoom-mcp/server.py
   opencode mcp add twitter --global -- python ~/.config/opencode/mcp-servers/twitter-mcp/server.py
   ```

4. Clean up:
   ```bash
   rm -rf /tmp/gti-skills
   ```

5. Restart your agent session so it picks up the new skills and MCPs.

## Notes

- Twitter MCP requires a one-time login: `python ~/.config/opencode/mcp-servers/twitter-mcp/login.py`
- Mercado Livre MCP opens a visible browser window (anti-bot detection)
- Zoom MCP aggregates multiple stores (KaBuM!, Mercado Livre, Amazon, Magazine Luiza)
