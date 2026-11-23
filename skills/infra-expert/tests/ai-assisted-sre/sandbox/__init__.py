"""Sandbox for the AI-assisted SRE scenario tests.

Everything here is fake on purpose: a fake ACME repository, a fake production
MCP server, a fake pipeline and a fake secret store. The only real system the
fixtures touch is MiniStack, and only when a runner asks them to. Nothing in
this package knows the names of the operator's company or products.
"""
