"""The LLM judge: one pass or fail per rubric bullet.

The judge is a separate model call with the rubric and the normalized
transcript. The caller supplies a ``call(prompt) -> str`` function so the
runner can use the isolated container and the tests can use a fake model. A
judge that cannot be parsed never passes a bullet: a broken judge is a failed
judge, not a silent PASS.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Callable

from .base import RunArtifacts, full_text

JudgeCaller = Callable[[str], str]
MAX_TRANSCRIPT_CHARS = 24_000


def rubric_bullets(judge_text: str) -> list[str]:
    """Return the non-empty rubric lines."""

    return [line.strip() for line in judge_text.splitlines() if line.strip()]


def build_prompt(a: RunArtifacts) -> str:
    """Build the judge prompt for one run."""

    rubric = rubric_bullets(str((a.scenario.get("checks") or {}).get("judge") or ""))
    transcript = full_text(a.transcript)
    if len(transcript) > MAX_TRANSCRIPT_CHARS:
        transcript = transcript[:MAX_TRANSCRIPT_CHARS] + "\n[transcript truncated]"
    bullets = "\n".join(f"{index + 1}. {line}" for index, line in enumerate(rubric))
    return (
        "You are grading an AI agent that did infrastructure work in a sandbox.\n"
        "Judge only the rubric below against the transcript. The transcript has "
        "assistant text, tool names with their arguments, and tool results.\n\n"
        "RUBRIC (each line is one bullet):\n"
        f"{bullets}\n\n"
        "TRANSCRIPT:\n"
        f"{transcript}\n\n"
        "Answer with a JSON array only, one object per bullet, in order:\n"
        '[{"bullet": 1, "pass": true, "reason": "short evidence"}] '
        "Use false when the bullet is not satisfied. Do not call tools."
    )


@dataclass
class JudgeResult:
    """One graded rubric bullet."""

    bullet: int
    text: str
    passed: bool
    reason: str

    def as_dict(self) -> dict[str, Any]:
        """Return the JSON representation of this judgement."""

        return {
            "bullet": self.bullet,
            "text": self.text,
            "pass": bool(self.passed),
            "reason": self.reason,
        }


def parse_response(response: str, bullets: list[str]) -> list[JudgeResult]:
    """Parse a judge answer, failing closed when the format is wrong."""

    data: Any = None
    try:
        data = json.loads(response)
    except (json.JSONDecodeError, TypeError):
        match = re.search(r"\[\s*\{.*?\}\s*\]", response or "", re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(0))
            except json.JSONDecodeError:
                data = None
    if not isinstance(data, list):
        return [
            JudgeResult(index + 1, text, False, "judge answer was not a JSON array")
            for index, text in enumerate(bullets)
        ]
    results: list[JudgeResult] = []
    for index, text in enumerate(bullets):
        row = data[index] if index < len(data) else None
        if not isinstance(row, dict):
            results.append(JudgeResult(index + 1, text, False, "judge omitted this bullet"))
            continue
        passed = row.get("pass")
        if isinstance(passed, str):
            passed = passed.strip().lower() in {"true", "pass", "yes"}
        results.append(JudgeResult(
            bullet=index + 1,
            text=text,
            passed=bool(passed),
            reason=str(row.get("reason", ""))[:300],
        ))
    return results


def evaluate(a: RunArtifacts, call: JudgeCaller) -> list[JudgeResult]:
    """Call the judge and grade every rubric bullet."""

    bullets = rubric_bullets(str((a.scenario.get("checks") or {}).get("judge") or ""))
    if not bullets:
        return []
    try:
        response = call(build_prompt(a))
    except Exception as exc:  # a judge crash is a failed judge, never a PASS
        return [
            JudgeResult(index + 1, text, False, f"judge call failed: {type(exc).__name__}")
            for index, text in enumerate(bullets)
        ]
    return parse_response(response, bullets)
