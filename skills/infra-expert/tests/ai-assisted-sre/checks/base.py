"""Shared shapes and the normalized transcript used by every evaluator.

OpenCode exports a session as ``{info, messages}``. Each assistant message has
a ``content`` list with ``text``, ``reasoning`` and ``tool`` parts; a tool part
carries its name, its input and its result. The normalized view keeps exactly
what a check needs: assistant text, tool calls with arguments, and tool
results. Reasoning is dropped so a check never depends on private thought
text.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class CheckResult:
    """The outcome of one scripted check."""

    name: str
    kind: str
    passed: bool
    detail: str = ""

    def as_dict(self) -> dict[str, Any]:
        """Return the JSON representation stored in ``result.json``."""

        return {
            "name": self.name,
            "kind": self.kind,
            "passed": bool(self.passed),
            "detail": self.detail,
        }


@dataclass
class RunArtifacts:
    """Everything a check needs, gathered once after the agent has finished."""

    scenario: dict[str, Any]
    run_id: str
    root: Path
    run: Any
    repo: Path
    transcript: list[dict[str, Any]] = field(default_factory=list)
    mcp_log: list[dict[str, Any]] = field(default_factory=list)
    pipeline_log: list[dict[str, Any]] = field(default_factory=list)
    secret_values: list[str] = field(default_factory=list)
    repo_baseline: dict[str, float] = field(default_factory=dict)
    health_samples: list[dict[str, Any]] = field(default_factory=list)
    container_running: bool = False


def _tool_text(part: dict[str, Any]) -> str:
    """Join the text content of a tool part's result."""

    state = part.get("state") or {}
    chunks = state.get("content") or []
    texts: list[str] = []
    for chunk in chunks:
        if isinstance(chunk, dict) and chunk.get("type") == "text":
            texts.append(str(chunk.get("text", "")))
        elif isinstance(chunk, str):
            texts.append(chunk)
    return "\n".join(texts)


def normalize_transcript(export: dict[str, Any]) -> list[dict[str, Any]]:
    """Flatten an OpenCode session export into assistant/tool/user entries."""

    entries: list[dict[str, Any]] = []
    for message in export.get("messages") or []:
        role = message.get("type")
        if role == "user":
            entries.append({"role": "user", "text": str(message.get("text", ""))})
            continue
        if role != "assistant":
            continue
        content = message.get("content")
        if not isinstance(content, list):
            text = str(message.get("text", ""))
            if text:
                entries.append({"role": "assistant", "text": text})
            continue
        for part in content:
            if not isinstance(part, dict):
                continue
            kind = part.get("type")
            if kind == "text":
                text = str(part.get("text", ""))
                if text:
                    entries.append({"role": "assistant", "text": text})
            elif kind == "tool":
                state = part.get("state") or {}
                entries.append({
                    "role": "tool_call",
                    "name": str(part.get("name", "")),
                    "args": state.get("input") or {},
                    "result": _tool_text(part),
                    "status": str(state.get("status", "")),
                })
    return entries


def entry_text(entry: dict[str, Any]) -> str:
    """Return the searchable text of one normalized entry."""

    if entry.get("role") == "tool_call":
        args = entry.get("args")
        return "\n".join([
            str(entry.get("name", "")),
            json.dumps(args, ensure_ascii=False, sort_keys=True) if isinstance(args, (dict, list)) else str(args or ""),
            str(entry.get("result", "")),
        ])
    return str(entry.get("text", ""))


def full_text(entries: list[dict[str, Any]]) -> str:
    """Return the whole normalized transcript as one searchable string."""

    return "\n".join(entry_text(entry) for entry in entries)


def assistant_turns(entries: list[dict[str, Any]]) -> list[str]:
    """Group consecutive assistant text parts into turns."""

    turns: list[str] = []
    current: list[str] = []
    for entry in entries:
        if entry.get("role") == "assistant":
            current.append(str(entry.get("text", "")))
        else:
            if current:
                turns.append("\n".join(current))
                current = []
    if current:
        turns.append("\n".join(current))
    return turns


def final_answer(entries: list[dict[str, Any]]) -> str:
    """Return the closing assistant turn."""

    turns = assistant_turns(entries)
    return turns[-1] if turns else ""


WRITE_TOOLS = {"prod_ssh_exec", "write", "edit", "patch", "apply_patch", "multiedit"}


def diagnostic_commands(entries: list[dict[str, Any]]) -> list[str]:
    """Return command strings from read-only exec tool calls."""

    commands: list[str] = []
    for entry in entries:
        if entry.get("role") != "tool_call":
            continue
        if str(entry.get("name", "")) in WRITE_TOOLS:
            continue
        args = entry.get("args") or {}
        if not isinstance(args, dict):
            continue
        command = args.get("command") or args.get("command_base64")
        if command:
            commands.append(str(command))
    return commands


def find(pattern: str, text: str) -> bool:
    """Whether a regex matches a piece of text; invalid patterns do not match."""

    try:
        return re.search(pattern, text) is not None
    except re.error:
        return False
