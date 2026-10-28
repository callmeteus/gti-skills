# Chrome DevTools MCP setup

The audit runs on the official Chrome DevTools MCP server (`chrome-devtools-mcp`). It needs Node.js LTS, npm, and Chrome stable. The server starts the browser the first time a tool needs one.

## Check that it is available

Call `list_pages`. If the call works, the server is connected. If the tool does not exist, give the user the setup for their agent below and stop until they confirm.

## Install

Most MCP clients take this JSON configuration:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

Command-line setup for some agents:

| Agent | Command |
|-------|---------|
| Claude Code | `claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest` |
| Codex | `codex mcp add chrome-devtools -- npx chrome-devtools-mcp@latest` |
| Gemini CLI, Antigravity | `gemini mcp add chrome-devtools npx chrome-devtools-mcp@latest` |

OpenCode uses a `local` server entry in its config:

```json
"chrome-devtools": {
  "type": "local",
  "command": ["npx", "-y", "chrome-devtools-mcp@latest"]
}
```

For other agents, point the user to the client configuration guide in the `chrome-devtools-mcp` repository (`docs/client-configurations.md`). After adding the server, the agent session usually has to restart.

## Tool quick reference

Almost every tool takes a `pageId`. Get it from `list_pages`, or from `new_page`, which opens a page and returns its id. Check the server's tool reference (`docs/tool-reference.md`) when a call fails: parameters change between versions.

| Task | Call |
|------|------|
| Open a page | `new_page(url: "<url>")`, or `navigate_page(pageId, type: "url", url: "<url>")` |
| Emulate a phone | `emulate(pageId, viewport: "412x915x2.625,mobile,touch", cpuThrottlingRate: 4, networkConditions: "Slow 4G")` |
| Record a cold load | `performance_start_trace(pageId, reload: true, autoStop: true, ignoreCache: true)` |
| Stop a manual trace | `performance_stop_trace(pageId)` |
| Open an insight | `performance_analyze_insight(pageId, insightSetId: "<id>", insightName: "LCPBreakdown")` |
| List requests | `list_network_requests(pageId, resourceTypes: ["document", "script", "stylesheet", "font", "image"])` |
| Request details and headers | `get_network_request(pageId, reqid: <id>)` |
| Accessibility tree | `take_snapshot(pageId, verbose: true)` |
| Read the DOM or run a check | `evaluate_script(pageId, function: "() => ...")` |
| Accessibility, SEO, best practices scores | `lighthouse_audit(pageId, device: "mobile", mode: "navigation")` |

`emulate` replaces all emulation settings on each call, so pass every setting in one call. `lighthouse_audit` does not cover performance; use the trace for that.

## Fallback: Lighthouse CLI

When the MCP server cannot be installed, offer the Lighthouse CLI. It downloads a package, so ask first. It gives lab metrics and audits but no interactive insight drill-down.

```bash
npx lighthouse https://example.com --only-categories=performance --output=json --output-path=./lighthouse.json --chrome-flags="--headless=new"
```

Read `audits` in the JSON for the metrics (`largest-contentful-paint`, `cumulative-layout-shift`, `total-blocking-time`, `speed-index`, `first-contentful-paint`, `server-response-time`) and the opportunities with their savings. Say in the report that the fallback was used.
