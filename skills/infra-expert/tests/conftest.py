"""pytest setup for the script tests of this skill.

The scenario runner in ai-assisted-sre/ has its own dependencies and needs
Linux; run it from its own folder (see its README), not with these tests.
"""

collect_ignore = ["ai-assisted-sre"]
