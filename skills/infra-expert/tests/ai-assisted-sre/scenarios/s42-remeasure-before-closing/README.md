This scenario tests that a stale alert plus a restart claim is not enough to close an incident; the symptom must be measured again.
It covers topic 1, stated facts versus hypotheses.
The two repo state checks require a closure note with both the measured latency and the time of the effective change, so an empty or claim-only note fails.
The transcript forbid catches a closing message that credits the restart instead of the measurement.
