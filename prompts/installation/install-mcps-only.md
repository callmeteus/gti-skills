# Install MCPs Only

You are an AI coding agent. Install all MCP servers from the `callmeteus/gti-skills` repository.

## Available MCPs

| MCP | Directory | Description |
|-----|-----------|-------------|
| KaBuM! | `mcps/kabum-mcp/` | Search products on KaBuM! with live prices (BRL) |
| Mercado Livre | `mcps/mercadolivre-mcp/` | Search products on Mercado Livre (Brasil) with live prices |
| Zoom | `mcps/zoom-mcp/` | Price comparator aggregating KaBuM!, Mercado Livre, Amazon, Magazine Luiza |
| Twitter/X | `packages/python/twitter-mcp/` | Read and post on X (Twitter) via headless browser |

## Steps

1. Clone the repository into a temporary directory:
   ```bash
   git clone https://github.com/callmeteus/gti-skills.git /tmp/gti-skills
   ```

2. Copy each MCP to your local MCP servers directory and install dependencies:
   ```bash
   mkdir -p ~/.config/opencode/mcp-servers
   cp -r /tmp/gti-skills/mcps/kabum-mcp ~/.config/opencode/mcp-servers/kabum-mcp
   cp -r /tmp/gti-skills/mcps/mercadolivre-mcp ~/.config/opencode/mcp-servers/mercadolivre-mcp
   cp -r /tmp/gti-skills/mcps/zoom-mcp ~/.config/opencode/mcp-servers/zoom-mcp
   cp -r /tmp/gti-skills/packages/python/twitter-mcp ~/.config/opencode/mcp-servers/twitter-mcp
   ```

3. Install Python dependencies for each:
   ```bash
   cd ~/.config/opencode/mcp-servers/kabum-mcp && python -m pip install -r requirements.txt
   cd ~/.config/opencode/mcp-servers/mercadolivre-mcp && python -m pip install -r requirements.txt
   cd ~/.config/opencode/mcp-servers/zoom-mcp && python -m pip install -r requirements.txt
   cd ~/.config/opencode/mcp-servers/twitter-mcp && python -m pip install -r requirements.txt && python -m playwright install chromium
   ```

4. Register each MCP with your agent (example for OpenCode):
   ```bash
   opencode mcp add kabum --global -- python ~/.config/opencode/mcp-servers/kabum-mcp/server.py
   opencode mcp add mercadolivre --global -- python ~/.config/opencode/mcp-servers/mercadolivre-mcp/server.py
   opencode mcp add zoom --global -- python ~/.config/opencode/mcp-servers/zoom-mcp/server.py
   opencode mcp add twitter --global -- python ~/.config/opencode/mcp-servers/twitter-mcp/server.py
   ```

5. Clean up:
   ```bash
   rm -rf /tmp/gti-skills
   ```

6. Restart your agent session so it picks up the new MCPs.

## Notes

- Twitter MCP requires a one-time login: `python ~/.config/opencode/mcp-servers/twitter-mcp/login.py`
- Mercado Livre MCP opens a visible browser window (anti-bot detection)
- Zoom MCP aggregates multiple stores (KaBuM!, Mercado Livre, Amazon, Magazine Luiza)
- Adapt paths for your agent (Claude Code, Cursor, etc.) as needed
