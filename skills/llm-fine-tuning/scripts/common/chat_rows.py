"""Chat rows for supervised fine-tuning: read, normalize, and check them. Standard library only.

A row is one JSON object per line:

    {"messages": [...], "tools": [...], "group": "<session id>"}

Messages are OpenAI-style. Assistant thinking may arrive as a leading
{"type": "thinking"} content part or as a reasoning_content / reasoning / thinking
field. Tools are OpenAI function definitions or bare {"name", "description",
"parameters"}. "group" keeps windows of one session on one side of the split.

The normalized form written back out is OpenAI chat format: string content, the
thinking in "reasoning_content", tool-call arguments as JSON strings.

The checks follow the rules in the Inkling 2 Small recipe
(https://github.com/drost-ai/finetune-inkling-2-small, MIT), made model-agnostic.
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path

ROLES = {"system", "user", "assistant", "tool"}
IMAGE_TYPES = ("image", "image_url", "input_image")


class RowError(ValueError):
    pass


def read_jsonl(path):
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if line.strip():
                yield n, json.loads(line)


def write_jsonl(path, rows):
    """Atomic: write beside the target, then rename."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=path.name, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    os.replace(tmp, path)


def write_json(path, obj):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def _thinking_field(m):
    for key in ("reasoning_content", "reasoning", "thinking"):
        v = m.get(key)
        if isinstance(v, str) and v.strip():
            return v
    return None


def normalize_message(m):
    """One message -> OpenAI form with string content and optional reasoning_content."""
    role = m.get("role")
    if role not in ROLES:
        raise RowError(f"unknown role {role!r}")
    out = {"role": role}
    content = m.get("content")
    if role == "assistant":
        thinking = _thinking_field(m)
        texts = []
        if isinstance(content, str):
            if content.strip():
                texts.append(content)
        elif isinstance(content, list):
            for p in content:
                t = p.get("type")
                if t == "thinking" and (p.get("thinking") or "").strip():
                    thinking = thinking or p["thinking"]
                elif t in ("text", "output_text") and (p.get("text") or "").strip():
                    texts.append(p["text"])
                elif t in IMAGE_TYPES:
                    raise RowError("image parts are not handled (text-only fine-tuning)")
        elif content is not None:
            raise RowError(f"assistant content of type {type(content).__name__}")
        if thinking:
            out["reasoning_content"] = thinking
        out["content"] = "\n".join(texts)
        calls = []
        for i, tc in enumerate(m.get("tool_calls") or []):
            fn = tc.get("function") or {}
            name = fn.get("name")
            if not name:
                raise RowError("tool call without a function name")
            args = fn.get("arguments", "{}")
            if not isinstance(args, str):
                args = json.dumps(args, ensure_ascii=False)
            calls.append({"id": tc.get("id") or f"call_{i}", "type": "function",
                          "function": {"name": name, "arguments": args}})
        if calls:
            out["tool_calls"] = calls
        if not texts and not calls:
            raise RowError("empty assistant message")
        return out
    if isinstance(content, list):
        parts = []
        for p in content:
            if p.get("type") in ("text", "input_text"):
                parts.append(p.get("text") or "")
            elif p.get("type") in IMAGE_TYPES:
                raise RowError("image parts are not handled (text-only fine-tuning)")
        content = "\n".join(parts)
    if not isinstance(content, str):
        raise RowError(f"{role} content must be text")
    out["content"] = content
    if role == "tool":
        if not m.get("tool_call_id"):
            raise RowError("tool message without tool_call_id")
        out["tool_call_id"] = m["tool_call_id"]
    return out


def normalize_tools(tools):
    """OpenAI tool dicts, or bare {"name", "description", "parameters"} -> OpenAI tool dicts."""
    out = []
    for t in tools or []:
        f = t.get("function", t)
        if not f.get("name"):
            raise RowError("tool definition without a name")
        out.append({"type": "function", "function": {
            "name": f["name"], "description": f.get("description", ""),
            "parameters": f.get("parameters") or {"type": "object", "properties": {}}}})
    return out


def normalize_row(raw_messages):
    """Normalize every message of a row; returns (messages, warnings).

    One repair, reported as a warning: a tool message with no tool_call_id while no
    tool call is waiting for its result is harness noise (some agents log API errors
    such as "529 Overloaded" that way) and is dropped. With a call still open, a
    missing id is ambiguous and stays an error.
    """
    if not isinstance(raw_messages, list) or not raw_messages:
        raise RowError("no 'messages' list")
    out, warnings, open_calls = [], [], set()
    for m in raw_messages:
        if m.get("role") == "tool" and not m.get("tool_call_id") and not open_calls:
            warnings.append("dropped a tool message with no tool_call_id while no call was open (harness noise)")
            continue
        msg = normalize_message(m)
        if msg["role"] == "assistant":
            open_calls.update(tc["id"] for tc in msg.get("tool_calls", []))
        elif msg["role"] == "tool":
            open_calls.discard(msg["tool_call_id"])
        out.append(msg)
    return out, warnings


def check_conversation(messages):
    """Structural checks; returns warnings, raises RowError on hard errors."""
    if not messages:
        raise RowError("no messages")
    warnings = []
    for i, m in enumerate(messages):
        if m["role"] == "system" and i != 0:
            raise RowError(f"system message at position {i} (only the first message may be a system prompt)")
    issued, open_calls = set(), {}
    for i, m in enumerate(messages):
        if m["role"] == "assistant":
            if open_calls:
                warnings.append("tool results interleaved with a later assistant turn (parallel calls)")
            for tc in m.get("tool_calls", []):
                issued.add(tc["id"])
                open_calls[tc["id"]] = i
        elif m["role"] == "tool":
            if m["tool_call_id"] not in issued:
                raise RowError(f"tool result at {i} answers a call that was never made ({m['tool_call_id']!r})")
            open_calls.pop(m["tool_call_id"], None)
        elif m["role"] == "user" and open_calls:
            warnings.append("user turn before every tool call was answered")
    if open_calls:
        warnings.append("tool calls left unanswered (fine at the end of a row: the call itself is the target)")
    if not any(m["role"] == "assistant" for m in messages):
        raise RowError("no assistant message to train on")
    return warnings


def opens_with_tool_call(messages):
    """True if the first assistant message after the first user message calls a tool."""
    seen_user = False
    for m in messages:
        if m["role"] == "user":
            seen_user = True
        elif m["role"] == "assistant" and seen_user:
            return bool(m.get("tool_calls"))
    return False


def split_of(group, seed, val_fraction):
    """Seeded split by group: the same group always lands on the same side."""
    h = int(hashlib.sha256(f"{seed}:{group}".encode()).hexdigest()[:12], 16) / float(1 << 48)
    return "val" if h < val_fraction else "train"
