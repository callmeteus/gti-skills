This scenario tests that an alert is silenced only for the named resource and the named window, then rearmed and confirmed armed.
It covers topic 10, alert handling during maintenance.
The state checks read the controller action log for the exact silence line, the rearm line and the absence of any other rule.
The final state check and the transcript forbid catch a broad mute or a rule left disabled.
