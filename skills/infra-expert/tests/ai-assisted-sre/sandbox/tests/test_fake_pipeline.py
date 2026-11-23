"""The fake pipeline only runs leaves listed in pipeline.yaml."""

from __future__ import annotations

from pathlib import Path

import pytest

from sandbox import fake_pipeline


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A tiny ACME repo with one listed leaf."""

    (tmp_path / "pipeline.yaml").write_text(
        "version: 1\nterraform_version: v1.17.0\nleaves:\n  - shop\n", encoding="utf-8"
    )
    (tmp_path / "infra" / "terraform" / "services" / "shop").mkdir(parents=True)
    return tmp_path


@pytest.fixture
def isolated_runs(monkeypatch, tmp_path: Path) -> Path:
    """Keep pipeline logs out of the real sandbox runs directory."""

    root = tmp_path / "runs-root"
    monkeypatch.setenv("ACME_SANDBOX_ROOT", str(root))
    return root


def test_pipeline_yaml_parser(repo: Path) -> None:
    """Leaves and the version come from the repository file."""

    assert fake_pipeline.load_pipeline(repo) == {"leaves": ["shop"], "terraform_version": "v1.17.0"}


def test_unknown_leaf_is_refused_and_logged(repo: Path, isolated_runs: Path, capsys) -> None:
    """A leaf outside pipeline.yaml never reaches Terraform."""

    code = fake_pipeline.main([
        "--repo", str(repo), "--run-id", "s01-test", "apply", "not-a-leaf",
    ])
    assert code == 2
    assert "refusing unknown leaf" in capsys.readouterr().err
    rows = fake_pipeline.read_status("s01-test")
    assert len(rows) == 1
    assert rows[0]["leaf"] == "not-a-leaf"
    assert rows[0]["exit_code"] == 2


def test_listed_leaf_runs_commands_and_logs(repo: Path, isolated_runs: Path) -> None:
    """A plan runs init then plan with an injected runner, and is logged."""

    seen: list[list[str]] = []

    def runner(command: list[str], cwd: Path) -> tuple[int, str, str]:
        seen.append(command)
        return 0, "no changes", ""

    exit_code = fake_pipeline.run_leaf(repo, "shop", "plan", "s02-plan", runner=runner)
    assert exit_code == 0
    assert [cmd[2] for cmd in seen] == ["init", "plan"]
    rows = fake_pipeline.read_status("s02-plan")
    assert rows[-1]["leaf"] == "shop"
    assert "no changes" in rows[-1]["stdout"]
    assert rows[-1]["exit_code"] == 0


def test_failed_plan_keeps_stderr_and_stops(repo: Path, isolated_runs: Path) -> None:
    """A failing init stops the run and its stderr is preserved."""

    def runner(command: list[str], cwd: Path) -> tuple[int, str, str]:
        return 1, "", "backend unreachable"

    assert fake_pipeline.run_leaf(repo, "shop", "apply", "s03-fail", runner=runner) == 1
    rows = fake_pipeline.read_status("s03-fail")
    assert rows[-1]["stderr"] == "backend unreachable"
