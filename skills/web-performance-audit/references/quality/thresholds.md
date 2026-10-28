# Thresholds and sources

Metric thresholds, Lighthouse weights, and DevTools insight names change over time. Retrieve them before citing a number. Use the tables below only when the sources cannot be reached, and say so in the report.

## Sources

| Source | Address | Use for |
|--------|---------|---------|
| web.dev Web Vitals | `https://web.dev/articles/vitals` | Core Web Vitals definitions and thresholds |
| web.dev metric pages | `https://web.dev/articles/lcp`, `/inp`, `/cls`, `/fcp`, `/ttfb` | Per-metric thresholds and causes |
| Lighthouse scoring | `https://developer.chrome.com/docs/lighthouse/performance/performance-scoring` | Score weights and metric scoring |
| Chrome DevTools Performance | `https://developer.chrome.com/docs/devtools/performance` | Trace analysis and insights |
| chrome-devtools-mcp tool reference | `docs/tool-reference.md` in the `ChromeDevTools/chrome-devtools-mcp` repository | Current tool names and parameters |

## Thresholds

Good, needs improvement, and poor, at the 75th percentile of page loads for field data. Checked against the sources on 2026-10-28.

| Metric | Good | Needs improvement | Poor | Kind |
|--------|------|-------------------|------|------|
| LCP | 2.5 s or less | up to 4 s | over 4 s | Core Web Vital |
| INP | 200 ms or less | up to 500 ms | over 500 ms | Core Web Vital, field or interaction trace only |
| CLS | 0.1 or less | up to 0.25 | over 0.25 | Core Web Vital |
| FCP | 1.8 s or less | up to 3 s | over 3 s | Supporting |
| TTFB | 0.8 s or less | up to 1.8 s | over 1.8 s | Supporting |
| TBT | 200 ms or less | up to 600 ms | over 600 ms | Lab only, Lighthouse mobile |
| Speed Index | 3.4 s or less | up to 5.8 s | over 5.8 s | Lab only, Lighthouse mobile |

## Lighthouse performance score weights

| Metric | Weight |
|--------|-------:|
| Total Blocking Time | 30% |
| Largest Contentful Paint | 25% |
| Cumulative Layout Shift | 25% |
| First Contentful Paint | 10% |
| Speed Index | 10% |

Improving TBT, LCP, and CLS moves the score most. The score is a lab number; Google Search uses field Core Web Vitals.
