# KaBuM! MCP server

An MCP server that searches products on KaBuM! with live prices (BRL), no API key.

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
opencode mcp add kabum --global -- python /absolute/path/to/gti-skills/mcps/kabum-mcp/server.py
```

## Layout

| Path | Responsibility |
|------|----------------|
| `server.py` | MCP entry point: `search_products` tool |
| `pyproject.toml` | Project metadata and dependencies |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `KABUM_HEADLESS` | `1` | `0` shows the browser window |

See [../../../README.md](../../../README.md) for the full repository.
