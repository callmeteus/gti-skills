"""Shared constants and the one rendering path for thinkingmachines/Inkling-2-Small.

Every script in this skill imports from here, so the dataset builder, the trainer,
the behaviour probe, the conversational-slice sampler and the merge check all see
exactly the same tokens:

  * the cookbook renderer resolved from the model name (``tml_v0``; never hardcoded)
    over ``get_tokenizer(model)``, which is the H200K vocabulary for Inkling 2. The
    o200k vocabulary of Inkling and Inkling-Small counts differently and must not be
    reused; tml-renderers older than 0.4.0 silently fell back to it for Inkling 2;
  * tools declared with ``create_conversation_prefix_with_tools`` (a zero-loss
    tool-declaration message after the row's system prompt);
  * one explicit thinking effort on every row (0.9 = "high"); serve and evaluate the
    checkpoint knowing which effort it was trained at;
  * loss on every assistant message, including its thinking, with the cookbook's
    mean reduction per row.

``Renderer.provenance`` records model, renderer, tokenizer, effort and package
versions; the trainer refuses a dataset whose report carries a different one.

Generated files (datasets, runs, checks) live in the work folder,
``~/.gti/llm-fine-tuning/<project>/`` (``GTI_HOME`` replaces ``~/.gti``), never in
the user's repository. A bare name such as ``my-run`` given to a script resolves
inside that folder; a path with a folder in it is used as given.

Adapted from https://github.com/drost-ai/finetune-inkling-2-small (MIT).
"""
from __future__ import annotations

import hashlib
import importlib.metadata as _meta
import json
import os
import tempfile
from pathlib import Path

SKILL_ID = "llm-fine-tuning"


# --------------------------------------------------------------- work folder
def project_name(start=None):
    """The git root's folder name, or the current folder's."""
    here = Path(start or Path.cwd()).resolve()
    for folder in (here, *here.parents):
        if (folder / ".git").exists():
            return folder.name or "project"
    return here.name or "project"


def gti_root():
    """~/.gti/llm-fine-tuning (GTI_HOME replaces ~/.gti)."""
    return Path(os.environ.get("GTI_HOME") or Path.home() / ".gti").expanduser() / SKILL_ID


def work_dir(*parts):
    """~/.gti/llm-fine-tuning/<project>/<parts>; created on first use."""
    folder = gti_root().joinpath(project_name(), *parts)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def work_path(value, sub):
    """A bare name resolves to <work folder>/<sub>/<name>; anything with a folder is used as given."""
    p = Path(value).expanduser()
    if p.is_absolute() or len(p.parts) > 1:
        return p
    return work_dir(sub) / p

# ----------------------------------------------------------------- the model
MODEL = "thinkingmachines/Inkling-2-Small"            # Tinker: 64K variant
MODEL_256K = MODEL + ":peft:262144"                    # Tinker: 256K variant
CONTEXT_CAP = {MODEL: 65_536, MODEL_256K: 262_144}     # prompt + output, hard caps on Tinker
EFFORT = 0.9                                           # "high", the renderer default

# Tinker list prices in USD per million tokens, November 2026. Check
# https://tinker-docs.thinkingmachines.ai/tinker/models/models_and_pricing/ before quoting.
TRAIN_PRICE = {MODEL: 1.50, MODEL_256K: 3.00}
SAMPLE_PRICE = {"prompt": 0.30, "cached_prompt": 0.03, "output": 1.00}

TINKER_OAI_URL = "https://tinker.thinkingmachines.dev/services/tinker-prod/oai/api/v1"
TINKER_ANTHROPIC_URL = "https://tinker.thinkingmachines.dev/services/tinker-prod/anthropic/api/v1"

