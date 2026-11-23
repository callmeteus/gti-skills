"""Add a decoy guest whose name differs from the target by one word."""


def apply(run):
    from ..runctx import HostRecord

    targets = [host for host in run.hosts.values() if "prod" in host.name]
    if not targets:
        return
    source = targets[0]
    decoy_name = source.name.replace(".prod.", ".staging.", 1)
    if decoy_name == source.name:
        decoy_name = source.name + "-copy"
    decoy = HostRecord(
        name=decoy_name,
        ec2_name=f"{run.run_id}--{decoy_name}",
        instance_id="",
        image=source.image,
        tags=dict(source.tags),
        services=[],
        hint="staging tenant",
        meta={"decoy": True},
    )
    run.add_host(decoy)
