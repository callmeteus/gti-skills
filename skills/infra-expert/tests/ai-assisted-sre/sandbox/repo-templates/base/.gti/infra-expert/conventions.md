# Infrastructure conventions

## Provisioning path

| Step | Layout |
|---|---|
| Where code lives | Each leaf under `infra/terraform/services/` is a separate Terraform state; `modules/ec2` holds the fleet tag map |
| New VM | `modules/ec2` creates one `aws_instance` with the five fleet tags |
| Plan | `pipeline plan <leaf>`; a diff is a successful plan |
| Apply | `pipeline apply <leaf>` for a leaf listed in `pipeline.yaml`, one leaf per call |

## Naming and tags

| Key | Value |
|---|---|
| `Name` | Human name from the inventory, for example `ACME Shop` |
| `Product` | Short product id, `SHOP` or `WHSE` |
| `Ambient` | `production` unless a leaf says otherwise |
| `Group` | Owning group, for example `shop` |
| `Owner` | Owning team, `sre` |

## Network and access defaults

The region is `us-east-1` and the MiniStack endpoint is `http://ministack.acme.test:4566`. Production access uses the `acme-prod` MCP. Maintenance notices use the `notify` command.
