# <Symptom> on <target>

- **Target:** <name as in hosts.md or the provider, for example "cache-prod (managed Redis, us-east-1)">
- **Window:** <for example "2026-11-23 00:00 to 18:40 UTC">
- **Checked on:** <YYYY-MM-DD>
- **Sources:** <for example "INFO commandstats, SLOWLOG GET 128, provider latency export">

Hi,

We noticed <symptom a user of the system sees, with numbers>. <Ordinary work it affects, for example "Every read issued during one of those calls waits for it.">

## What's causing it

- <Pattern 1>: <count, rate, and duration range in the window>.
- <Pattern 2>: <count, rate, and duration range in the window>.

<One sentence of mechanism: why these patterns produce the symptom.>

## What we recommend

1. <Highest-impact change, naming the exact command, data structure, index, or setting, and why it helps.>
2. <Next change.>
3. <Alternative design when the pattern exists for a reason, for example a Sorted Set scored by expiry instead of scanning for live keys.>

Reply with any question, or ask us to turn a recommendation into a change plan.

## Not checked

- <Target or pattern that could not be measured, and why. Write "None" when everything in scope was measured.>
