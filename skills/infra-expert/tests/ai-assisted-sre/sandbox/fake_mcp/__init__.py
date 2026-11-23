"""Fake ``acme-prod`` MCP server: a stdio JSON-RPC server with six tools."""

from .guard import format_rejection_message, rejection_reason

__all__ = ["rejection_reason", "format_rejection_message"]
