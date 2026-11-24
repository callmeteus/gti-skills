# Judging a trial

Read this before the first verdict of every run.

## Procedure

1. Run `distill.py evidence <run>`. For each trial, read `evidence/trace.md` (what the student did), `evidence/checks.log`, `evidence/diffstat.txt`, and the screenshots.
2. Open the result yourself when the checks cannot capture it: run it, read the key files, drive it the way a user would.
3. Compare item by item with `acceptance.md` and with the reference.
4. Find the **first divergence**: the earliest point where the student's path went wrong in a way that explains the gap. Fixing a later symptom usually fails.
5. Record the verdict with `distill.py verdict`, including `--divergence`, `--note`, and the `--fix` you will make.

## Verdicts

| Verdict | Meaning |
|---------|---------|
| `match` | You would show it to the user as equal to the reference. If you would hesitate, it is `close` |
| `close` | Every acceptance item passes, but the craft or quality is visibly lower |
| `miss` | One or more acceptance items fail |
| `broken` | The trial did not produce a usable result, or its environment was broken |

The score is 0 to 10 against the reference, where 10 is indistinguishable.

## How to judge well

These were learned on real runs:

- **Judge craft at full resolution, side by side.** Feature parity is not "as good". In the upstream pilot, all three trials had every feature and matched at thumbnail size; the teacher scored them 8.5 to 9 and the user rejected them at once, because up close they were sparse and plain. Capture both at 2x scale, look at the same region of each, and list concrete craft gaps (detail per object, density, typography, motion) before you score.
- **The student often cannot see.** Give it a number it can check for each visual property you care about. In the pilot, "share of screen cells with visible detail" separated the reference (56%) from rejected trials (33 to 40%); the student skill got a script that prints it with a map of the empty regions.
- **The student's final message is not evidence.** Students routinely say "verified, all tests pass". Run the checks, then drive the result by hand (walk up, press the key, click the button) and look at the frame.
- **Probe the state, not only the first screen.** If the task has a core loop, check it at the start, middle, and end. For apps with saved state, build a mid-way and a finished state with the student's own code and inject it before the page's scripts run (Playwright `add_init_script`). Setting it and reloading fails, because many pages save over it on unload.
- **When a check fails, suspect the check first.** Rerun it on the reference. In the pilot, three of four "failures" were probe bugs: a guessed storage key, Escape opening a pause menu, a dismiss click that missed.
- **Compare like with like.** Whatever you do to a trial (live drive, injected state), do to the reference too, and put both in the report.
- **Stopped trials.** Do not stop a trial early unless it is clearly stuck (the same error for 10 minutes or more). If you stop one, say so in the verdict note.

## Web results

`scripts/capture/capture_web.py` serves a folder or runs a start command, drives the page in headless Chromium, and writes screenshots, `console.log`, and `capture.json` to an output folder. Call it from `checks.sh` so the reference and every trial are captured the same way:

```bash
python3 "<skill-dir>/scripts/capture/capture_web.py" --dir "$WORKSPACE" --out "$OUT" \
  --start "npx vite --port {port} --strictPort" --actions "$(dirname "$0")/actions.json"
```

Actions are a JSON list run in order: `{"wait": ms}`, `{"key": "KeyW", "hold": ms}`, `{"press": "KeyE"}`, `{"click": [x, y]}`, `{"click_text": "Start"}`, `{"js": "expression"}`, `{"shot": "name"}`. The exit code is 0 when the page loaded with no uncaught errors and the first screenshot is not blank.
