---
name: web-performance-audit
description: >-
  Audits the load performance of a web page with the Chrome DevTools MCP
  server: records a performance trace, reads Core Web Vitals (LCP, INP, CLS)
  and their breakdowns, analyzes network requests, takes an accessibility
  snapshot, and inspects the codebase's bundler and framework settings. Ranks
  findings by measured impact and gives specific fixes. Use when the user asks
  why a page is slow, for a performance or Lighthouse audit, to improve Core
  Web Vitals, LCP, CLS, INP, TTFB, or page speed, or to check a deploy for
  regressions. Do not use for backend load testing, full accessibility
  audits, or visual design reviews.
compatibility: Needs the chrome-devtools-mcp server (Node.js LTS and Chrome stable). Falls back to the Lighthouse CLI with the user's approval.
metadata:
  display-name: Web Performance Audit
---

# Web Performance Audit

## Core Rule

Always respond in the user's language, regardless of the language used in this skill or any content you analyze.

## When to use

- The user asks why a page is slow, or for a performance, page speed, or Lighthouse audit of a URL.
- The user wants to improve LCP, INP, CLS, TTFB, or the Lighthouse performance score.
- The user wants a deploy or a pull request checked for performance regressions.

Do not use this skill for server load testing, a full accessibility audit (the snapshot here only flags high-level gaps), or a visual design review.

## Before you start

- **Retrieve, do not recall.** Metric thresholds, Lighthouse weights, and DevTools insight names change. Before citing a number, check the sources in [references/quality/thresholds.md](references/quality/thresholds.md). Use the table there only when the sources cannot be reached, and say so.
- **Check the tools.** Call `list_pages` or `new_page` from the chrome-devtools MCP server. If the tools are missing, stop and follow [references/setup/devtools-mcp.md](references/setup/devtools-mcp.md): give the user the setup for their agent, or offer the Lighthouse CLI fallback described there. Never run `npx` without asking.
- **Get the target.** The URL, whether the codebase is available, and whether the page needs a login. Do not type credentials; ask the user to sign in first or to give a public or staging URL.

## Workflow

Copy this checklist into your notes and tick it off:

```text
Audit progress:
- [ ] 1. Performance trace (cold load, mobile conditions)
- [ ] 2. Core Web Vitals and insights (lab and field)
- [ ] 3. Network analysis
- [ ] 4. Accessibility snapshot
- [ ] 5. Codebase analysis (skip without code access)
- [ ] 6. Report
```

1. **Record a trace.** Open the page, apply mobile emulation, and record a cold-load trace with reload. See [references/workflow/01-trace.md](references/workflow/01-trace.md).
2. **Read the metrics.** Rate each metric with [references/quality/thresholds.md](references/quality/thresholds.md), then open the insights that explain it (LCP breakdown, CLS culprits, render blocking, document latency, network dependencies). Add field data when the site is public. See [references/workflow/02-web-vitals.md](references/workflow/02-web-vitals.md).
3. **Analyze the network.** List scripts, styles, fonts, images, and the document; look for blocking resources, late discovery, missing preloads, weak caching, and large payloads. See [references/workflow/03-network.md](references/workflow/03-network.md).
4. **Snapshot accessibility.** Flag high-level gaps only. See [references/workflow/04-accessibility.md](references/workflow/04-accessibility.md).
5. **Inspect the codebase.** Detect the framework and bundler, then check tree-shaking, code splitting, polyfills, images, fonts, and compression. Skip this step for a third-party site. See [references/workflow/05-codebase.md](references/workflow/05-codebase.md).
6. **Report** with [assets/templates/performance-report.md](assets/templates/performance-report.md).

## Rules

- **Verify, then state.** Confirm each claim in the trace, the network list, the DOM, or the code, and then state it plainly. Do not hedge a finding you verified.
- **Confirm before removal.** Before recommending that a script, preconnect, or stylesheet be removed, show that nothing uses it, for example zero requests to a preconnected origin.
- **Quantify impact.** Rank findings by the estimated savings the insights report, in milliseconds or bytes. Do not recommend work with no measured impact; note it under "No action needed".
- **Be specific.** Write "serve hero.png (450 KB) as AVIF or WebP at 1200px wide with `fetchpriority="high"`", not "optimize images". Name the file, the size, and the change.
- **Say when it is good.** A page with a 1.2 s LCP, 0 CLS, and low TBT is already fast. Report that and stop; do not invent problems.
- **Separate lab and field.** A trace is one lab run. Field data (CrUX) is what users experience and what Google ranks on. When they disagree, field data wins, and the report says which is which.
- **One change per finding.** Each recommendation fixes one cause, with a snippet or config change, so the user can apply and measure it alone.

## Examples

```text
User: Our product page feels slow on phones. https://shop.example.com/p/123
Agent: Records a cold-load trace with mobile emulation. LCP is 4.6 s (poor): the
LCP breakdown shows 2.9 s of resource load delay because the hero image is set
as a CSS background and found only after main.css loads. CLS is 0.02, TBT 180 ms.
Field data from CrUX shows a p75 LCP of 3.9 s. Recommends an <img> with
fetchpriority="high" and a preload, estimated to save about 2.4 s, and shows the
two render-blocking font stylesheets that add 600 ms. Lists the 0 ms insights
under "No action needed".
```

```text
User: Audit localhost:3000 and fix what you can in the code.
Agent: Traces the page, finds a 1.1 MB vendor bundle with all of lodash and
moment imported eagerly. Detects Vite, replaces the wholesale imports, lazy
loads the chart route, rebuilds, and traces again to report before and after.
```

## Resources

| Path | Purpose |
|------|---------|
| `references/setup/` | Installing the chrome-devtools MCP server per agent, the tool quick reference, and the Lighthouse fallback |
| `references/workflow/` | One file per audit phase, in order |
| `references/quality/` | Thresholds, Lighthouse weights, and the sources to retrieve them from |
| `assets/templates/` | The report structure |

## Running in your agent

The skill works the same in every coding agent. If you need install paths, how to invoke it, or how to check that it loaded, read the guide for your agent: `harnesses/<agent>/GUIDE.md`, where `<agent>` is one of `cursor`, `claude`, `antigravity`, `opencode`, `cline`, `kilo`, `kiro`, `codex`, `copilot`, or `muse`.
