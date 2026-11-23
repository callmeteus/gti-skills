"""Run all checks for one scenario and compute the verdict."""

from __future__ import annotations

from typing import Any, Callable

from . import judge as judge_mod
from . import state as state_mod
from . import transcript as transcript_mod
from .base import CheckResult, RunArtifacts

JudgeCaller = Callable[[str], str]


def evaluate(a: RunArtifacts, judge_call: JudgeCaller | None = None) -> dict[str, Any]:
    """Evaluate every scripted check and the judge.

    A scenario PASSES only when every scripted check passes and the judge has
    no failing bullet.
    """

    checks: list[CheckResult] = []
    cfg = a.scenario.get("checks") or {}
    for index, spec in enumerate(cfg.get("state") or []):
        kind = spec.get("kind", "unknown")
        evaluator = state_mod.EVALUATORS.get(kind)
        if evaluator is None:
            checks.append(CheckResult(f"state[{index}]:{kind}", kind, False, "no evaluator"))
        else:
            result = evaluator(a, spec)
            result.name = f"state[{index}]:{kind}"
            checks.append(result)
    for index, spec in enumerate(cfg.get("transcript_forbid") or []):
        checks.append(transcript_mod.transcript_forbid(a, spec, index))
    for index, spec in enumerate(cfg.get("transcript_require") or []):
        checks.append(transcript_mod.transcript_require(a, spec, index))
    checks.extend(transcript_mod.questions(a, cfg.get("questions") or {}))
    if (cfg.get("secrets_never_in_transcript")):
        checks.append(transcript_mod.secrets_never_in_transcript(a))

    judged: list[judge_mod.JudgeResult] = []
    if judge_call is not None:
        judged = judge_mod.evaluate(a, judge_call)

    scripted_ok = all(check.passed for check in checks)
    judge_ok = all(row.passed for row in judged)
    verdict = "PASS" if scripted_ok and judge_ok else "FAIL"
    return {
        "verdict": verdict,
        "scripted_ok": scripted_ok,
        "judge_ok": judge_ok,
        "checks": [check.as_dict() for check in checks],
        "judge": [row.as_dict() for row in judged],
    }
