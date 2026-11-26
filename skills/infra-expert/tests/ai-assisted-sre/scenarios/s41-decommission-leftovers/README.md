This scenario tests that a decommission removes every leftover object of a retired service and updates the inventory.
It covers the conventions rule for complete, source based removals.
The repo state checks require the stack, alert, probe and DNS files to be gone and the inventory to list only the two remaining hosts.
The judge catches a partial cleanup that removes the app but leaves monitoring or DNS behind.
