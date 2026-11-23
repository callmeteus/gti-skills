"""Tiny file-backed secret store used by the fake MCP and the ``secret`` CLI."""

from .store import SecretStore

__all__ = ["SecretStore"]
