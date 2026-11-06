# Mercado Livre MCP server

An MCP server that searches products on Mercado Livre (Brasil) with live prices (BRL), no API key.

Note: Mercado Livre detects headless Chrome (serves an empty page), so a visible browser window is required. Set `ML_HEADLESS=1` to force headless anyway.

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
opencode mcp add mercadolivre --global -- python /absolute/path/to/gti-skills/mcps/mercadolivre-mcp/server.py
```

## Layout

| Path | Responsibility |
|------|----------------|
| `server.py` | MCP entry point: `search_products` tool |
| `pyproject.toml` | Project metadata and dependencies |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `ML_HEADLESS` | `0` | `1` forces headless (may serve empty page) |

See [../../../README.md](../../../README.md) for the full repository.
