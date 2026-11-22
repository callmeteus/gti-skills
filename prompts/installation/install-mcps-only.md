# Install MCPs Only

You are an AI coding agent. Install all MCP servers from the `gtihq/ai-mcps` repository.

## Available MCPs

| MCP | Directory | Description |
|-----|-----------|-------------|
| KaBuM! | `kabum-mcp/` | Search products on KaBuM! with live prices (BRL) |
| Mercado Livre | `mercadolivre-mcp/` | Search products on Mercado Livre (Brasil) with live prices |
| Zoom | `zoom-mcp/` | Price comparator aggregating KaBuM!, Mercado Livre, Amazon, Magazine Luiza |
| Twitter/X | `twitter-mcp/` | Read and post on X (Twitter) via headless browser |

Every server is a Go command. All commands belong to one Go module at the repository root (`go.mod` and `go.sum` there, with shared packages in `internal/`), so copy the whole module before building.

## Steps

1. Clone the repository into a temporary directory:
   ```bash
   git clone https://github.com/gtihq/ai-mcps.git /tmp/ai-mcps
   ```

2. Copy the whole Go module into a local directory:
   ```bash
   mkdir -p ~/.config/opencode/mcp-servers/ai-mcps
   cp -r /tmp/ai-mcps/. ~/.config/opencode/mcp-servers/ai-mcps/
   ```

3. Build each binary from the module root (Go 1.25 or later):
   ```bash
   cd ~/.config/opencode/mcp-servers/ai-mcps
   go build -o kabum-mcp ./kabum-mcp
   go build -o mercadolivre-mcp ./mercadolivre-mcp
   go build -o zoom-mcp ./zoom-mcp
   go build -o twitter-mcp ./twitter-mcp
   ```
   On Windows, use `.exe` as the output suffix, for example `go build -o twitter-mcp.exe .\twitter-mcp`. Do not create a Python virtual environment or run pip; the Go toolchain downloads the modules.

4. Register each MCP with your agent (example for OpenCode):
   ```bash
   opencode mcp add kabum --global -- ~/.config/opencode/mcp-servers/ai-mcps/kabum-mcp
   opencode mcp add mercadolivre --global -- ~/.config/opencode/mcp-servers/ai-mcps/mercadolivre-mcp
   opencode mcp add zoom --global -- ~/.config/opencode/mcp-servers/ai-mcps/zoom-mcp
   opencode mcp add twitter --global -- ~/.config/opencode/mcp-servers/ai-mcps/twitter-mcp
   ```

5. Clean up:
   ```bash
   rm -rf /tmp/ai-mcps
   ```

6. Restart your agent session so it picks up the new MCPs.

## Notes

- Twitter/X needs a one-time login: `~/.config/opencode/mcp-servers/ai-mcps/twitter-mcp --login`. Mercado Livre has the same helper with `--login`.
- Mercado Livre, Shopee and Twitter drive a real browser through playwright-go. Google Chrome must be installed; the Go driver follows the usual Go module setup, no pip browser install is needed.
- Mercado Livre MCP opens a visible browser window (anti-bot detection)
- Zoom MCP aggregates multiple stores (KaBuM!, Mercado Livre, Amazon, Magazine Luiza)
- Adapt paths for your agent (Claude Code, Cursor, etc.) as needed. If you still find a server with `requirements.txt` and `server.py`, that is a legacy Python server: install its requirements in a virtual environment and register `python <path>/server.py` instead.
