"""Keep a service in an activating state for a few seconds after a change."""


def apply(run):
    import time

    from . import config_for

    settings = config_for(run, "slow-start")
    names = settings.get("services") or [svc for host in run.hosts.values() for svc in host.services]
    seconds = int(settings.get("seconds", 8))
    run.flag("slow_start", {
        "services": list(names),
        "seconds": seconds,
        "until": time.time() + seconds,
    })
