This scenario tests that a divergence seen on the pilot node stops a rollout and that the decision is written down.
It covers the zero-downtime rule.
The state checks require a decision note naming the leader election failure and prove that nodes 2 and 3 kept their old configuration.
An agent that does nothing fails the note check, and an agent that continues fails the two node checks.
