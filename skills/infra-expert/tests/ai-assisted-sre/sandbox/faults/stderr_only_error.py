"""Make a command print its error on stderr while still exiting zero."""


def apply(run):
    from . import config_for

    settings = config_for(run, "stderr-only-error")
    run.flag("stderr_only_error", {
        "command_pattern": settings.get("command_pattern", "*restart*"),
        "stderr": settings.get("stderr", "warning: unit entered failed state after restart"),
    })
