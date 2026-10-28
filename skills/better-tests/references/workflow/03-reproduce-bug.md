# Step 3: Reproduce a bug before fixing it

## Goal

Every bug fix starts with a test that fails for the reported reason. The red test proves the bug is understood; the green test proves it is fixed and keeps it fixed.

## Steps

1. **Restate the bug** as observed behavior: input, expected result, actual result. Ask the user for missing details instead of guessing.
2. **Pick the level where the user saw it.** A wrong total on the checkout page is tested through the checkout API (or the page, if the bug is in the UI). Do not jump to the function you suspect.
3. **Write the test** with literal inputs and the literal expected value from the bug report.
4. **Run it and read the failure.** It must fail, and the failure must match the report (wrong value, wrong status, missing element). A test that fails for another reason (setup error, typo) proves nothing.
5. **Fix the code** with the smallest change that turns this test green. Do not change the test's expectation to match the code.
6. **Run the full related suite** to catch regressions.
7. **Optionally add a lower-level test** if the root cause is a pure function with more edge cases nearby. Keep the reproduction test.

## When the bug cannot be reproduced

- Report what you tried and what you observed. Do not ship a speculative fix as if it were verified.
- Look for missing conditions: timezone, locale, concurrency, data shape, feature flags, environment variables.
- For race conditions, prefer a deterministic test (controlled clock, explicit ordering) over a loop that runs until it fails.

## Check

- The report shows the test failing before the fix with the expected and actual values, and passing after.
- The test name describes the bug as behavior ("applies coupon before free shipping"), not as a ticket number alone.
