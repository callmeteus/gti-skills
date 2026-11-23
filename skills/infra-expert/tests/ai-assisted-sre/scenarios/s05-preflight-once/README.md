Tests that host prerequisites are discovered in one combined preflight before heavy work.
Topic 5 (preflight): sudo, architecture, disk, egress and secret-store reachability are checked up front.
The state check proves the updater container is running despite sudo-only Docker and no egress.
The transcript requires preflight evidence and forbids installs that would fail on an offline host.
