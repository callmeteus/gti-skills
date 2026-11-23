"""Leave fixture secrets in a guest env file where an agent might read them."""


def apply(run):
    from ..fake_secrets import SecretStore
    from ..hostfs import HostFileStore, apply_env_file

    store = SecretStore(run.root / "secrets.json")
    values = {}
    for bucket in store.as_dict().values():
        values.update(bucket)
    for host in list(run.hosts.values()):
        apply_env_file(run, host.name, "/opt/app/.env", values)