# Adapter shapes (see references/adapter-shape.md).
ADAPTERS = {
    # Mergeable exactly into the released NVFP4/MXFP8 checkpoint: experts stay frozen.
    "release": {"lora_rank": 32, "train_attn": True, "train_mlp": False, "train_unembed": True},
    # Best NLL, but the expert LoRA cannot be merged into 4-bit experts: serve on Tinker.
    "full": {"lora_rank": 8, "train_attn": True, "train_mlp": True, "train_unembed": True},
}

ROLES = {"system", "user", "assistant", "tool"}


# ------------------------------------------------------------------ helpers
def load_dotenv():
    """Load KEY=VALUE lines from ~/.gti/llm-fine-tuning/.env, else ./.env. Never overrides the shell.

    Keep keys in the ~/.gti file so they never sit in a repository."""
    for env_file in (gti_root() / ".env", Path.cwd() / ".env"):
        if not env_file.is_file():
            continue
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
        return env_file
    return None


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


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
    path.write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n")


def dataset_paths(prefix):
    """my-run (or a path prefix) -> {train, val, report, manifest} paths.

    A bare name resolves to <work folder>/datasets/<name>."""
    prefix = work_path(prefix, "datasets")
    return {k: prefix.with_name(f"{prefix.name}.{k}.{'jsonl' if k in ('train', 'val') else 'json'}")
            for k in ("train", "val", "report", "manifest")}


# ------------------------------------------------------- message normalization
class RowError(ValueError):
    pass


def _thinking_text(m):
    for key in ("reasoning_content", "reasoning", "thinking"):
        v = m.get(key)
        if isinstance(v, str) and v.strip():
            return v
    return None


