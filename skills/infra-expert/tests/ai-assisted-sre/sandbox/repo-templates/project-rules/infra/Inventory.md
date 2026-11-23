# Inventory

Two stable production VMs in the ACME estate. The version recorded here is the one the binary printed on the machine.

| Host | Service | Product | Type | Version | OS | Listener |
| --- | --- | --- | --- | --- | --- | --- |
| `vm.prod.shop.acme.test` | shop | SHOP | standalone | nginx 1.26 | 12 | 80/tcp |
| `vm.prod.warehouse.acme.test` | warehouse | WHSE | standalone | nginx 1.26 | 12 | 80/tcp |

Total: 2 hosts, 2 services. Update this table in the same change that changes a host, a version or a listener.
