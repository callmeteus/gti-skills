<div align="center">

# Web Performance Audit

> Measured Core Web Vitals findings with specific, ranked fixes

**Audits page load with the Chrome DevTools MCP server: trace, Core Web Vitals insights, network, accessibility snapshot, and codebase, ranked by measured savings.**

[![Format](https://img.shields.io/badge/format-SKILL.md-green.svg)](#overview)
[![Runtime](https://img.shields.io/badge/node-LTS-blue.svg)](#requirements)
[![Agents](https://img.shields.io/badge/agents-10%20supported-8A63D2.svg)](#installation)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](#requirements)
[![License](https://img.shields.io/badge/license-not%20declared-lightgrey.svg)](#license)

[Quick Start](#quick-start) • [Usage](#usage) • [Reference](#reference) • [Troubleshooting](#troubleshooting)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Reference](#reference)
- [Output](#output)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Overview

Agents asked to "make the site faster" often recite generic advice from memory: compress images, minify, use a CDN. The advice may not apply to the page, the numbers may be outdated, and nothing is measured before or after.

Web Performance Audit makes the agent measure first. It records a cold-load trace through the Chrome DevTools MCP server under phone conditions, reads Core Web Vitals and the DevTools insights that explain them, checks the network requests and the codebase, and reports only findings it can back with evidence, ranked by estimated savings. Thresholds and tool names are retrieved from the official sources before they are cited.

```text
  URL (+ codebase)
        │
        v
  check chrome-devtools MCP ──> references/setup/devtools-mcp.md
        │
        v
  trace ─> web vitals ─> network ─> accessibility ─> codebase
        │       references/workflow/0N-*.md
        v
  performance report (vitals table, ranked issues, fixes, no action needed)
```

| This skill does | This skill does not |
|-----------------|---------------------|
| Record and analyze cold-load traces with phone throttling | Load test servers or APIs |
| Explain LCP, CLS, and TBT with DevTools insights | Run a full accessibility audit |
| Read field data from the Chrome UX Report for public sites | Send private or staging URLs to Google APIs |
| Tie findings to the bundler, framework, and files | Recommend changes with no measured impact |

## Features

- **Measured first:** every finding comes from the trace, a network request, the DOM, or the code.
- **Ranked by savings:** issues are ordered by the estimated milliseconds or bytes the insights report; zero-impact items go under "No action needed".
- **Lab and field:** lab trace values next to CrUX p75 field data, with INP from field data or an interaction trace.
- **Current numbers:** thresholds, Lighthouse weights, and insight names are retrieved from web.dev, Chrome docs, and the MCP tool reference before citing them.
- **Codebase phase:** detects Webpack, Vite, Rollup, esbuild, Parcel, Next.js, Nuxt, SvelteKit, Astro, and Remix, then checks tree-shaking, splitting, polyfills, images, fonts, and compression.
- **Fallback:** the Lighthouse CLI when the MCP server cannot be installed, with the user's approval.
- **Report template:** vitals summary, ranked issues, fixes with snippets, accessibility gaps, codebase findings, and before and after.

## Requirements

| Dependency | Version | Purpose | Auto-installed |
|------------|---------|---------|:--------------:|
| chrome-devtools-mcp | Latest | Traces, insights, network, snapshots | No |
| Node.js and npm | LTS | Runs the MCP server through `npx` | No |
| Chrome | Current stable | The browser the server drives | No |
| Lighthouse CLI | Latest | Fallback when the MCP server is not available | No |

The MCP server must be configured in your agent before the audit. The skill checks for it and shows the setup when it is missing.

## Installation

From the repository root, install the skill into any supported agent:

```bash
node packages/cli install --harness claude --skill web-performance-audit
```

The same command works in PowerShell. Use a comma separated list or `all` for several agents, `--scope user` to install for every project, and `--dry-run` to preview.

| Agent | Id | Project folder | User folder |
|-------|----|----------------|-------------|
| Cursor / Cursor CLI | `cursor` | `.cursor/skills` | `~/.cursor/skills` |
| Claude / Claude Code | `claude` | `.claude/skills` | `~/.claude/skills` |
| Antigravity | `antigravity` | `.agents/skills` | `~/.gemini/antigravity/skills` |
| OpenCode | `opencode` | `.opencode/skills` | `~/.config/opencode/skills` |
| Cline | `cline` | `.cline/skills` | `~/.cline/skills` |
| Kilo Code | `kilo` | `.kilocode/skills` | `~/.kilocode/skills` |
| Kiro | `kiro` | `.kiro/skills` | `~/.kiro/skills` |
| Codex | `codex` | `.agents/skills` | `~/.agents/skills` |
| GitHub Copilot | `copilot` | `.github/skills` | `~/.copilot/skills` |
| Muse Code | `muse` | `.agents/skills` | `~/.agents/skills` |

The skill is one self-contained folder, identical for every agent. To copy it by hand, put `skills/web-performance-audit` in your agent's folder (macOS and Linux, Claude Code shown):

```bash
mkdir -p .claude/skills && cp -r skills/web-performance-audit .claude/skills/
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse skills\web-performance-audit .claude\skills\
```

Then add the Chrome DevTools MCP server to your agent. In Claude Code:

```bash
claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest
```

Other agents take this MCP configuration (see `references/setup/devtools-mcp.md` in the skill for more):

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

Each agent has a short guide in `skills/web-performance-audit/harnesses/<id>/GUIDE.md` covering install paths, how to invoke the skill, and how to confirm it loaded.

## Quick Start

```text
Run a performance audit on https://example.com. It feels slow on phones.
```

The agent records a throttled cold-load trace, rates each Core Web Vital, explains the slow ones with DevTools insights, and returns a report with fixes ranked by estimated savings.

## Usage

### Input

| Input | Required | Example |
|-------|:--------:|---------|
| URL | Yes | `https://example.com/pricing`, `http://localhost:3000` |
| Codebase | No | The project folder, for the codebase phase and for applying fixes |
| Device | No | Mobile by default; ask for desktop as well |
| Scope | No | "Only LCP", "report only, do not change code" |

### Examples

```text
Why is the LCP of our landing page so high? https://shop.example.com
```

```text
Audit localhost:3000 and fix what you can in the code, then measure again.
```

```text
Compare the performance of staging.example.com with production before we deploy.
```

## How It Works

```text
  0. Setup           check the MCP tools, retrieve current thresholds
          │
  1. Trace           phone emulation, cold load with reload
          │
  2. Web vitals      rate metrics, open insights, add CrUX field data
          │
  3. Network         blocking, late discovery, preloads, caching, payloads
          │
  4. Accessibility   snapshot, high-level gaps only
          │
  5. Codebase        bundler, framework, splitting, polyfills, images, fonts
          │
  6. Report          ranked issues, fixes, no action needed, before and after
```

## Reference

### Reference files

The agent reads a file only when a step needs it.

| File | Purpose | Used in |
|------|---------|---------|
| `references/setup/devtools-mcp.md` | MCP install per agent, tool quick reference, Lighthouse fallback | Setup |
| `references/workflow/01-trace.md` | Opening the page, emulation, recording, repeat runs | Phase 1 |
| `references/workflow/02-web-vitals.md` | Ratings, insight names, LCP breakdown, field data | Phase 2 |
| `references/workflow/03-network.md` | Request problems, how to confirm them, fixes | Phase 3 |
| `references/workflow/04-accessibility.md` | High-level accessibility gaps | Phase 4 |
| `references/workflow/05-codebase.md` | Stack detection and build checks | Phase 5 |
| `references/quality/thresholds.md` | Sources, thresholds, Lighthouse weights | Phases 2 and 6 |

### MCP tools used

| Tool | Purpose | Key parameters |
|------|---------|----------------|
| `new_page`, `navigate_page`, `list_pages` | Open the target and get its `pageId` | `url`, `type` |
| `emulate` | Phone viewport, CPU and network throttling | `viewport`, `cpuThrottlingRate`, `networkConditions` |
| `performance_start_trace` | Record a cold load | `reload`, `autoStop`, `ignoreCache`, `filePath` |
| `performance_analyze_insight` | Explain one insight | `insightSetId`, `insightName` |
| `list_network_requests`, `get_network_request` | Requests, headers, sizes | `resourceTypes`, `reqid` |
| `take_snapshot`, `lighthouse_audit` | Accessibility tree and scores | `verbose`, `device`, `mode` |

## Output

````markdown
# Performance audit: shop.example.com/p/123

## Core Web Vitals summary

| Metric | Lab | Field p75 | Rating |
|--------|----:|----------:|--------|
| LCP | 4.6 s | 3.9 s | poor |
| CLS | 0.02 | 0.04 | good |
| TBT | 180 ms | lab only | good |

## Top issues

| # | Issue | Evidence | Metric | Estimated savings | Impact |
|--:|-------|----------|--------|------------------:|--------|
| 1 | Hero image found late | CSS background in main.css, 2.9 s load delay | LCP | 2.4 s | high |
````

| Section | Contents |
|---------|----------|
| Setup | URL, conditions, runs, tools, stack |
| Core Web Vitals summary | Lab, field, and rating per metric |
| Top issues | Ranked by estimated savings, with evidence |
| Recommendations | One fix per issue with a snippet and the expected effect |
| Accessibility gaps | High-level gaps from the snapshot |
| Codebase findings | Stack and build problems |
| No action needed | Zero-impact insights and metrics already good |
| Before and after | Metrics after changes, when the page was traced again |

The template is `assets/templates/performance-report.md`.

## Security

- **Browser:** the MCP server drives a real Chrome instance. The agent does not type credentials; sign in yourself when a page needs a login.
- **Network:** field data comes from the public PageSpeed Insights API, which receives the URL. The skill does not send private or staging URLs to it.
- **Packages:** `npx chrome-devtools-mcp@latest` and the Lighthouse fallback download packages from npm; the skill asks before running `npx`.

## Troubleshooting

<details>
<summary><strong>The agent says the chrome-devtools tools are missing</strong></summary>

The MCP server is not configured in your agent. Add it and restart the agent session.

```bash
claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest
```

</details>

<details>
<summary><strong>An insight name is not found</strong></summary>

DevTools renames insights between versions. The agent uses the names listed in the trace response; ask it to list them if a call fails.

</details>

<details>
<summary><strong>The numbers change a lot between runs</strong></summary>

Lab traces vary with machine load. The skill takes the median of three runs when a metric is near a threshold; close other heavy tabs and apps before auditing.

</details>

<details>
<summary><strong>INP shows as not measured</strong></summary>

A load trace has no interactions. Field data provides INP for sites with enough traffic, or ask the agent to record an interaction trace while it clicks the main controls.

</details>

## Limitations

- Lab traces run on your machine with emulated throttling; they approximate, but do not equal, real phones.
- Field data exists only for public pages with enough Chrome traffic.
- The accessibility phase flags high-level gaps; it is not a WCAG audit.
- Pages behind a login need you to sign in in the browser the MCP server opens.

## Acknowledgements

| Project | License | Used for |
|---------|---------|----------|
| [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Apache 2.0 | The tools the audit runs on |
| [web.dev Web Vitals](https://web.dev/articles/vitals) | CC BY 4.0 | Metric definitions and thresholds |
| [Lighthouse performance scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring) | CC BY 4.0 | Score weights |

## License

No license has been declared for this skill yet. See the [root README](../../README.md#license).
