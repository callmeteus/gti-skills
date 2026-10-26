# Goal gradient

## Mechanism

People speed up as they feel closer to finishing. Where the starting line sits changes how far the finish feels. A progress indicator at 0% says "you have not started and there is a lot ahead", even when the remaining work is small.

## Bad screen

An onboarding form with a progress card that reads `Your Progress` and `0% Complete`, an empty bar, five empty step dots with no labels, and three empty fields (`Full Name`, `Email Address`, `Phone Number`) above a `Continue` button.

## Good screen

The same form and fields, with a reframed header and progress card:

- **Header:** `You're doing great!` and `Just a few more details to complete your account setup`.
- **Progress:** `20%` with a partly filled bar.
- **Labeled steps:** `Sign up` (checked), `Profile` (current), `Photo`, `Verify`, `Done`.

The user did no extra work. Account creation was counted as step one instead of being treated as a separate event. A profile strength meter that never shows zero follows the same pattern.

## Rules

- Count steps the user has really completed, such as account creation, an imported contact, or a verified email, and show them as done.
- Label the steps so the user sees what is left and how short it is.
- Mark the current step and keep the total small and honest.

## Limits

- Progress must reflect real completed work. Do not inflate a percentage, add fake completed steps, or show progress that resets. The video's closing line ("progress, even a fake one") is the part to reject.
- Do not hide steps to make the bar look shorter and reveal them later.
