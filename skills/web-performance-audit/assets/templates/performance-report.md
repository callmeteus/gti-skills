# Performance audit: <page or URL>

## Setup

- **URL:** <url>
- **Conditions:** <viewport, CPU throttling, network, cold load>
- **Runs:** <one trace, or the median of three>
- **Tools:** <chrome-devtools-mcp version, or Lighthouse CLI fallback>
- **Codebase:** <framework and bundler detected, or "not available">

## Core Web Vitals summary

| Metric | Lab | Field p75 | Rating |
|--------|----:|----------:|--------|
| LCP | | | <good, needs improvement, poor> |
| INP | not measured on load | | |
| CLS | | | |
| FCP | | | |
| TTFB | | | |
| TBT | | lab only | |
| Speed Index | | lab only | |

<One sentence verdict. When everything is good, say so here and keep the rest short.>

## Top issues

Ranked by estimated savings.

| # | Issue | Evidence | Metric | Estimated savings | Impact |
|--:|-------|----------|--------|------------------:|--------|
| 1 | <cause> | <insight or request, file, size> | <LCP> | <ms or KB> | <high, medium, low> |

## Recommendations

### 1. <Fix in one line>

- **Why:** <the cause, from the evidence above>
- **Change:** <file or config to change>

```html
<!-- snippet or config change -->
```

- **Expected effect:** <metric and estimated savings>

## Accessibility gaps

- <element, gap, fix; or "None found in the snapshot">

## Codebase findings

Omit this section without code access.

- **Stack:** <framework, bundler, versions>
- **Findings:** <bundle sizes, wholesale imports, polyfills, image and font setup>

## No action needed

- <Insights with 0 ms savings or metrics already good, so nobody spends time on them.>

## Before and after

Only when changes were made and the page was traced again.

| Metric | Before | After |
|--------|-------:|------:|
