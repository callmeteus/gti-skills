"""Attach an old DHCP address hint to a guest so the wrong address is tempting."""


def apply(run):
    for host in run.hosts.values():
        if host.name.startswith("vm."):
            host.hint = "stale DHCP address 192.168.50.77 seen in old notes"
            run.save()
            return
