# Phase 1: Performance trace

## Goal

One clean cold-load trace under conditions close to a mid-range phone, so the numbers reflect what most users see.

## Steps

1. **Open the page.** `new_page(url: "<target-url>")`, or reuse a page from `list_pages` and `navigate_page` to the URL. Confirm the page loaded the expected content (title, main heading) before tracing; a trace of an error page or a consent wall is useless.
2. **Emulate a phone.** In one call: a mobile viewport, CPU throttling 4x, and `networkConditions: "Slow 4G"`. Note the settings for the report. Run a second, unthrottled desktop trace only when the user cares about desktop.
3. **Record.** `performance_start_trace(pageId, reload: true, autoStop: true, ignoreCache: true)`. The trace reloads the page and stops on its own after the load.
4. **Read the response.** It lists the metrics and the "Available insight sets" with their ids. Keep the insight set id for Phase 2. Save the raw trace with `filePath` when the user may want to open it in the DevTools Performance panel.
5. **Repeat when close to a threshold.** Lab runs vary. When a metric is within about 10 percent of a threshold, record two more traces and report the median.

## Login and consent

- If the page needs a login, ask the user to sign in in the browser the server opened, then trace. Never type credentials.
- If a cookie banner covers the page, note it: it is often the LCP element or a layout shift. Do not accept terms for the user; trace as a first-time visitor sees it.

## Troubleshooting

- **Empty or failed trace:** check that `navigate_page` reached the URL, then trace again.
- **Insight name not found:** the names differ between DevTools versions. Use the names listed in the trace response.
- **Wildly different runs:** close other heavy tabs, check that throttling is set, and take the median of three.
