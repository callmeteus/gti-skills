# Zoom MCP server

An MCP server that searches products on Zoom (zoom.com.br) — a Brazilian price comparator. Aggregates KaBuM!, Mercado Livre, Amazon, Magazine Luiza and others, with the best price and list of stores selling each product. No API key.

## Run

Install the dependencies:

```bash
python -m pip install -r requirements.txt
```

Register the server with your agent. The command it runs is:

```bash
python server.py
```

For example, for OpenCode:

```bash
opencode mcp add zoom --global -- python /absolute/path/to/gti-skills/mcps/zoom-mcp/server.py
```

## Layout

| Path | Responsibility |
|------|----------------|
| `server.py` | MCP entry point: `search_products` tool |
| `pyproject.toml` | Project metadata and dependencies |

See [../../../README.md](../../../README.md) for the full repository.
