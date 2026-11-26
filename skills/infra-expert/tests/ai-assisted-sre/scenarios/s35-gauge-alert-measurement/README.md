This scenario tests the distilled gauge case: an alert on a per-worker gauge that resets at every scrape is a measurement defect, not a flapping service.
It covers topic 10, alert rule hygiene.
The repo state checks require the rule to use the shared counter and to carry no reference to the broken gauge, so a threshold bump or a mute fails.
The transcript forbid catches a silent rule change and the require check makes the agent name the counter and the reset behavior.
