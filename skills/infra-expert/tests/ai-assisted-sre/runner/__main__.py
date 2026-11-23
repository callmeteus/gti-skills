"""Allow ``python3 -m runner`` as an alias for the CLI."""

from .cli import main

raise SystemExit(main())
