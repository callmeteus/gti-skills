# Phase 3: Network analysis

## Goal

Find the requests that delay the first paint and the LCP, or that waste bytes, and back each finding with the request itself.

## List the requests

```text
list_network_requests(pageId, resourceTypes: ["document", "script", "stylesheet", "font", "image"])
```

Open the important ones with `get_network_request(pageId, reqid: <id>)` for headers, size, and timing.

## Look for

| Problem | How to confirm | Fix |
|---------|----------------|-----|
| Render-blocking CSS or JS | In `<head>`, no `async`, `defer`, `type="module"`, or non-matching `media`; `RenderBlocking` shows savings | `defer` scripts, inline critical CSS, load the rest async |
| Late discovery | Resource requested only after another finishes (CSS `@import`, JS-injected font or image) | Reference it in the HTML or preload it |
| Missing preload | LCP image or critical font not preloaded and found late | `<link rel="preload">` with the right `as` and `crossorigin` for fonts |
| Unused preconnect | Preconnected origin with zero requests | Remove it. If requests exist but come late, keep it |
| Weak caching | Static assets without long `Cache-Control` or without a hashed name | `Cache-Control: public, max-age=31536000, immutable` on hashed files |
| No compression | Text responses without `content-encoding: br` or `gzip` | Enable Brotli or gzip on the server or CDN |
| Large payloads | Big JS or CSS bundles, images larger than their display size | Split bundles, remove unused code, resize and convert images |
| Third-party weight | Analytics, chat, A/B, and tag managers on the critical path | Load after the main content or on interaction |

## Rules

- Quote sizes from the request (transfer size and resource size) and timings from the trace.
- Before calling something unused, check that no request or DOM node uses it. Use `evaluate_script` to search the DOM when needed.
- A blocking resource with 0 ms estimated savings goes under "No action needed".
