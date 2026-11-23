"""Make docker commands fail unless the caller uses sudo."""


def apply(run):
    run.flag("sudo_required_for_docker", True)
