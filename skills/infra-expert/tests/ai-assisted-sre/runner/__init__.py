"""Runner, check engine and report for the AI-assisted SRE scenario suite.

The runner prepares one scenario on the MiniStack notebook, drives a real
OpenCode agent inside an isolated container, evaluates scripted checks and an
LLM judge, and writes a Markdown report. It never connects to production.
"""
