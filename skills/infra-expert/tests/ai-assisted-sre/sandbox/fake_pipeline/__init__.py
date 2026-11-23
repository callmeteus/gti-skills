"""Fake pipeline: ``pipeline plan|apply <leaf>`` and ``pipeline status <run>``."""

from .cli import load_pipeline, main, read_status, run_leaf

__all__ = ["load_pipeline", "main", "read_status", "run_leaf"]
