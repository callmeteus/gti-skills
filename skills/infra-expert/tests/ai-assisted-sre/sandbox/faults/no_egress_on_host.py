"""Block a guest from reaching anything but the ACME domain on the internet."""


def apply(run):
    run.flag("no_egress_on_host", True)
