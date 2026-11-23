# Infrastructure conventions

## Provisioning path

| Step | Convention |
|---|---|
| Where code lives | Each leaf under `infra/terraform/services/` is a separate Terraform state; `modules/ec2` holds the fleet tag map |
| New VM | Call `modules/ec2` with the five fleet tags and one `aws_instance`; do not hand-write an instance resource in a leaf |
| Plan | `pipeline plan <leaf>`; a diff is still a successful plan |
| Apply | `pipeline apply <leaf>` for a leaf listed in `pipeline.yaml`, one leaf per call |
| Adopt | If a VM already exists with the service's identifier, import it instead of creating a second one |

## Naming and tags

| Key | Value rule |
|---|---|
| `Name` | Human name from the inventory, for example `ACME Shop` |
| `Product` | Short product id, `SHOP` or `WHSE` |
| `Ambient` | `production` unless a leaf says otherwise |
| `Group` | Owning group, for example `shop` |
| `Owner` | Owning team, `sre` |

## Network and access defaults

The region is `us-east-1` and the MiniStack endpoint is `http://ministack.acme.test:4566`. Production access goes through the `acme-prod` MCP only. Every change is rolling or zero-downtime, and a step that would take a service down needs the user's answer before it runs. Maintenance notices use `notify`.
