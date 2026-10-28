# User flows with Playwright

## Goal

Test the journeys that matter the way a user takes them: in a real browser, against the running app, asserting what the user sees.

## Explore with the Playwright MCP server

When the agent has the Playwright MCP server (`@playwright/mcp`) or another browser tool, use it before writing the test:

1. Open the app and walk the flow by hand: the happy path and the most important failure.
2. Note the accessible names of the controls you used (button text, labels, headings).
3. Note what proves success: a confirmation message, a new row, a URL change.

Then write the test with `@playwright/test` (or the project's existing E2E runner). The MCP session is for exploration; the committed test file is what runs in CI.

## Writing the test

- **Locate like a user.** Prefer `getByRole`, `getByLabel`, and `getByText`. Use `getByTestId` only when nothing user-visible identifies the element. Never use CSS class chains or XPath.
- **Assert like a user.** Use web-first assertions (`await expect(locator).toBeVisible()`, `toHaveText`, `toHaveURL`) that wait automatically. Never add fixed waits.
- **Isolate data.** Create the data each test needs through the API or a seed helper, with unique names, so tests can run in parallel.
- **Skip the login screen** after one test covers it: save an authenticated storage state and reuse it.
- **Stub only third parties** with `page.route`, for example a payment provider. Keep the app's own backend real.

## How many

- One test per critical journey, plus its most important failure path.
- Put input variations at the API level, not in more browser tests.

## Check

- The test reads as the user's steps and expectations.
- No `waitForTimeout`, no CSS selectors, no shared mutable data between tests.
- The test was seen failing when the flow was broken.