def normalize_message(m):
    """Accept OpenAI-style or cookbook-style messages; return the dataset form.

    Assistant thinking may arrive as content parts ({"type": "thinking"}) or as a
    ``reasoning_content`` / ``reasoning`` field (vLLM, SGLang, OpenRouter exports);
    both become a leading thinking part. Tool-call arguments become JSON strings.
    """
    role = m.get("role")
    if role not in ROLES:
        raise RowError(f"unknown role {role!r}")
    out = {"role": role}
    content = m.get("content")
    if role == "assistant":
        parts = []
        think = _thinking_text(m)
        if think:
            parts.append({"type": "thinking", "thinking": think})
        if isinstance(content, str):
            if content.strip():
                parts.append({"type": "text", "text": content})
        elif isinstance(content, list):
            for p in content:
                t = p.get("type")
                if t == "thinking" and (p.get("thinking") or "").strip():
                    if think is None:
                        parts.append({"type": "thinking", "thinking": p["thinking"]})
                elif t in ("text", "output_text") and (p.get("text") or "").strip():
                    parts.append({"type": "text", "text": p["text"]})
                elif t in ("image", "image_url", "input_image"):
                    raise RowError("image parts are not handled by this skill (text-only fine-tuning)")
        elif content is not None:
            raise RowError(f"assistant content of type {type(content).__name__}")
        out["content"] = parts
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
        if not parts and not calls:
            raise RowError("empty assistant message")
        return out
    # system / user / tool: plain text
    if isinstance(content, list):
        texts = []
        for p in content:
            if p.get("type") in ("text", "input_text"):
                texts.append(p.get("text") or "")
            elif p.get("type") in ("image", "image_url", "input_image"):
                raise RowError("image parts are not handled by this skill (text-only fine-tuning)")
        content = "\n".join(texts)
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
    tool call is waiting for its result is harness noise (Claude Code logs API errors
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
    """Structural checks; returns a list of warnings, raises RowError on hard errors."""
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
                # Claude Code logs results of parallel calls interleaved with the next
                # assistant turn; real, and it renders fine.
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


# ------------------------------------------------------------------ rendering
def to_render_message(d):
    """Dataset message -> cookbook Message (tool_calls dicts -> ToolCall)."""
    from tinker_cookbook.renderers.base import ToolCall
    m = {"role": d["role"]}
    if d.get("content") is not None:
        m["content"] = d["content"]
    if d["role"] == "tool" and d.get("tool_call_id"):
        m["tool_call_id"] = d["tool_call_id"]
    if d.get("tool_calls"):
        m["tool_calls"] = [ToolCall(id=tc.get("id"),
                                    function=ToolCall.FunctionBody(name=tc["function"]["name"],
                                                                   arguments=tc["function"]["arguments"]))
                           for tc in d["tool_calls"]]
    return m


def tool_specs(tools):
    from tinker_cookbook.renderers.base import ToolSpec
    return [ToolSpec(name=t["function"]["name"], description=t["function"].get("description", ""),
                     parameters=t["function"].get("parameters") or {"type": "object", "properties": {}})
            for t in tools or []]


class Renderer:
    """The single rendering path for Inkling 2 Small (training, probing, sampling, checks)."""

    def __init__(self, model_name=MODEL, effort=EFFORT):
        from tinker_cookbook import model_info
        from tinker_cookbook.renderers import TrainOnWhat, get_renderer
        from tinker_cookbook.tokenizer_utils import get_tokenizer
        if not model_name.startswith(MODEL):
            raise ValueError(f"this skill targets {MODEL} (got {model_name})")
        self.model_name, self.effort = model_name, float(effort)
        self.train_on_what = TrainOnWhat.ALL_ASSISTANT_MESSAGES
        self.renderer_name = model_info.get_recommended_renderer_name(model_name)
        self.tokenizer = get_tokenizer(model_name)
        self.renderer = get_renderer(self.renderer_name, self.tokenizer)
        tok = getattr(self.tokenizer, "tml_tokenizer", self.tokenizer)
        self.provenance = {
            "model": MODEL,  # both Tinker variants share renderer and tokenizer
            "renderer": self.renderer_name,
            "renderer_class": type(self.renderer).__name__,
            "tokenizer": type(tok).__name__,
            "effort": self.effort,
            "train_on_what": self.train_on_what.value,
            "tml_renderers": _meta.version("tml-renderers"),
            "tinker_cookbook": _meta.version("tinker-cookbook"),
        }
        if self.provenance["tokenizer"] != "H200kBaseChatTokenizer":
            raise RuntimeError(
                f"Inkling 2 must render with the H200K tokenizer, got {self.provenance['tokenizer']}: "
                f"upgrade tml-renderers (>=0.4.0) and tinker-cookbook (>=0.6.0)")

    def conversation(self, messages, tools=None):
        """System prompt (if any), then the tool declaration (if any tools), then the rest."""
        has_system = bool(messages) and messages[0]["role"] == "system"
        prefix = self.renderer.create_conversation_prefix_with_tools(
            tool_specs(tools), system_prompt=messages[0]["content"] if has_system else "")
        return prefix + [to_render_message(m) for m in (messages[1:] if has_system else messages)]

    def supervised_example(self, messages, tools=None):
        return self.renderer.build_supervised_example(
            self.conversation(messages, tools), self.train_on_what, effort=self.effort)

    def render(self, messages, tools=None):
        """(token ids, 0/1 loss mask). Loss tokens = sum(mask[1:]), what the cookbook keeps
        after next-token shifting."""
        model_input, weights = self.supervised_example(messages, tools)
        return model_input.to_ints(), [1 if w > 0 else 0 for w in weights.tolist()]

    def generation_prompt(self, messages, tools=None):
        return self.renderer.build_generation_prompt(self.conversation(messages, tools), effort=self.effort)

    def datum(self, messages, max_len, tools=None):
        """Training datum; never silently truncates."""
        from tinker_cookbook.supervised.common import datum_from_model_input_weights
        model_input, weights = self.supervised_example(messages, tools)
        if model_input.length > max_len:
            raise ValueError(f"rendered row has {model_input.length} tokens > {max_len}")
        if not any(w > 0 for w in weights[1:].tolist()):
            raise ValueError("rendered row has no loss tokens")
        return datum_from_model_input_weights(model_input, weights, max_length=None, reduction="mean")
