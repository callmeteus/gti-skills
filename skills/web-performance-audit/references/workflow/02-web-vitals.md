# Phase 2: Core Web Vitals and insights

## Goal

A rating for each metric and, for every metric that is not good, the cause from the trace.

## Rate the metrics

Rate LCP, CLS, TBT, FCP, Speed Index, and TTFB from the trace with the thresholds file linked from step 2 of `SKILL.md`, after checking them against the sources it lists.

INP needs real interactions. A load trace does not measure it. Use field data, or record a second trace without reload while you click the main controls (`performance_start_trace(pageId, reload: false, autoStop: false)`, interact with `click` or `type_text`, then `performance_stop_trace`). TBT is the lab proxy for main-thread blocking.

## Open the insights

Call `performance_analyze_insight(pageId, insightSetId, insightName)` for each insight the trace flags with savings. Common names:

| Metric | Insight | What to look for |
|--------|---------|------------------|
| LCP | `LCPBreakdown` | Which phase is long: TTFB, resource load delay, resource load duration, or render delay |
| LCP | `LCPDiscovery` | LCP image not discoverable in the HTML, lazy loaded, or missing `fetchpriority="high"` |
| CLS | `CLSCulprits` | Images without dimensions, injected content, web font swaps, animations of layout properties |
| FCP, LCP | `RenderBlocking` | CSS and JS that block the first paint, with estimated savings |
| TTFB | `DocumentLatency` | Slow server response, redirects, no compression |
| LCP | `NetworkDependencyTree` | Chains that delay critical resources |
| LCP | `ImageDelivery` | Oversized images, old formats, poor compression |
| FCP, CLS | `FontDisplay` | Web fonts that block text or swap late |
| Repeat visits | `Cache` | Static assets with short or missing cache lifetimes |
| TBT | `ThirdParties` | Third-party scripts and their main-thread time |
| TBT | `LegacyJavaScript`, `DuplicatedJavaScript` | Polyfills modern browsers do not need, modules shipped twice |
| TBT, INP | `ForcedReflow`, `DOMSize` | Layout thrashing, very large DOMs |
| INP | `INPBreakdown` | Input delay, processing, and presentation delay of the slowest interaction (interaction trace only) |

These names match the DevTools insights at the time of writing. Use the names the trace response lists; they change between versions.

## Read the LCP breakdown

| Long phase | Usual cause | Usual fix |
|------------|-------------|-----------|
| TTFB | Slow server, no cache, redirects | Cache the HTML at the edge, remove redirects |
| Resource load delay | LCP image found late (CSS background, JS rendered, lazy loaded) | `<img>` in the HTML, `fetchpriority="high"`, preload |
| Resource load duration | Heavy image | Modern format, right size, responsive `srcset` |
| Render delay | Blocking CSS or JS, client rendering, font blocking text | Inline critical CSS, defer scripts, server render, `font-display` |

## Add field data

For a public site, read the Chrome UX Report through the PageSpeed Insights API:

```bash
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fexample.com&strategy=mobile&category=performance"
```

`loadingExperience.metrics` holds the page's p75 values (LCP, INP, CLS, FCP, TTFB) and `originLoadingExperience` the origin's. When there is not enough traffic, the fields are missing; say so. Do not send private or staging URLs to the API.

## Check

- Every metric has a value, a rating, and its source (lab trace, field data, or Lighthouse fallback).
- Every metric that is not good has a cause from an insight, not a guess.
