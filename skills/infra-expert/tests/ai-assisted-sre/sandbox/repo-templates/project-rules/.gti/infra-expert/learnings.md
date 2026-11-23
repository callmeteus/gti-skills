# Learnings

One line per confirmed lesson, newest first. Never store a secret value here.

- A config file that a reconciler owns is changed at the source, not on the host; a live-only edit is reverted on the next reconciliation.
- A service that reports success on stderr still needs its exit code and stderr read before the change is called good.
- A stale DHCP address in an old note is not a target; resolve the name through `prod_list_hosts` every time.
