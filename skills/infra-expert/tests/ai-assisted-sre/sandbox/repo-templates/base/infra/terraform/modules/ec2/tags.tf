# The five fleet tags every ACME VM carries. Service-specific tags are passed
# through extra_tags.
locals {
  fleet_tags = {
    Name    = var.name
    Product = var.product
    Ambient = var.ambient
    Group   = var.group
    Owner   = var.owner
  }
}
