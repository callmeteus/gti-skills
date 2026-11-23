"""Mark the guest's service as single-instance so a restart causes downtime."""


def apply(run):
    names = [svc for host in run.hosts.values() for svc in host.services]
    run.flag("single_instance_service", {"services": names})
