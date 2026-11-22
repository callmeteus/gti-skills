# Install Everything (Skills + MCPs)

You are an AI coding agent. Install all skills and MCP servers from the `gtihq/ai-skills` repository into the current project.

## Steps

1. Clone the repository into a temporary directory:
   ```bash
   git clone https://github.com/gtihq/ai-skills.git /tmp/gti-skills
   cd /tmp/gti-skills
   ```

2. Install all skills using the CLI:
   ```bash
   node packages/cli install --harness all --skill all --scope project --dest .
   ```

3. Install all MCP servers from the separate `gtihq/ai-mcps` repository. Every server is a Go command in one module at the repository root, so clone and copy the whole module:
   ```bash
   git clone https://github.com/gtihq/ai-mcps.git /tmp/ai-mcps
   mkdir -p ~/.config/opencode/mcp-servers/ai-mcps
   cp -r /tmp/ai-mcps/. ~/.config/opencode/mcp-servers/ai-mcps/
   ```
   - `kabum-mcp/` - KaBuM! product search
   - `mercadolivre-mcp/` - Mercado Livre product search
   - `zoom-mcp/` - Zoom price comparator (aggregates KaBuM!, Mercado Livre, Amazon, Magazine Luiza)
   - `twitter-mcp/` - Twitter/X research (requires login)

   Build each binary from the module root with Go 1.25 or later:
   ```bash
   cd ~/.config/opencode/mcp-servers/ai-mcps
   go build -o kabum-mcp ./kabum-mcp
   go build -o mercadolivre-mcp ./mercadolivre-mcp
   go build -o zoom-mcp ./zoom-mcp
   go build -o twitter-mcp ./twitter-mcp
   ```
   On Windows use `.exe` as the output suffix. Do not create a Python virtual environment or run pip; the Go toolchain downloads the modules.

   Register each MCP with your agent (example for OpenCode):
   ```bash
   opencode mcp add kabum --global -- ~/.config/opencode/mcp-servers/ai-mcps/kabum-mcp
   opencode mcp add mercadolivre --global -- ~/.config/opencode/mcp-servers/ai-mcps/mercadolivre-mcp
   opencode mcp add zoom --global -- ~/.config/opencode/mcp-servers/ai-mcps/zoom-mcp
   opencode mcp add twitter --global -- ~/.config/opencode/mcp-servers/ai-mcps/twitter-mcp
   ```

4. Clean up:
   ```bash
   rm -rf /tmp/gti-skills /tmp/ai-mcps
   ```

5. Restart your agent session so it picks up the new skills and MCPs.

## Notes

- Twitter/X needs a one-time login: `~/.config/opencode/mcp-servers/ai-mcps/twitter-mcp --login`. Mercado Livre uses the same `--login` helper.
- Mercado Livre, Shopee and Twitter drive a real browser through playwright-go. Google Chrome must be installed; no pip browser install is needed.
- Mercado Livre MCP opens a visible browser window (anti-bot detection)
- Zoom MCP aggregates multiple stores (KaBuM!, Mercado Livre, Amazon, Magazine Luiza)
- A legacy Python server is identified by `requirements.txt` and `server.py` or `mcp_server.py`; install its requirements in a virtual environment and register `python <path>/server.py` instead of a Go binary.
