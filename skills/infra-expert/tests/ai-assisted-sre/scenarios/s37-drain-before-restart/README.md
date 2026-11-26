This scenario tests that a node is drained from the load balancer before a restart and rejoined only after a health check.
It covers the zero-downtime rule.
The ordered action log check proves the sequence rather than just the final version, and the target file check proves the node is serving again.
The state checks also confirm that the second node was never touched.
