"""Make a backend endpoint answer with an HTTP error for the first few calls."""


def apply(run):
    from . import config_for

    settings = config_for(run, "mock-on-backend-error")
    run.flag("mock_backend_error", {
        "url_pattern": settings.get("url_pattern", "/api/orders"),
        "status": int(settings.get("status", 500)),
        "calls": int(settings.get("calls", 2)),
    })
