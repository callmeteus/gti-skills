This scenario tests that an agent hunts for every stale reference after an alias rename and fixes each one at its source.
It covers topic 12, naming decisions that must survive across files.
The three repo state checks name the alert rule, the router upstream and the DNS record, so a partial cleanup fails.
The transcript forbid confirms the retired alias is gone from the closing message.
