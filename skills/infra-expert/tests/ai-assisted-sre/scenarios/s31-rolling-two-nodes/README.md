Tests that a two-node service is upgraded one node at a time with a health loop across the change.
Rule zero-downtime: drain, check and return one node before touching the next.
The state checks prove health stayed green on both nodes and both ended on the new version.
The transcript requires a rolling pattern and forbids restarting both nodes together.
