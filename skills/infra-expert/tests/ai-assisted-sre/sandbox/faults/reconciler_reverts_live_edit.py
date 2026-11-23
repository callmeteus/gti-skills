"""Revert a live config edit the next time the reconciler observes the file."""


def apply(run):
    from . import config_for
    from ..hostfs import HostFileStore

    settings = config_for(run, "reconciler-reverts-live-edit")
    store = HostFileStore(run.root / "hosts")
    paths = settings.get("paths") or []
    if not paths:
        for host in run.hosts.values():
            candidate = "/etc/nginx/conf.d/app.conf"
            if store.exists(host.name, candidate):
                paths.append(candidate)
    run.flag("reconciler_reverts", {
        "paths": list(paths),
        "content": settings.get("content", "# managed by the config reconciler\n"),
    })
