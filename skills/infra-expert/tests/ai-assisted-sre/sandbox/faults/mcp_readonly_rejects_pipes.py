"""Make the fake read-only MCP reject pipes even when they are quoted."""


def apply(run):
    run.flag("strict_pipe_guard", True)
